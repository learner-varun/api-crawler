import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.connection import get_db, SessionLocal
from backend.app.models.models import Settings, SchedulerSetting
from backend.app.schemas.schemas import (
    SettingsBase, SettingsResponse,
    SchedulerSettingCreate, SchedulerSettingUpdate, SchedulerSettingResponse
)
from backend.app.scheduler.scheduler import reschedule_all_jobs

from backend.app.utils.logger import get_logger

router = APIRouter(prefix="/settings", tags=["System Settings"])
logger = get_logger("settings_api")

@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings(execution_interval=24)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("", response_model=SettingsResponse)
def update_settings(settings_data: SettingsBase, db: Session = Depends(get_db)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)

    settings.execution_interval = settings_data.execution_interval
    settings.custom_interval = settings_data.custom_interval
    db.commit()
    db.refresh(settings)
    return settings

# ==========================================
# Scheduler Settings Endpoints (Max 100 cards)
# ==========================================

@router.get("/scheduler", response_model=List[SchedulerSettingResponse])
def get_scheduler_cards(db: Session = Depends(get_db)):
    return db.query(SchedulerSetting).order_by(SchedulerSetting.created_at.asc()).all()

@router.post("/scheduler", response_model=SchedulerSettingResponse, status_code=status.HTTP_201_CREATED)
def create_scheduler_card(card_data: SchedulerSettingCreate, db: Session = Depends(get_db)):
    # Enforce max 100 cards limit
    count = db.query(SchedulerSetting).count()
    if count >= 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum limit of 100 scheduler cards reached."
        )
    
    new_card = SchedulerSetting(
        name=card_data.name.strip(),
        time=card_data.time.strip()
    )
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    
    # Reschedule all validation jobs
    reschedule_all_jobs(db, SessionLocal)
    
    return new_card

@router.put("/scheduler/{card_id}", response_model=SchedulerSettingResponse)
def update_scheduler_card(card_id: int, card_data: SchedulerSettingUpdate, db: Session = Depends(get_db)):
    card = db.query(SchedulerSetting).filter(SchedulerSetting.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Scheduler card not found.")
        
    card.name = card_data.name.strip()
    card.time = card_data.time.strip()
    db.commit()
    db.refresh(card)
    
    # Reschedule all validation jobs
    reschedule_all_jobs(db, SessionLocal)
    
    return card

@router.delete("/scheduler/{card_id}", status_code=status.HTTP_200_OK)
def delete_scheduler_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(SchedulerSetting).filter(SchedulerSetting.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Scheduler card not found.")
        
    db.delete(card)
    db.commit()
    
    # Reschedule all validation jobs
    reschedule_all_jobs(db, SessionLocal)
    
    return {"message": "Scheduler card deleted successfully."}

# ==========================================
# Communication Settings Endpoints
# ==========================================

from backend.app.schemas.schemas import CommunicationSettingCreate, CommunicationSettingResponse
from backend.app.services.notification_service import get_active_config, send_test_notification_from_config
from backend.app.models.models import CommunicationSetting

@router.get("/communication", response_model=CommunicationSettingResponse)
def get_communication_settings(db: Session = Depends(get_db)):
    return get_active_config(db)

@router.put("/communication", response_model=CommunicationSettingResponse)
def update_communication_settings(config_data: CommunicationSettingCreate, db: Session = Depends(get_db)):
    config = db.query(CommunicationSetting).first()
    if not config:
        config = CommunicationSetting()
        db.add(config)
        
    config.channel = config_data.channel.strip().lower()
    config.webhook_url = config_data.webhook_url.strip() if config_data.webhook_url else None
    config.smtp_server = config_data.smtp_server.strip() if config_data.smtp_server else None
    config.smtp_port = config_data.smtp_port
    config.sender_email = config_data.sender_email.strip() if config_data.sender_email else None
    config.sender_password = config_data.sender_password.strip() if config_data.sender_password else None
    config.recipient_email = config_data.recipient_email.strip() if config_data.recipient_email else None
    
    db.commit()
    db.refresh(config)
    return config

@router.post("/communication/test")
def test_communication_settings(config_data: CommunicationSettingCreate):
    try:
        # Create a transient config object to test with
        transient_config = CommunicationSetting(
            channel=config_data.channel,
            webhook_url=config_data.webhook_url,
            smtp_server=config_data.smtp_server,
            smtp_port=config_data.smtp_port,
            sender_email=config_data.sender_email,
            sender_password=config_data.sender_password,
            recipient_email=config_data.recipient_email
        )
        send_test_notification_from_config(transient_config)
        return {"message": "Test notification sent successfully."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send test notification: {str(e)}"
        )

@router.post("/clear-data")
def clear_data(db: Session = Depends(get_db)):
    from backend.app.models.models import Environment, API, BaselineBackup, ExecutionHistory, FailureDetails
    from backend.app.services.backup_service import BACKUPS_ROOT

    try:
        # 1. Truncate SQLite records
        db.query(FailureDetails).delete()
        db.query(ExecutionHistory).delete()
        db.query(BaselineBackup).delete()
        db.query(API).delete()
        db.query(Environment).delete()
        db.query(Settings).delete()
        db.query(SchedulerSetting).delete()
        db.query(CommunicationSetting).delete()
        
        # Seed default Settings
        default_settings = Settings(execution_interval=24)
        db.add(default_settings)
        
        # Seed default SchedulerSetting
        default_scheduler = SchedulerSetting(name="Daily Midnight Check", time="12:00 AM")
        db.add(default_scheduler)
        
        # Seed default CommunicationSetting
        default_communication = CommunicationSetting(channel="none")
        db.add(default_communication)
        
        db.commit()

        # 3. Reschedule scheduler to default
        reschedule_all_jobs(db, SessionLocal)
        
        # 4. Wipe backups local folder
        if os.path.exists(BACKUPS_ROOT):
            shutil.rmtree(BACKUPS_ROOT, ignore_errors=True)
            os.makedirs(BACKUPS_ROOT, exist_ok=True)
            
        return {"message": "All application data cleared successfully."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to wipe application database: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something went wrong while wiping the application data. Please check server logs for details."
        )
