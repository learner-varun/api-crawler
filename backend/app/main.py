import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from backend.app.database.connection import engine, Base, SessionLocal
from backend.app.scheduler.scheduler import init_scheduler, scheduler
from backend.app.api import dashboard, environments, apis, backups, settings, validation, global_variables, complex_apis
from backend.app.utils.logger import get_logger

logger = get_logger("main")

# Setup Lifespan Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing API-Crawler backend...")
    
    # Create database tables
    try:
        from sqlalchemy import text
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
        
        # Safe migration: Add assertions column if not exists
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE complex_apis ADD COLUMN assertions JSON"))
                logger.info("Database migration: Added 'assertions' column to complex_apis table.")
            except Exception as migration_error:
                # Catch OperationalError if column already exists
                if "duplicate column name" in str(migration_error).lower() or "already exists" in str(migration_error).lower():
                    pass
                else:
                    logger.error(f"Database migration warnings: {str(migration_error)}")

            try:
                conn.execute(text("ALTER TABLE environments ADD COLUMN schedule_enabled INTEGER DEFAULT 1"))
                logger.info("Database migration: Added 'schedule_enabled' column to environments table.")
            except Exception as migration_error:
                if "duplicate column name" in str(migration_error).lower() or "already exists" in str(migration_error).lower():
                    pass
                else:
                    logger.error(f"Database migration warnings: {str(migration_error)}")

            try:
                conn.execute(text("ALTER TABLE complex_apis ADD COLUMN pre_request_script TEXT"))
                logger.info("Database migration: Added 'pre_request_script' column to complex_apis table.")
            except Exception as migration_error:
                if "duplicate column name" in str(migration_error).lower() or "already exists" in str(migration_error).lower():
                    pass
                else:
                    logger.error(f"Database migration warnings: {str(migration_error)}")

            try:
                conn.execute(text("ALTER TABLE complex_apis ADD COLUMN post_request_script TEXT"))
                logger.info("Database migration: Added 'post_request_script' column to complex_apis table.")
            except Exception as migration_error:
                if "duplicate column name" in str(migration_error).lower() or "already exists" in str(migration_error).lower():
                    pass
                else:
                    logger.error(f"Database migration warnings: {str(migration_error)}")
    except Exception as e:
        logger.critical(f"Database initialization failed: {str(e)}")

    # Initialize scheduler
    try:
        init_scheduler(SessionLocal)
    except Exception as e:
        logger.error(f"Failed to start scheduler on startup: {str(e)}")

    yield

    # Shutdown actions
    logger.info("Shutting down API-Crawler backend...")
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down.")


app = FastAPI(
    title="API-Crawler Backend",
    description="Core backend for managing environment-specific baselines and comparing live API payloads.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend development support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(dashboard.router, prefix="/api")
app.include_router(environments.router, prefix="/api")
app.include_router(apis.router, prefix="/api")
app.include_router(backups.router, prefix="/api")
app.include_router(validation.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(global_variables.router, prefix="/api")
app.include_router(complex_apis.router, prefix="/api")

# Serve frontend SPA static files
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend")
)

# Create frontend folder structure if not exist just to prevent crashes
os.makedirs(FRONTEND_DIR, exist_ok=True)
os.makedirs(os.path.join(FRONTEND_DIR, "css"), exist_ok=True)
os.makedirs(os.path.join(FRONTEND_DIR, "js"), exist_ok=True)
os.makedirs(os.path.join(FRONTEND_DIR, "assets"), exist_ok=True)

# Mount the static directory
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
