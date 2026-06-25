from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import ExecutionHistory, Environment, API, BaselineBackup, ComplexAPI
from backend.app.schemas.schemas import ExecutionHistoryResponse
from backend.app.services.validation_service import execute_validation
from backend.app.utils.logger import get_logger
import os
import json
import requests as http_requests

router = APIRouter(prefix="/validate", tags=["Validation Engine"])
logger = get_logger("validation_api")

class ValidationRequest(BaseModel):
    environment_id: int

@router.post("", response_model=ExecutionHistoryResponse, status_code=status.HTTP_201_CREATED)
def trigger_validation(req: ValidationRequest, db: Session = Depends(get_db)):
    try:
        execution = execute_validation(db, req.environment_id)
        return execution
    except ValueError as e:
        # Catch standard validation errors like "No baseline backup found..."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error in validation engine: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something went wrong in the Validation Engine. Please check server logs for details."
        )

@router.get("/history", response_model=List[ExecutionHistoryResponse])
def get_execution_history(db: Session = Depends(get_db)):
    """
    Returns history of last 50 executions.
    """
    return db.query(ExecutionHistory).order_by(ExecutionHistory.execution_time.desc()).limit(50).all()


class DiffViewerRequest(BaseModel):
    api_id: int
    environment_id: int

class DiffViewerResponse(BaseModel):
    api_name: str
    api_url: str
    backup_version: str
    backup_data: Any
    current_data: Any
    fetch_error: Optional[str] = None
    assertions: Optional[List[Any]] = None

@router.post("/diff-data", response_model=DiffViewerResponse)
def get_diff_viewer_data(req: DiffViewerRequest, db: Session = Depends(get_db)):
    """
    Fetches baseline backup response and live current response for a specific API
    to power the side-by-side diff viewer.
    """
    # 1. Look up the API
    is_complex = req.api_id < 0
    real_api_id = abs(req.api_id)
    
    if is_complex:
        api = db.query(ComplexAPI).filter(ComplexAPI.id == real_api_id, ComplexAPI.environment_id == req.environment_id).first()
    else:
        api = db.query(API).filter(API.id == real_api_id, API.environment_id == req.environment_id).first()
        
    if not api:
        raise HTTPException(status_code=404, detail="API not found in this environment.")

    # 2. Find latest baseline backup for this environment
    latest_backup = db.query(BaselineBackup)\
        .filter(BaselineBackup.environment_id == req.environment_id)\
        .order_by(BaselineBackup.backup_time.desc())\
        .first()

    backup_data = None
    backup_version = "No Baseline"

    if latest_backup:
        # Load backup metadata
        metadata_path = os.path.join(latest_backup.backup_path, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    backup_metadata = json.load(f)
                backup_apis = backup_metadata.get("apis", {})
                str_api_id = f"complex_{real_api_id}" if is_complex else str(real_api_id)
                
                if str_api_id in backup_apis:
                    backup_info = backup_apis[str_api_id]
                    baseline_filename = backup_info.get("filename")
                    baseline_filepath = os.path.join(latest_backup.backup_path, baseline_filename)
                    if os.path.exists(baseline_filepath):
                        with open(baseline_filepath, "r", encoding="utf-8") as f:
                            backup_data = json.load(f)
                        backup_version = latest_backup.backup_version
            except Exception as metadata_err:
                logger.warning(f"Error loading metadata files for diff viewer: {str(metadata_err)}")

    # 4. Fetch current live response
    current_data = None
    fetch_error = None
    try:
        from backend.app.services.curl_parser import substitute_variables
        from backend.app.models.models import GlobalVariable
        globals_db = db.query(GlobalVariable).all()
        globals_dict = {gv.key: gv.value for gv in globals_db}
        
        if is_complex:
            from backend.app.services.complex_api_service import execute_single_complex_api
            res = execute_single_complex_api(db, api)
            current_data = res["response"]
        else:
            api_url = substitute_variables(api.endpoint, globals_dict)
            response = http_requests.get(api_url, timeout=10)
            try:
                current_data = response.json()
            except ValueError:
                current_data = {"text_content": response.text}
    except Exception as e:
        fetch_error = f"Failed to fetch live response: {str(e)}"

    assertions = api.assertions if is_complex else None

    return DiffViewerResponse(
        api_name=api.name,
        api_url=api.curl_command if is_complex else api.endpoint,
        backup_version=backup_version,
        backup_data=backup_data,
        current_data=current_data,
        fetch_error=fetch_error,
        assertions=assertions
    )
