from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.connection import get_db
from backend.app.models.models import Environment
from backend.app.schemas.schemas import EnvironmentCreate, EnvironmentUpdate, EnvironmentResponse

router = APIRouter(prefix="/environments", tags=["Environments"])

@router.get("", response_model=List[EnvironmentResponse])
def get_environments(db: Session = Depends(get_db)):
    return db.query(Environment).all()

@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(env_data: EnvironmentCreate, db: Session = Depends(get_db)):
    # 1. Enforce environment count limit (maximum of 4 environments)
    env_count = db.query(Environment).count()
    if env_count >= 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum limit of 4 environments reached."
        )

    # 2. Check for duplicate name
    existing_name = db.query(Environment).filter(Environment.name == env_data.name).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment name '{env_data.name}' already exists."
        )

    # 3. Check for duplicate base URL
    existing_url = db.query(Environment).filter(Environment.base_url == env_data.base_url).first()
    if existing_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Base URL '{env_data.base_url}' is already in use by another environment."
        )

    # 4. Create environment
    db_env = Environment(
        name=env_data.name,
        base_url=env_data.base_url,
        schedule_enabled=env_data.schedule_enabled if env_data.schedule_enabled is not None else True
    )
    db.add(db_env)
    db.commit()
    db.refresh(db_env)
    return db_env

@router.put("/{id}", response_model=EnvironmentResponse)
def update_environment(id: int, env_data: EnvironmentUpdate, db: Session = Depends(get_db)):
    db_env = db.query(Environment).filter(Environment.id == id).first()
    if not db_env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found.")

    # Check duplicate name
    existing_name = db.query(Environment).filter(Environment.name == env_data.name, Environment.id != id).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment name '{env_data.name}' is already in use."
        )

    # Check duplicate base URL
    existing_url = db.query(Environment).filter(Environment.base_url == env_data.base_url, Environment.id != id).first()
    if existing_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Base URL '{env_data.base_url}' is already in use."
        )

    db_env.name = env_data.name
    db_env.base_url = env_data.base_url
    if env_data.schedule_enabled is not None:
        db_env.schedule_enabled = env_data.schedule_enabled
    db.commit()
    db.refresh(db_env)
    return db_env

@router.delete("/{id}")
def delete_environment(id: int, db: Session = Depends(get_db)):
    db_env = db.query(Environment).filter(Environment.id == id).first()
    if not db_env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found.")

    db.delete(db_env)
    db.commit()
    return {"message": "Environment removed successfully."}
