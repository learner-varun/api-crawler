from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Environment, BaselineBackup, ExecutionHistory, FailureDetails
from backend.app.schemas.schemas import DashboardSummaryResponse, EnvironmentDashboardStats, FailureDetailsResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    environments = db.query(Environment).all()
    
    # Global metrics
    overall_last_backup: Optional[datetime] = None
    overall_last_execution: Optional[datetime] = None
    
    latest_backup_global = db.query(BaselineBackup).order_by(BaselineBackup.backup_time.desc()).first()
    if latest_backup_global:
        overall_last_backup = latest_backup_global.backup_time

    latest_execution_global = db.query(ExecutionHistory).order_by(ExecutionHistory.execution_time.desc()).first()
    if latest_execution_global:
        overall_last_execution = latest_execution_global.execution_time

    env_stats_list = []
    
    # Query API counts
    from backend.app.models.models import API
    total_registered_apis = db.query(API).count()

    for env in environments:
        # Latest backup for this environment
        latest_backup = db.query(BaselineBackup)\
            .filter(BaselineBackup.environment_id == env.id)\
            .order_by(BaselineBackup.backup_time.desc())\
            .first()
            
        # Latest execution for this environment
        latest_execution = db.query(ExecutionHistory)\
            .filter(ExecutionHistory.environment_id == env.id)\
            .order_by(ExecutionHistory.execution_time.desc())\
            .first()

        has_baseline = latest_backup is not None
        backup_version = latest_backup.backup_version if latest_backup else None
        backup_time = latest_backup.backup_time if latest_backup else None
        
        exec_time = None
        exec_status = None
        passed_apis = 0
        failed_apis = 0
        total_apis = 0
        pass_percentage = 0.0
        failures = []

        if latest_execution:
            exec_time = latest_execution.execution_time
            exec_status = latest_execution.status
            total_apis = latest_execution.total_apis
            passed_apis = latest_execution.passed
            failed_apis = latest_execution.failed
            
            if total_apis > 0:
                pass_percentage = round((passed_apis / total_apis) * 100.0, 1)
            else:
                pass_percentage = 100.0

            # Load failures for this run
            failures_db = db.query(FailureDetails)\
                .filter(FailureDetails.execution_id == latest_execution.id)\
                .all()
            
            failures = [
                FailureDetailsResponse(
                    id=f.id,
                    execution_id=f.execution_id,
                    api_id=f.api_id,
                    api_name=f.api_name,
                    api_url=f.api_url,
                    difference=f.difference,
                    failure_reason=f.failure_reason
                )
                for f in failures_db
            ]
        else:
            # If no validation run yet, check if there are APIs to know total count
            total_apis = total_registered_apis
            pass_percentage = 0.0

        env_stats_list.append(
            EnvironmentDashboardStats(
                environment_id=env.id,
                environment_name=env.name,
                base_url=env.base_url,
                schedule_enabled=getattr(env, "schedule_enabled", True) if getattr(env, "schedule_enabled", True) is not None else True,
                has_baseline=has_baseline,
                last_backup_version=backup_version,
                last_backup_time=backup_time,
                last_execution_time=exec_time,
                last_execution_status=exec_status,
                total_apis=total_apis,
                passed_apis=passed_apis,
                failed_apis=failed_apis,
                pass_percentage=pass_percentage,
                failures=failures
            )
        )

    return DashboardSummaryResponse(
        last_backup_overall=overall_last_backup,
        last_execution_overall=overall_last_execution,
        environments=env_stats_list
    )
