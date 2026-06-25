from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from backend.app.database.connection import get_db
from backend.app.models.models import API
from backend.app.schemas.schemas import APICreate, APIUpdate, APIResponse, ImportPreviewResponse
from backend.app.services.import_service import parse_and_validate_csv, commit_imported_apis

from backend.app.utils.logger import get_logger

router = APIRouter(prefix="/apis", tags=["API Registry"])
logger = get_logger("apis_api")

@router.get("", response_model=List[APIResponse])
def get_apis(environment_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(API)
    if environment_id is not None:
        query = query.filter(API.environment_id == environment_id)
    return query.order_by(API.id.desc()).all()

@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_api(api_data: APICreate, db: Session = Depends(get_db)):
    # Check duplicate name in this environment
    existing_name = db.query(API).filter(
        API.name == api_data.name, 
        API.environment_id == api_data.environment_id
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with name '{api_data.name}' already exists in this environment."
        )

    # Check duplicate endpoint in this environment
    existing_endpoint = db.query(API).filter(
        API.endpoint == api_data.endpoint,
        API.environment_id == api_data.environment_id
    ).first()
    if existing_endpoint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with endpoint '{api_data.endpoint}' already exists in this environment."
        )

    db_api = API(
        name=api_data.name, 
        endpoint=api_data.endpoint,
        environment_id=api_data.environment_id
    )
    db.add(db_api)
    db.commit()
    db.refresh(db_api)
    return db_api

@router.put("/{id}", response_model=APIResponse)
def update_api(id: int, api_data: APIUpdate, db: Session = Depends(get_db)):
    db_api = db.query(API).filter(API.id == id).first()
    if not db_api:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API not found.")

    # Check duplicate name in this environment
    existing_name = db.query(API).filter(
        API.name == api_data.name, 
        API.environment_id == api_data.environment_id, 
        API.id != id
    ).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with name '{api_data.name}' already exists in this environment."
        )

    # Check duplicate endpoint in this environment
    existing_endpoint = db.query(API).filter(
        API.endpoint == api_data.endpoint, 
        API.environment_id == api_data.environment_id, 
        API.id != id
    ).first()
    if existing_endpoint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with endpoint '{api_data.endpoint}' already exists in this environment."
        )

    db_api.name = api_data.name
    db_api.endpoint = api_data.endpoint
    db_api.environment_id = api_data.environment_id
    db.commit()
    db.refresh(db_api)
    return db_api

@router.delete("/{id}")
def delete_api(id: int, db: Session = Depends(get_db)):
    db_api = db.query(API).filter(API.id == id).first()
    if not db_api:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API not found.")

    db.delete(db_api)
    db.commit()
    return {"message": "API removed successfully from registry."}


# ==========================================
# CSV Import Routes
# ==========================================
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_csv_import(
    environment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Validate file extension
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Only .csv files are allowed."
        )

    # 2. Check file size limit
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 5 MB."
        )

    # 3. Decode contents
    try:
        csv_text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file encoding. File must be UTF-8 encoded CSV."
        )

    # 4. Parse & validate CSV
    try:
        preview_rows, can_import = parse_and_validate_csv(db, csv_text, environment_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    total = len(preview_rows)
    valid = sum(1 for r in preview_rows if r["is_valid"])
    invalid = total - valid

    return {
        "rows": preview_rows,
        "can_import": can_import,
        "total_rows": total,
        "valid_rows": valid,
        "invalid_rows": invalid
    }

@router.post("/import/commit", status_code=status.HTTP_201_CREATED)
def commit_csv_import(apis_list: List[APICreate], db: Session = Depends(get_db)):
    if not apis_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid APIs provided to import."
        )
        
    try:
        env_id = apis_list[0].environment_id
        valid_rows = []
        for item in apis_list:
            existing_name = db.query(API).filter(API.name == item.name, API.environment_id == env_id).first()
            existing_endpoint = db.query(API).filter(API.endpoint == item.endpoint, API.environment_id == env_id).first()
            if not existing_name and not existing_endpoint:
                valid_rows.append({"name": item.name, "endpoint": item.endpoint})
                
        if not valid_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All provided APIs already exist in the database for this environment."
            )
            
        commit_imported_apis(db, valid_rows, env_id)
        return {"message": f"Successfully imported {len(valid_rows)} APIs."}
    except Exception as e:
        logger.error(f"Failed to import APIs: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something went wrong while importing APIs. Please check server logs for details."
        )
