import requests
from sqlalchemy.orm import Session
from backend.app.models.models import ComplexAPI, GlobalVariable
from backend.app.services.curl_parser import parse_curl_command, substitute_variables, extract_value_by_path
from backend.app.utils.logger import get_logger

logger = get_logger("complex_api_service")

def execute_single_complex_api(db: Session, api: ComplexAPI) -> dict:
    """
    Executes a single complex API's curl request, substitutes variables, parses response,
    extracts defined variables and saves them into the Database.
    """
    # Fetch all global variables
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
                    
    return {
        "status_code": response.status_code,
        "response": resp_data,
        "extractions": extraction_results,
        "raw_response": response
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
