import os
import json
import requests
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.models import Environment, API, BaselineBackup, ExecutionHistory, FailureDetails, ComplexAPI, GlobalVariable
from backend.app.services.diff_engine import compare_responses
from backend.app.utils.logger import get_logger

logger = get_logger("validation_service")

def execute_validation(db: Session, env_id: int) -> ExecutionHistory:
    """
    Executes live GET requests for all registered APIs under an environment,
    compares them against the latest baseline backup, and logs the execution history and failures.
    """
    # 1. Fetch environment
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise ValueError(f"Environment with ID {env_id} not found.")

    # 2. Fetch currently registered APIs for this environment
    apis = db.query(API).filter(API.environment_id == env_id).all()
    complex_apis = db.query(ComplexAPI).filter(ComplexAPI.environment_id == env_id).all()

    if not apis and not complex_apis:
        # Save a clean execution history record indicating 0 APIs
        execution = ExecutionHistory(
            environment_id=env.id,
            execution_time=datetime.utcnow(),
            total_apis=0,
            passed=0,
            failed=0,
            status="PASSED"
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        return execution

    # 3. Fetch latest backup if there are standard APIs
    latest_backup = None
    backup_apis = {}
    if apis:
        latest_backup = db.query(BaselineBackup)\
            .filter(BaselineBackup.environment_id == env_id)\
            .order_by(BaselineBackup.backup_time.desc())\
            .first()
            
        if not latest_backup:
            raise ValueError("No baseline backup found for selected environment.")

        # 4. Load backup metadata
        metadata_path = os.path.join(latest_backup.backup_path, "metadata.json")
        if not os.path.exists(metadata_path):
            raise ValueError(f"Backup metadata file missing at {metadata_path}")

        with open(metadata_path, "r", encoding="utf-8") as f:
            backup_metadata = json.load(f)
            
        backup_apis = backup_metadata.get("apis", {})

    # Prepare execution metrics
    total_apis = len(apis) + len(complex_apis)
    passed_count = 0
    failed_count = 0
    failures_to_create = []

    # A. Execute and validate Complex APIs first
    for api in complex_apis:
        # Execute Complex API first
        success = False
        live_body = None
        live_status = None
        raw_response = None
        error_reason = ""
        
        for attempt in range(1, 4):
            try:
                from backend.app.services.complex_api_service import execute_single_complex_api
                res = execute_single_complex_api(db, api)
                live_status = res["status_code"]
                live_body = res["response"]
                raw_response = res.get("raw_response")
                success = True
                break
            except Exception as e:
                error_reason = f"Execution Error: {str(e)}"
                logger.warning(f"Error on validation attempt {attempt} for Complex API {api.name}: {str(e)}")

        if not success:
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=-api.id,
                api_name=api.name,
                api_url=api.curl_command,
                difference=None,
                failure_reason=error_reason
            ))
            continue

        # Check for custom assertions
        if api.assertions:
            from backend.app.services.complex_api_service import validate_assertion_rules
            assertion_failures = validate_assertion_rules(raw_response, api.assertions, db)
            if assertion_failures:
                failed_count += 1
                failures_to_create.append(FailureDetails(
                    api_id=-api.id,
                    api_name=api.name,
                    api_url=api.curl_command,
                    difference=assertion_failures,
                    failure_reason="Assertion Rules Failed"
                ))
            else:
                passed_count += 1
            continue

        # If no assertions, fallback to checking status code is 2xx success (no baseline backups are kept for Complex APIs)
        if not (200 <= live_status < 300):
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=-api.id,
                api_name=api.name,
                api_url=api.curl_command,
                difference=[{
                    "field": "status_code",
                    "expected": "2xx Success status code",
                    "actual": str(live_status),
                    "reason": f"HTTP status {live_status}"
                }],
                failure_reason=f"HTTP Error Status {live_status}"
            ))
        else:
            passed_count += 1

    # B. Execute and validate standard APIs
    session = requests.Session()

    # Load global variables for placeholder substitution
    from backend.app.services.curl_parser import substitute_variables
    globals_db = db.query(GlobalVariable).all()
    globals_dict = {gv.key: gv.value for gv in globals_db}

    backup_ver = latest_backup.backup_version if latest_backup else "N/A"
    logger.info(f"Starting API validation execution for environment: {env.name} against baseline version: {backup_ver}")

    for api in apis:
        api_url = substitute_variables(api.endpoint, globals_dict)
        str_api_id = str(api.id)
        
        # 4a. Check if this API has baseline backup data
        if str_api_id not in backup_apis:
            # Failure due to missing baseline
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=api.id,
                api_name=api.name,
                api_url=api_url,
                difference=[{
                    "field": "root",
                    "expected": "Baseline backup payload",
                    "actual": "No baseline payload found for this API",
                    "reason": "Missing baseline version"
                }],
                failure_reason="No baseline backup found for this API"
            ))
            continue

        backup_info = backup_apis[str_api_id]
        expected_status = backup_info.get("status_code", 200)
        baseline_filename = backup_info.get("filename")
        baseline_filepath = os.path.join(latest_backup.backup_path, baseline_filename)

        # Load baseline response body
        if not os.path.exists(baseline_filepath):
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=api.id,
                api_name=api.name,
                api_url=api_url,
                difference=[{
                    "field": "root",
                    "expected": f"Baseline file: {baseline_filename}",
                    "actual": "File missing on disk",
                    "reason": "Baseline file not found"
                }],
                failure_reason="No baseline backup found for this API"
            ))
            continue

        with open(baseline_filepath, "r", encoding="utf-8") as f:
            baseline_body = json.load(f)

        # 4b. Execute live API request with 3 attempts
        success = False
        live_body = None
        live_status = None
        error_reason = ""
        latency = 0.0

        for attempt in range(1, 4):
            try:
                start_time = datetime.utcnow()
                response = session.get(api_url, timeout=10)
                latency = (datetime.utcnow() - start_time).total_seconds()
                live_status = response.status_code
                
                try:
                    live_body = response.json()
                except ValueError:
                    live_body = {"text_content": response.text}
                
                success = True
                break
            except requests.exceptions.Timeout:
                error_reason = "Timeout"
                logger.warning(f"Timeout on validation attempt {attempt} for API {api.name} ({api_url})")
            except requests.exceptions.RequestException as e:
                error_reason = f"Connection Error"
                logger.warning(f"Connection error on validation attempt {attempt} for API {api.name} ({api_url})")

        # 4c. Process response
        if not success:
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=api.id,
                api_name=api.name,
                api_url=api_url,
                difference=None,
                failure_reason=error_reason
            ))
            continue

        # 4d. Validate status code
        if live_status != expected_status:
            failed_count += 1
            failures_to_create.append(FailureDetails(
                api_id=api.id,
                api_name=api.name,
                api_url=api_url,
                difference=[{
                    "field": "status_code",
                    "expected": str(expected_status),
                    "actual": str(live_status),
                    "reason": "Status Code Mismatch"
                }],
                failure_reason="Status Code Mismatch"
            ))
            continue

        # 4e. Compare payload using diff engine
        diffs = compare_responses(baseline_body, live_body)
        
        if diffs:
            failed_count += 1
            # Classify primary failure reason from diff list
            # We prioritize "Missing Key", then "Response Structure Changed", then "Response Value Changed"
            primary_reason = "Response Structure Changed"
            reasons = [d["reason"] for d in diffs]
            if "Missing Key" in reasons:
                primary_reason = "Missing Key"
            elif "Response Structure Changed" in reasons:
                primary_reason = "Response Structure Changed"
            elif "Response Value Changed" in reasons:
                primary_reason = "Response Value Changed"

            failures_to_create.append(FailureDetails(
                api_id=api.id,
                api_name=api.name,
                api_url=api_url,
                difference=diffs,
                failure_reason=primary_reason
            ))
        else:
            passed_count += 1

    # 5. Save execution results in DB
    status = "FAILED" if failed_count > 0 else "PASSED"
    execution = ExecutionHistory(
        environment_id=env.id,
        execution_time=datetime.utcnow(),
        total_apis=total_apis,
        passed=passed_count,
        failed=failed_count,
        status=status
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Link execution_id to failure records and save them
    for failure in failures_to_create:
        failure.execution_id = execution.id
        db.add(failure)
        
    db.commit()
    db.refresh(execution)

    logger.info(f"Validation execution complete: {status}. Total: {total_apis}, Passed: {passed_count}, Failed: {failed_count}")

    # Dispatch alerts if notification channel is configured
    try:
        from backend.app.services.notification_service import send_execution_notification
        send_execution_notification(db, execution)
    except Exception as notify_err:
        logger.error(f"Failed to dispatch execution notification: {str(notify_err)}")

    return execution
