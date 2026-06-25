import os
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import BaselineBackup
from backend.app.schemas.schemas import BaselineBackupResponse
from backend.app.services.backup_service import create_baseline_backup

router = APIRouter(prefix="/backup", tags=["Backups"])

class BackupRequest(BaseModel):
    environment_id: int

@router.post("", response_model=BaselineBackupResponse, status_code=status.HTTP_201_CREATED)
def trigger_backup(req: BackupRequest, db: Session = Depends(get_db)):
    try:
        backup = create_baseline_backup(db, req.environment_id)
        return backup
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during baseline backup: {str(e)}"
        )

@router.get("", response_model=List[BaselineBackupResponse])
def get_backups(db: Session = Depends(get_db)):
    return db.query(BaselineBackup).order_by(BaselineBackup.backup_time.desc()).all()

from fastapi.responses import FileResponse
from fastapi import BackgroundTasks
import tempfile
import shutil

def remove_temp_file(filepath: str):
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass

@router.get("/download/{id}")
def download_backup_archive(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Creates a zip archive of the backup folder and returns it as a downloadable file.
    Deletes the temporary zip archive after transmission.
    """
    backup = db.query(BaselineBackup).filter(BaselineBackup.id == id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup version not found.")

    if not os.path.exists(backup.backup_path):
        raise HTTPException(status_code=404, detail="Backup files not found on disk.")

    # Create temporary zip file base path
    temp_dir = tempfile.gettempdir()
    zip_base_path = os.path.join(temp_dir, f"backup_{backup.backup_version}")

    try:
        # shutil.make_archive compiles files under root_dir into a zip format and appends .zip suffix
        zip_filepath = shutil.make_archive(
            base_name=zip_base_path,
            format="zip",
            root_dir=backup.backup_path
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate backup archive: {str(e)}"
        )

    # Schedule file cleanup after download completes
    background_tasks.add_task(remove_temp_file, zip_filepath)

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    return FileResponse(
        path=zip_filepath,
        filename=f"backup_{backup.backup_version}.zip",
        media_type="application/zip",
        headers=headers
    )

@router.delete("/{id}")
def delete_backup(id: int, db: Session = Depends(get_db)):
    backup = db.query(BaselineBackup).filter(BaselineBackup.id == id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found.")
        
    # Check if there are other backups left for this environment
    count = db.query(BaselineBackup).filter(BaselineBackup.environment_id == backup.environment_id).count()
    if count <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove this backup. It is the only available baseline checkpoint for this environment."
        )

    # Delete local files
    import shutil
    if os.path.exists(backup.backup_path):
        shutil.rmtree(backup.backup_path, ignore_errors=True)
        
    db.delete(backup)
    db.commit()
    return {"message": "Baseline backup deleted successfully."}
