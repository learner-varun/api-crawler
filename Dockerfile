FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (like curl for API requests/healthchecks if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first to leverage Docker build cache
COPY backend/requirements.txt ./backend/requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend and frontend codebase
COPY backend ./backend
COPY frontend ./frontend

# Create a data directory inside the container for database and backups persistence
RUN mkdir -p /app/data

# Expose backend port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Command to run uvicorn server binding to 0.0.0.0
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
