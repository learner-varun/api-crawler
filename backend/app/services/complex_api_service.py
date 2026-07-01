import requests
import time
import json
import hashlib
import hmac
import base64
import math
import re
import os
import sqlite3
import imaplib
from datetime import datetime, timedelta, timezone
from email import message_from_bytes
from email.header import decode_header
from email.utils import parsedate_to_datetime
from urllib import parse as urllib_parse
import signal
from sqlalchemy.orm import Session
from backend.app.models.models import ComplexAPI, GlobalVariable
from backend.app.services.curl_parser import parse_curl_command, substitute_variables, extract_value_by_path
from backend.app.utils.logger import get_logger

logger = get_logger("complex_api_service")

# Safe builtins whitelist for script sandbox
_SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
    "enumerate": enumerate, "filter": filter, "float": float, "format": format,
    "frozenset": frozenset, "getattr": getattr, "hasattr": hasattr, "hash": hash,
    "int": int, "isinstance": isinstance, "issubclass": issubclass, "iter": iter,
    "len": len, "list": list, "map": map, "max": max, "min": min, "next": next,
    "print": print, "range": range, "repr": repr, "reversed": reversed,
    "round": round, "set": set, "slice": slice, "sorted": sorted, "str": str,
    "sum": sum, "tuple": tuple, "type": type, "zip": zip,
    "True": True, "False": False, "None": None,
}

# Safe modules available in script context
_SAFE_MODULES = {
    "time": time,
    "json": json,
    "hashlib": hashlib,
    "hmac": hmac,
    "base64": base64,
    "math": math,
    "re": re,
    "datetime": datetime,
    "timedelta": timedelta,
    "timezone": timezone,
    "urllib_parse": urllib_parse,
    "requests": requests,
}


class ScriptTimeoutError(Exception):
    pass


class ScriptGlobalVariables:
    """Helper exposed to scripts for reading and writing API-Crawler global variables."""

    def __init__(self, db: Session, variables: dict):
        self.db = db
        self.variables = variables

    def __getitem__(self, key: str) -> str | None:
        return self.get(key)

    def __setitem__(self, key: str, value):
        self.set(key, value)

    def get(self, key: str, default=None):
        if key in self.variables:
            return self.variables[key]

        gv = self.db.query(GlobalVariable).filter(GlobalVariable.key == key).first()
        if gv:
            self.variables[key] = gv.value
            return gv.value

        return os.getenv(key, default)

    def set(self, key: str, value) -> str:
        str_value = str(value)
        gv = self.db.query(GlobalVariable).filter(GlobalVariable.key == key).first()
        if gv:
            gv.value = str_value
        else:
            gv = GlobalVariable(key=key, value=str_value)
            self.db.add(gv)
        self.db.commit()
        self.variables[key] = str_value
        return str_value

    def update(self, values: dict) -> dict:
        for key, value in values.items():
            self.set(key, value)
        return dict(self.variables)

    def all(self) -> dict:
        globals_db = self.db.query(GlobalVariable).all()
        self.variables.update({gv.key: gv.value for gv in globals_db})
        return dict(self.variables)


class ScriptEnvHelper:
    """Helper exposed to scripts for reading and writing environment variables."""

    def __getitem__(self, key: str) -> str | None:
        return os.getenv(key)

    def __setitem__(self, key: str, value):
        os.environ[key] = str(value)

    def get(self, key: str, default=None) -> str | None:
        return os.getenv(key, default)

    def set(self, key: str, value) -> str:
        str_value = str(value)
        os.environ[key] = str_value
        return str_value


class ScriptDatabaseHelper:
    """Read-only SQLite helper exposed to scripts for OTP/test-data lookup."""

    def _resolve_sqlite_path(self, database_url_or_path: str) -> str:
        if not database_url_or_path:
            raise ValueError("Database path or sqlite URL is required")

        if database_url_or_path.startswith("sqlite:///"):
            return database_url_or_path.replace("sqlite:///", "", 1)

        if database_url_or_path.startswith("sqlite://"):
            raise ValueError("Only file-based SQLite URLs are supported")

        return database_url_or_path

    def query(self, database_url_or_path: str, sql: str, params=None, max_rows: int = 50) -> list:
        statement = sql.strip()
        if not statement.lower().startswith(("select", "with", "pragma")):
            raise ValueError("Script database helper only allows read-only SELECT/WITH/PRAGMA statements")

        db_path = self._resolve_sqlite_path(database_url_or_path)
        row_limit = max(1, min(int(max_rows), 500))

        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(statement, params or []).fetchmany(row_limit)
            return [dict(row) for row in rows]

    def fetch_one(self, database_url_or_path: str, sql: str, params=None) -> dict | None:
        rows = self.query(database_url_or_path, sql, params=params, max_rows=1)
        return rows[0] if rows else None

    def fetch_value(self, database_url_or_path: str, sql: str, params=None, default=None):
        row = self.fetch_one(database_url_or_path, sql, params=params)
        if not row:
            return default
        return next(iter(row.values()), default)


class ScriptEmailHelper:
    """IMAP helper exposed to scripts for fetching OTP values from recent email."""

    def _decode_header_value(self, value: str | None) -> str:
        if not value:
            return ""

        decoded_parts = []
        for part, encoding in decode_header(value):
            if isinstance(part, bytes):
                decoded_parts.append(part.decode(encoding or "utf-8", errors="replace"))
            else:
                decoded_parts.append(part)
        return "".join(decoded_parts)

    def _message_text(self, msg) -> str:
        if msg.is_multipart():
            parts = []
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", "")).lower()
                if content_type in {"text/plain", "text/html"} and "attachment" not in disposition:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        parts.append(payload.decode(charset, errors="replace"))
            return "\n".join(parts)

        payload = msg.get_payload(decode=True)
        if not payload:
            return ""
        charset = msg.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")

    def find_otp(
        self,
        imap_host: str,
        username: str,
        password: str,
        mailbox: str = "INBOX",
        sender: str | None = None,
        subject: str | None = None,
        pattern: str = r"\b\d{4,8}\b",
        since_minutes: int = 15,
        limit: int = 20,
        use_ssl: bool = True,
        port: int | None = None,
    ):
        mail_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
        mail = mail_cls(imap_host, port or (993 if use_ssl else 143))
        try:
            mail.login(username, password)
            mail.select(mailbox)

            since_date = (datetime.now(timezone.utc) - timedelta(minutes=since_minutes)).strftime("%d-%b-%Y")
            status, data = mail.search(None, "SINCE", since_date)
            if status != "OK" or not data or not data[0]:
                return None

            message_ids = data[0].split()
            checked = 0
            for message_id in reversed(message_ids):
                if checked >= max(1, min(int(limit), 100)):
                    break
                checked += 1

                status, payload = mail.fetch(message_id, "(RFC822)")
                if status != "OK" or not payload or not payload[0]:
                    continue

                msg = message_from_bytes(payload[0][1])
                from_header = self._decode_header_value(msg.get("From"))
                subject_header = self._decode_header_value(msg.get("Subject"))

                if sender and sender.lower() not in from_header.lower():
                    continue
                if subject and subject.lower() not in subject_header.lower():
                    continue

                date_header = msg.get("Date")
                if date_header:
                    try:
                        message_dt = parsedate_to_datetime(date_header)
                        if message_dt.tzinfo is None:
                            message_dt = message_dt.replace(tzinfo=timezone.utc)
                        cutoff = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
                        if message_dt.astimezone(timezone.utc) < cutoff:
                            continue
                    except Exception:
                        pass

                body = self._message_text(msg)
                match = re.search(pattern, body)
                if match:
                    return match.group(1) if match.groups() else match.group(0)

            return None
        finally:
            try:
                mail.logout()
            except Exception:
                pass


def _timeout_handler(signum, frame):
    raise ScriptTimeoutError("Script execution timed out (10s limit)")


def run_script(script: str, ctx: dict, script_label: str = "script") -> dict:
    """
    Execute a user-provided Python script in a sandboxed environment.
    
    Args:
        script: The Python code string to execute.
        ctx: A context dict passed into the script. Must contain:
             - 'variables': dict of global variables (mutable)
             - 'vars': helper with get/set/update/all methods for global variables
             - 'env': helper with get/set methods for environment variables
             - 'db': helper for read-only SQLite SELECT queries
             - 'email': helper for fetching OTP values from IMAP mailboxes
             - 'response': dict with status_code, body, headers (optional, for post-scripts)
             - 'log': a callable for logging from within the script
        script_label: Label used in log messages (e.g., "pre_request_script")
    
    Returns:
        The (potentially mutated) ctx dict.
    """
    if not script or not script.strip():
        return ctx

    # Build the restricted global namespace
    script_globals = {"__builtins__": _SAFE_BUILTINS}
    script_globals.update(_SAFE_MODULES)
    script_globals["ctx"] = ctx
    script_globals["vars"] = ctx["vars"]
    script_globals["env"] = ctx["env"]
    script_globals["get_var"] = ctx["vars"].get
    script_globals["set_var"] = ctx["vars"].set
    script_globals["get_env"] = ctx["env"].get
    script_globals["set_env"] = ctx["env"].set
    script_globals["log"] = ctx["log"]
    script_globals["print"] = ctx["log"]

    # Set a timeout to prevent infinite loops (Unix only)
    old_handler = None
    try:
        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(10)  # 10 second timeout
    except (ValueError, AttributeError, OSError):
        # signal.alarm not available (e.g., Windows or non-main thread)
        old_handler = None

    try:
        exec(script, script_globals)
    except ScriptTimeoutError:
        logger.warning(f"[{script_label}] Script timed out after 10 seconds.")
        ctx["log"]("Script timed out after 10 seconds.")
    except Exception as e:
        logger.warning(f"[{script_label}] Script execution error: {type(e).__name__}: {str(e)}")
        ctx["log"](f"Script execution error: {type(e).__name__}: {str(e)}")
    finally:
        # Reset alarm
        try:
            signal.alarm(0)
            if old_handler is not None:
                signal.signal(signal.SIGALRM, old_handler)
        except (ValueError, AttributeError, OSError):
            pass

    return ctx


def _build_script_context(db: Session, variables: dict, log_messages: list, response: dict | None = None) -> dict:
    ctx = {
        "variables": variables,
        "vars": ScriptGlobalVariables(db, variables),
        "env": ScriptEnvHelper(),
        "db": ScriptDatabaseHelper(),
        "email": ScriptEmailHelper(),
        "log": lambda msg: log_messages.append(str(msg)),
    }
    if response is not None:
        ctx["response"] = response
    return ctx


def _sync_variables_to_db(db: Session, variables: dict, original_variables: dict):
    """
    Sync any variable mutations from the script context back to the GlobalVariable table.
    Only updates/creates variables that were actually changed or added.
    """
    for key, value in variables.items():
        str_value = str(value)
        if key not in original_variables or original_variables[key] != str_value:
            gv = db.query(GlobalVariable).filter(GlobalVariable.key == key).first()
            if gv:
                gv.value = str_value
            else:
                gv = GlobalVariable(key=key, value=str_value)
                db.add(gv)
            db.commit()


def execute_single_complex_api(db: Session, api: ComplexAPI) -> dict:
    """
    Executes a single complex API's curl request, substitutes variables, parses response,
    extracts defined variables and saves them into the Database.
    """
    # Fetch all global variables
    globals_db = db.query(GlobalVariable).all()
    globals_dict = {gv.key: gv.value for gv in globals_db}
    
    pre_script_logs = []
    post_script_logs = []
    
    # --- PRE-REQUEST SCRIPT ---
    if api.pre_request_script:
        pre_ctx = _build_script_context(db, dict(globals_dict), pre_script_logs)
        run_script(api.pre_request_script, pre_ctx, script_label=f"pre_request_script:{api.name}")
        for msg in pre_script_logs:
            logger.info(f"[pre_script:{api.name}] {msg}")
        
        # Sync variable mutations back to DB
        _sync_variables_to_db(db, pre_ctx["variables"], globals_dict)
        
        # Re-fetch global variables after pre-script may have modified them
        globals_db = db.query(GlobalVariable).all()
        globals_dict = {gv.key: gv.value for gv in globals_db}
    
    # Parse curl
    req_params = parse_curl_command(api.curl_command)
    
    # Substitute variables in URL, Headers, and Data
    url = substitute_variables(req_params["url"], globals_dict)
    headers = {k: substitute_variables(v, globals_dict) for k, v in req_params["headers"].items()}
    data = req_params["data"]
    if data:
        data = substitute_variables(data, globals_dict)
        
    # Execute request
    response = requests.request(
        method=req_params["method"],
        url=url,
        headers=headers,
        data=data,
        timeout=15
    )
    
    try:
        resp_data = response.json()
    except ValueError:
        resp_data = {"text_content": response.text}
        
    extraction_results = []
    
    # Extract variables
    if api.extract_rules:
        for rule in api.extract_rules:
            json_path = rule.get("json_path")
            var_key = rule.get("variable_key")
            
            if json_path and var_key:
                extracted_val = extract_value_by_path(resp_data, json_path)
                if extracted_val is not None:
                    # Update or create global variable
                    gv = db.query(GlobalVariable).filter(GlobalVariable.key == var_key).first()
                    if gv:
                        gv.value = str(extracted_val)
                    else:
                        gv = GlobalVariable(key=var_key, value=str(extracted_val))
                        db.add(gv)
                    db.commit()
                    extraction_results.append({"key": var_key, "extracted_value": str(extracted_val)})
    
    # --- POST-REQUEST SCRIPT ---
    if api.post_request_script:
        # Re-fetch globals (extraction may have updated them)
        globals_db = db.query(GlobalVariable).all()
        globals_dict_post = {gv.key: gv.value for gv in globals_db}
        
        post_ctx = _build_script_context(
            db,
            dict(globals_dict_post),
            post_script_logs,
            response={
                "status_code": response.status_code,
                "body": resp_data,
                "headers": dict(response.headers),
            },
        )
        run_script(api.post_request_script, post_ctx, script_label=f"post_request_script:{api.name}")
        for msg in post_script_logs:
            logger.info(f"[post_script:{api.name}] {msg}")
        
        # Sync variable mutations back to DB
        _sync_variables_to_db(db, post_ctx["variables"], globals_dict_post)
                    
    return {
        "status_code": response.status_code,
        "response": resp_data,
        "extractions": extraction_results,
        "raw_response": response,
        "pre_script_logs": pre_script_logs,
        "post_script_logs": post_script_logs,
        "request": {
            "method": req_params["method"],
            "url": url,
            "headers": headers,
            "data": data
        }
    }

def validate_assertion_rules(response: requests.Response, assertions: list, db: Session = None) -> list:
    """
    Validates a list of custom assertion rules against the live response.
    Returns a list of failed assertion details (diff-like objects).
    """
    failures = []
    if not assertions:
        return failures

    try:
        response_json = response.json()
    except ValueError:
        response_json = None

    globals_dict = {}
    if db is not None:
        globals_db = db.query(GlobalVariable).all()
        globals_dict = {gv.key: gv.value for gv in globals_db}

    for assertion in assertions:
        a_type = assertion.get("type")
        path = assertion.get("path")
        expected = assertion.get("expected")

        if globals_dict:
            if path and isinstance(path, str):
                path = substitute_variables(path, globals_dict)
            if expected:
                if isinstance(expected, str):
                    expected = substitute_variables(expected, globals_dict)
                elif isinstance(expected, (dict, list)):
                    import json
                    try:
                        dumped = json.dumps(expected)
                        substituted = substitute_variables(dumped, globals_dict)
                        expected = json.loads(substituted)
                    except Exception:
                        pass

        if a_type == "status_code":
            try:
                exp_status = int(expected)
                if response.status_code != exp_status:
                    failures.append({
                        "field": "status_code",
                        "expected": str(exp_status),
                        "actual": str(response.status_code),
                        "reason": "Status Code Mismatch"
                    })
            except (ValueError, TypeError):
                pass
                
        elif a_type == "response_time_under_ms":
            try:
                exp_ms = float(expected)
                actual_ms = response.elapsed.total_seconds() * 1000
                if actual_ms > exp_ms:
                    failures.append({
                        "field": "response_time",
                        "expected": f"Under {exp_ms}ms",
                        "actual": f"{round(actual_ms, 2)}ms",
                        "reason": "Response Time Exceeded"
                    })
            except (ValueError, TypeError):
                pass
                
        elif a_type == "body_contains":
            val = str(expected)
            if val not in response.text:
                failures.append({
                    "field": "body",
                    "expected": f"Contains text: '{val}'",
                    "actual": "Text not found in body",
                    "reason": "Body Text Mismatch"
                })
                
        elif a_type == "header_contains":
            if not path:
                continue
            hdr_val = response.headers.get(path)
            if hdr_val is None:
                failures.append({
                    "field": f"headers.{path}",
                    "expected": f"Header '{path}' to exist",
                    "actual": "Header missing",
                    "reason": "Header Missing"
                })
            else:
                exp_str = str(expected)
                if exp_str not in hdr_val:
                    failures.append({
                        "field": f"headers.{path}",
                        "expected": f"Header value contains '{exp_str}'",
                        "actual": f"'{hdr_val}'",
                        "reason": "Header Value Mismatch"
                    })
                    
        elif a_type == "json_path_exists":
            if response_json is None:
                failures.append({
                    "field": "json",
                    "expected": "Valid JSON body",
                    "actual": "Invalid JSON",
                    "reason": "Not JSON Format"
                })
                continue
            if not path:
                continue
            extracted = extract_value_by_path(response_json, path)
            if extracted is None:
                failures.append({
                    "field": path,
                    "expected": f"JSON path '{path}' to exist",
                    "actual": "Null or Missing",
                    "reason": "JSON Path Missing"
                })
                
        elif a_type == "json_path_equals":
            if response_json is None:
                failures.append({
                    "field": "json",
                    "expected": "Valid JSON body",
                    "actual": "Invalid JSON",
                    "reason": "Not JSON Format"
                })
                continue
            if not path:
                continue
            extracted = extract_value_by_path(response_json, path)
            if str(extracted) != str(expected):
                failures.append({
                    "field": path,
                    "expected": str(expected),
                    "actual": str(extracted),
                    "reason": "Value Mismatch"
                })
                
        elif a_type == "json_path_contains":
            if response_json is None:
                failures.append({
                    "field": "json",
                    "expected": "Valid JSON body",
                    "actual": "Invalid JSON",
                    "reason": "Not JSON Format"
                })
                continue
            if not path:
                continue
            extracted = extract_value_by_path(response_json, path)
            if extracted is None or str(expected) not in str(extracted):
                failures.append({
                    "field": path,
                    "expected": f"Contains '{expected}'",
                    "actual": str(extracted),
                    "reason": "Value Mismatch"
                })
                
        elif a_type == "json_path_type":
            if response_json is None:
                failures.append({
                    "field": "json",
                    "expected": "Valid JSON body",
                    "actual": "Invalid JSON",
                    "reason": "Not JSON Format"
                })
                continue
            if not path:
                continue
            extracted = extract_value_by_path(response_json, path)
            exp_type = str(expected).lower()
            
            is_valid = False
            if exp_type == "string":
                is_valid = isinstance(extracted, str)
            elif exp_type == "integer":
                is_valid = isinstance(extracted, int) and not isinstance(extracted, bool)
            elif exp_type == "number":
                is_valid = isinstance(extracted, (int, float)) and not isinstance(extracted, bool)
            elif exp_type == "boolean":
                is_valid = isinstance(extracted, bool)
            elif exp_type == "array":
                is_valid = isinstance(extracted, list)
            elif exp_type == "object":
                is_valid = isinstance(extracted, dict)
            elif exp_type == "null":
                is_valid = extracted is None
                
            if not is_valid:
                actual_type = type(extracted).__name__ if extracted is not None else "null"
                failures.append({
                    "field": f"{path} (type)",
                    "expected": exp_type,
                    "actual": actual_type,
                    "reason": "Type Mismatch"
                })
                
        elif a_type == "json_schema":
            if response_json is None:
                failures.append({
                    "field": "json",
                    "expected": "Valid JSON body",
                    "actual": "Invalid JSON",
                    "reason": "Not JSON Format"
                })
                continue
            try:
                import jsonschema
                jsonschema.validate(instance=response_json, schema=expected)
            except ImportError:
                pass
            except jsonschema.ValidationError as ve:
                failures.append({
                    "field": "json_schema",
                    "expected": "Schema compliance",
                    "actual": ve.message,
                    "reason": "JSON Schema Mismatch"
                })
                
    return failures

def run_complex_apis_for_env(db: Session, env_id: int):
    """
    Executes all complex APIs defined for the given environment in sequence.
    This refreshes dynamic global variables used by the standard APIs.
    """
    apis = db.query(ComplexAPI).filter(ComplexAPI.environment_id == env_id).all()
    if not apis:
        logger.info(f"No complex APIs configured for environment ID {env_id}.")
        return

    logger.info(f"Running {len(apis)} complex APIs for environment ID {env_id}...")
    for api in apis:
        try:
            logger.info(f"Running complex API: {api.name}")
            res = execute_single_complex_api(db, api)
            logger.info(f"Complex API {api.name} run successfully: Status {res['status_code']}. Extractions: {res['extractions']}")
        except Exception as e:
            logger.error(f"Failed to run complex API {api.name}: {str(e)}")
