from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base

class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    base_url = Column(String, unique=True, nullable=False)
    schedule_enabled = Column(Integer, default=1, nullable=False)  # Using Integer (0/1) for robust SQLite boolean support
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    backups = relationship("BaselineBackup", back_populates="environment", cascade="all, delete-orphan")
    executions = relationship("ExecutionHistory", back_populates="environment", cascade="all, delete-orphan")
    apis = relationship("API", back_populates="environment", cascade="all, delete-orphan")


class API(Base):
    __tablename__ = "apis"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    endpoint = Column(String, nullable=False)  # Must be absolute URL
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    environment = relationship("Environment", back_populates="apis")


class BaselineBackup(Base):
    __tablename__ = "baseline_backups"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    backup_version = Column(String, nullable=False)  # e.g., "2026-06-24_10-00-00"
    backup_time = Column(DateTime, default=datetime.utcnow)
    backup_path = Column(String, nullable=False)  # Path to folder containing JSON responses

    # Relationships
    environment = relationship("Environment", back_populates="backups")


class ExecutionHistory(Base):
    __tablename__ = "execution_history"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    execution_time = Column(DateTime, default=datetime.utcnow)
    total_apis = Column(Integer, nullable=False, default=0)
    passed = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False)  # "PASSED", "FAILED", "ERROR"

    # Relationships
    environment = relationship("Environment", back_populates="executions")
    failures = relationship("FailureDetails", back_populates="execution", cascade="all, delete-orphan")


class FailureDetails(Base):
    __tablename__ = "failure_details"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("execution_history.id", ondelete="CASCADE"), nullable=False)
    api_id = Column(Integer, nullable=True)  # Nullable if API is deleted
    api_name = Column(String, nullable=False)
    api_url = Column(String, nullable=False)
    difference = Column(JSON, nullable=True)  # List of diff items
    failure_reason = Column(Text, nullable=False)  # e.g. "Status Code Mismatch", "Missing Key", "Timeout"

    # Relationships
    execution = relationship("ExecutionHistory", back_populates="failures")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    execution_interval = Column(Integer, nullable=False, default=24)  # Hours, e.g. 12, 24, or 0 for custom
    custom_interval = Column(Integer, nullable=True)  # Hours, custom value if execution_interval is 0
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GlobalVariable(Base):
    __tablename__ = "global_variables"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ComplexAPI(Base):
    __tablename__ = "complex_apis"

    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    curl_command = Column(Text, nullable=False)
    extract_rules = Column(JSON, nullable=True) # list of rules, e.g., [{"json_path": "data.token", "variable_key": "auth_token"}]
    assertions = Column(JSON, nullable=True) # list of assertions, e.g., [{"type": "status_code", "expected": 200}]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    environment = relationship("Environment")


class SchedulerSetting(Base):
    __tablename__ = "scheduler_settings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    time = Column(String, nullable=False)  # Store time like "12:00 AM", "2:35 AM", "2:00 PM"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CommunicationSetting(Base):
    __tablename__ = "communication_settings"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String, default="none")  # "none", "email", "slack", "teams"
    
    # Slack/Teams config
    webhook_url = Column(String, nullable=True)
    
    # Email config
    smtp_server = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    sender_email = Column(String, nullable=True)
    sender_password = Column(String, nullable=True)
    recipient_email = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
