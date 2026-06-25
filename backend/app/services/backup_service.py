import os
import re
import shutil
import json
import requests
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.models import Environment, API, BaselineBackup, ComplexAPI
from backend.app.utils.logger import get_logger

logger = get_logger("backup_service")

# Root directory for backups
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUPS_ROOT = os.getenv("BACKUPS_ROOT", os.path.join(os.path.dirname(BASE_DIR), "backups"))
MAX_RETENTION_BACKUPS = 5

def sanitize_filename(name: str) -> str:
    """
    Sanitizes API names to be safe for filenames.
    """
    s = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    return s.strip("_").lower()

def create_baseline_backup(db: Session, env_id: int) -> BaselineBackup:
    """
    Executes all APIs in the environment, saves their responses, and records metadata.
    Enforces a backup retention policy of max 5 backups per environment.
    """
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise ValueError(f"Environment with ID {env_id} not found.")

    # Run complex APIs first to refresh dynamic global variables (auth tokens, etc.)
    try:
        from backend.app.services.complex_api_service import run_complex_apis_for_env
        run_complex_apis_for_env(db, env_id)
    except Exception as e:
        logger.error(f"Error running complex APIs for environment {env.name}: {str(e)}")

    apis = db.query(API).filter(API.environment_id == env_id).all()
    if not apis:
        raise ValueError("No APIs registered in this environment. Cannot create baseline backup.")

    # Create directories
    env_dir_name = env.name.lower().replace(" ", "_")
    env_backup_dir = os.path.join(BACKUPS_ROOT, env_dir_name)
    os.makedirs(env_backup_dir, exist_ok=True)

    # Version format: YYYY-MM-DD_HH-MM-SS
    backup_version = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    version_dir = os.path.join(env_backup_dir, backup_version)
    os.makedirs(version_dir, exist_ok=True)

    metadata_apis = {}
    
    logger.info(f"Starting baseline backup for environment: {env.name} ({env.base_url})")

    # Session for API calls with basic timeout
    session = requests.Session()
    
    # Load global variables for placeholder substitution
    from backend.app.models.models import GlobalVariable
    from backend.app.services.curl_parser import substitute_variables
    globals_db = db.query(GlobalVariable).all()
    globals_dict = {gv.key: gv.value for gv in globals_db}
    
    for api in apis:
        # Build API URL
        api_url = substitute_variables(api.endpoint, globals_dict)
        sanitized_name = sanitize_filename(api.name)
        filename = f"{api.id}_{sanitized_name}.json"
        filepath = os.path.join(version_dir, filename)

        # Execute GET request with up to 3 retries
        success = False
        response_body = None
        status_code = None
        error_msg = None
        latency = 0.0

        for attempt in range(1, 4):
            try:
                start_time = datetime.utcnow()
                response = session.get(api_url, timeout=10)
                latency = (datetime.utcnow() - start_time).total_seconds()
                status_code = response.status_code
                
                try:
                    response_body = response.json()
                except ValueError:
                    response_body = {"text_content": response.text}
                
                success = True
                break
            except requests.exceptions.Timeout:
                error_msg = "Timeout"
                logger.warning(f"Timeout on backup attempt {attempt} for API {api.name} ({api_url})")
            except requests.exceptions.RequestException as e:
                error_msg = f"Connection Error: {str(e)}"
                logger.warning(f"Connection error on backup attempt {attempt} for API {api.name} ({api_url})")

        # Even if the API fails, we save the error response or fail the entire backup?
        # Let's save what it yields or fail the backup if any API fails.
        # Generally, we want a valid baseline for all APIs, but if one fails, it might block backup.
        # Let's record if it succeeded. If all APIs failed, we can fail. If some succeeded, we save the payload.
        # In a standard backup run, if any API fails after 3 retries, let's still save the body if we can, or raise.
        # Actually, let's allow it to record whatever response or status code, but if it couldn't connect,
        # let's save the error details as body so we have a reference. Or better, raise an error to prevent saving a corrupted baseline.
        # Raising is cleaner: a baseline backup MUST be healthy. If an API is down, fix it or delete it from the registry.
        if not success:
            # Clean up the directory we just made
            shutil.rmtree(version_dir, ignore_errors=True)
            logger.error(f"Backup failed because API {api.name} failed to respond: {error_msg}")
            raise ValueError(f"Backup failed: API '{api.name}' failed to respond. Reason: {error_msg}")

        # Save individual API response
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(response_body, f, indent=2, ensure_ascii=False)

        metadata_apis[str(api.id)] = {
            "api_name": api.name,
            "filename": filename,
            "status_code": status_code,
            "latency": latency,
            "endpoint": api.endpoint,
            "api_url": api_url
        }



    # Save metadata.json
    metadata = {
        "environment_id": env.id,
        "environment_name": env.name,
        "backup_version": backup_version,
        "backup_time": datetime.utcnow().isoformat(),
        "apis": metadata_apis
    }
    
    with open(os.path.join(version_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    # Save record to DB
    backup_record = BaselineBackup(
        environment_id=env.id,
        backup_version=backup_version,
        backup_time=datetime.utcnow(),
        backup_path=version_dir
    )
    db.add(backup_record)
    db.commit()
    db.refresh(backup_record)

    logger.info(f"Baseline backup completed: Version {backup_version} for environment {env.name}")

    # Enforce retention policy
    enforce_backup_retention(db, env.id, env_backup_dir)

    return backup_record

def enforce_backup_retention(db: Session, env_id: int, env_backup_dir: str):
    """
    Keeps only the most recent MAX_RETENTION_BACKUPS backups for this environment, deleting older ones.
    """
    backups = db.query(BaselineBackup)\
        .filter(BaselineBackup.environment_id == env_id)\
        .order_by(BaselineBackup.backup_time.desc())\
        .all()

    if len(backups) > MAX_RETENTION_BACKUPS:
        excess_backups = backups[MAX_RETENTION_BACKUPS:]
        for backup in excess_backups:
            logger.info(f"Removing old backup {backup.backup_version} under retention policy.")
            
            # Delete directory from filesystem
            if os.path.exists(backup.backup_path):
                shutil.rmtree(backup.backup_path, ignore_errors=True)
                
            db.delete(backup)
        
        db.commit()
