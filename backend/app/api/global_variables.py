from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.connection import get_db
from backend.app.models.models import GlobalVariable
from backend.app.schemas.schemas import GlobalVariableCreate, GlobalVariableUpdate, GlobalVariableResponse

router = APIRouter(prefix="/global-variables", tags=["Global Variables"])

@router.get("", response_model=List[GlobalVariableResponse])
def get_all_variables(db: Session = Depends(get_db)):
    return db.query(GlobalVariable).order_by(GlobalVariable.key).all()

@router.post("", response_model=GlobalVariableResponse, status_code=status.HTTP_201_CREATED)
def create_variable(var: GlobalVariableCreate, db: Session = Depends(get_db)):
    existing = db.query(GlobalVariable).filter(GlobalVariable.key == var.key).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Variable with key '{var.key}' already exists.")
    
    new_var = GlobalVariable(key=var.key, value=var.value)
    db.add(new_var)
    db.commit()
    db.refresh(new_var)
    return new_var

@router.put("/{var_id}", response_model=GlobalVariableResponse)
def update_variable(var_id: int, var: GlobalVariableUpdate, db: Session = Depends(get_db)):
    existing = db.query(GlobalVariable).filter(GlobalVariable.id == var_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    existing.value = var.value
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/{var_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variable(var_id: int, db: Session = Depends(get_db)):
    existing = db.query(GlobalVariable).filter(GlobalVariable.id == var_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    db.delete(existing)
    db.commit()
    return None
