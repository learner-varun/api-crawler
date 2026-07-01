from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import sessionmaker, Session
from backend.app.models.models import Environment, BaselineBackup, API, ComplexAPI, SchedulerSetting
from backend.app.services.validation_service import execute_validation
from backend.app.utils.logger import get_logger
from backend.app.utils.time_parser import parse_time_slot

logger = get_logger("scheduler")

# Instantiate global scheduler
scheduler = BackgroundScheduler()

def scheduled_validation_job(SessionLocal: sessionmaker):
    """
    Background worker job that runs validation checks on all environments.
    """
    logger.info("Scheduler execution triggered. Starting background validation check.")
    db = SessionLocal()
    try:
        environments = db.query(Environment).all()
        if not environments:
            logger.info("No environments configured. Skipping background validation.")
            return

        for env in environments:
            if not getattr(env, "schedule_enabled", True):
                logger.info(f"Skipping scheduled validation for {env.name}: Scheduling is disabled for this environment.")
                continue

            # Check if environment has standard APIs or complex APIs
            has_apis = db.query(API).filter(API.environment_id == env.id).first() is not None
            has_complex = db.query(ComplexAPI).filter(ComplexAPI.environment_id == env.id).first() is not None
            
            if not has_apis and not has_complex:
                logger.info(f"Skipping scheduled validation for {env.name}: No APIs configured.")
                continue

            if has_apis:
                has_backup = db.query(BaselineBackup)\
                    .filter(BaselineBackup.environment_id == env.id)\
                    .first() is not None
                if not has_backup:
                    logger.warning(
                        f"Skipping scheduled validation for {env.name}: No baseline backup found."
                    )
                    continue

            try:
                execute_validation(db, env.id)
            except Exception as e:
                logger.error(
                    f"Error running scheduled validation for {env.name}: {str(e)}"
                )
    except Exception as e:
        logger.critical(f"Critical error in scheduler worker: {str(e)}")
    finally:
        db.close()

def init_scheduler(SessionLocal: sessionmaker):
    """
    Initializes and starts the scheduler on FastAPI startup.
    Seeds default settings (daily validation at 12:00 AM) if none exist.
    """
    db = SessionLocal()
    try:
        # Check if we have scheduler settings, if not seed a default one
        settings = db.query(SchedulerSetting).all()
        if not settings:
            logger.info("No scheduler settings found. Seeding default 12:00 AM daily check.")
            default_setting = SchedulerSetting(name="Daily Midnight Check", time="12:00 AM")
            db.add(default_setting)
            db.commit()
            db.refresh(default_setting)
        
        # Start scheduler
        scheduler.start()
        logger.info("Scheduler background loop started.")
        
        # Load and register jobs
        reschedule_all_jobs(db, SessionLocal)
        
    except Exception as e:
        logger.error(f"Failed to initialize scheduler: {str(e)}")
    finally:
        db.close()

def reschedule_all_jobs(db: Session, SessionLocal: sessionmaker):
    """
    Clears all existing scheduled validation jobs and registers new jobs
    for each time card in the SchedulerSetting table.
    """
    try:
        # Remove existing validation jobs
        for job in list(scheduler.get_jobs()):
            if job.id.startswith("api_crawler_validation_job_"):
                scheduler.remove_job(job.id)
                logger.info(f"Removed job: {job.id}")
                
        # Query all active scheduler cards
        cards = db.query(SchedulerSetting).all()
        
        for card in cards:
            try:
                hour, minute = parse_time_slot(card.time)
                job_id = f"api_crawler_validation_job_{card.id}"
                
                scheduler.add_job(
                    scheduled_validation_job,
                    CronTrigger(hour=hour, minute=minute),
                    args=[SessionLocal],
                    id=job_id,
                    replace_existing=True,
                    misfire_grace_time=3600  # Run job if it was missed within the last 1 hour
                )
                logger.info(f"Successfully scheduled job '{card.name}' (ID: {card.id}) for daily execution at {hour:02d}:{minute:02d} (Time slot: {card.time})")
            except Exception as parse_err:
                logger.error(f"Failed to schedule job '{card.name}' at '{card.time}': {str(parse_err)}")
                
    except Exception as e:
        logger.error(f"Error rescheduling validation jobs: {str(e)}")
