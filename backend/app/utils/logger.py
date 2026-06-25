import os
import logging
from logging.handlers import RotatingFileHandler

# Define logs directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(os.path.dirname(BASE_DIR), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "api_crawler.log")

# Setup formatter
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
formatter = logging.Formatter(LOG_FORMAT)

# Base Logger
logger = logging.getLogger("api_crawler")
logger.setLevel(logging.INFO)

# Avoid adding duplicate handlers if re-imported
if not logger.handlers:
    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File Handler with rotation (10 MB max size, keeping 5 backups)
    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

def get_logger(module_name: str):
    """
    Returns a child logger for the specific module.
    """
    return logger.getChild(module_name)
