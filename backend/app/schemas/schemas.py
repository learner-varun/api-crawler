from pydantic import BaseModel, Field, field_validator, HttpUrl
from typing import List, Optional, Any
from datetime import datetime

# ==========================================
# Environment Schemas
# ==========================================
class EnvironmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Unique name of the environment")
    base_url: str = Field(..., description="Valid Base URL (HTTPS preferred)")
    schedule_enabled: Optional[bool] = Field(True, description="Whether scheduled jobs are run for this environment")

    @field_validator("base_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        # Strip whitespace and trailing slash for consistency
        val = v.strip().rstrip("/")
        if not (val.startswith("http://") or val.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return val

class EnvironmentCreate(EnvironmentBase):
    pass

class EnvironmentUpdate(EnvironmentBase):
    pass

class EnvironmentResponse(EnvironmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# API Schemas
# ==========================================
class APIBase(BaseModel):
    environment_id: int = Field(..., description="Target environment ID")
    name: str = Field(..., min_length=1, max_length=100, description="API Name")
    endpoint: str = Field(..., description="Endpoint absolute URL")

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        val = v.strip()
        if not (val.startswith("http://") or val.startswith("https://")):
            raise ValueError("Endpoint must start with 'http://' or 'https://'")
        return val

class APICreate(APIBase):
    pass

class APIUpdate(APIBase):
    pass

class APIResponse(APIBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Baseline Backup Schemas
# ==========================================
class BaselineBackupResponse(BaseModel):
    id: int
    environment_id: int
    backup_version: str
    backup_time: datetime
    backup_path: str

    class Config:
        from_attributes = True


# ==========================================
# Execution History & Failure Details Schemas
# ==========================================
class FailureDetailsResponse(BaseModel):
    id: int
    execution_id: int
    api_id: Optional[int] = None
    api_name: str
    api_url: str
    difference: Optional[List[Any]] = None
    failure_reason: str

    class Config:
        from_attributes = True

class ExecutionHistoryResponse(BaseModel):
    id: int
    environment_id: int
    execution_time: datetime
    total_apis: int
    passed: int
    failed: int
    status: str
    failures: List[FailureDetailsResponse] = []

    class Config:
        from_attributes = True


# ==========================================
# Settings Schemas
# ==========================================
class SettingsBase(BaseModel):
    execution_interval: int = Field(..., description="12 or 24 or 0 (for custom)")
    custom_interval: Optional[int] = Field(None, description="Custom interval in hours (1-720)")

    @field_validator("custom_interval")
    @classmethod
    def validate_custom_interval(cls, v: Optional[int], info) -> Optional[int]:
        interval = info.data.get("execution_interval")
        if interval == 0:
            if v is None:
                raise ValueError("Custom interval is required when custom frequency is selected")
            if v < 1 or v > 720:
                raise ValueError("Custom interval must be between 1 and 720 hours")
        return v

class SettingsResponse(SettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# CSV Import Schemas
# ==========================================
class ImportPreviewRow(BaseModel):
    serial_number: int
    name: str
    endpoint: str
    is_valid: bool
    error_message: Optional[str] = None

class ImportPreviewResponse(BaseModel):
    rows: List[ImportPreviewRow]
    can_import: bool
    total_rows: int
    valid_rows: int
    invalid_rows: int


# ==========================================
# Dashboard Response Schemas
# ==========================================
class EnvironmentDashboardStats(BaseModel):
    environment_id: int
    environment_name: str
    base_url: str
    schedule_enabled: bool
    has_baseline: bool
    last_backup_version: Optional[str] = None
    last_backup_time: Optional[datetime] = None
    last_execution_time: Optional[datetime] = None
    last_execution_status: Optional[str] = None
    total_apis: int
    passed_apis: int
    failed_apis: int
    pass_percentage: float
    failures: List[FailureDetailsResponse] = []

class DashboardSummaryResponse(BaseModel):
    last_backup_overall: Optional[datetime] = None
    last_execution_overall: Optional[datetime] = None
    environments: List[EnvironmentDashboardStats]


# ==========================================
# Global Variables Schemas
# ==========================================
class GlobalVariableBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)

class GlobalVariableCreate(GlobalVariableBase):
    value: str

class GlobalVariableUpdate(BaseModel):
    value: str

class GlobalVariableResponse(GlobalVariableBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Note: 'value' is intentionally omitted here to hide it in the UI list

    class Config:
        from_attributes = True


# ==========================================
# Complex API Schemas
# ==========================================
class ComplexAPIExtractRule(BaseModel):
    json_path: str = Field(..., description="Dot notation path, e.g., data.user.id")
    variable_key: str = Field(..., description="Global variable key to store the extracted value")

class ComplexAPIAssertionRule(BaseModel):
    type: str = Field(..., description="Assertion type, e.g., status_code, json_path_equals")
    path: Optional[str] = Field(None, description="Optional path for headers or JSON paths")
    expected: Optional[Any] = Field(None, description="Expected value")

class ComplexAPIBase(BaseModel):
    environment_id: int
    name: str = Field(..., min_length=1, max_length=100)
    curl_command: str = Field(..., description="Full curl command string")
    extract_rules: Optional[List[ComplexAPIExtractRule]] = None
    assertions: Optional[List[ComplexAPIAssertionRule]] = None

class ComplexAPICreate(ComplexAPIBase):
    pass

class ComplexAPIUpdate(ComplexAPIBase):
    pass

class ComplexAPIResponse(ComplexAPIBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Scheduler Setting Schemas
# ==========================================
class SchedulerSettingBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Scheduler Job Name")
    time: str = Field(..., description="Selected time slot, e.g. 12:00 AM, 2:35 AM, 2 PM, 14:35")

    @field_validator("time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        try:
            from backend.app.utils.time_parser import parse_time_slot
            parse_time_slot(v)
            return v.strip()
        except Exception as e:
            raise ValueError(str(e))

class SchedulerSettingCreate(SchedulerSettingBase):
    pass

class SchedulerSettingUpdate(SchedulerSettingBase):
    pass

class SchedulerSettingResponse(SchedulerSettingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Communication Setting Schemas
# ==========================================
class CommunicationSettingBase(BaseModel):
    channel: str = Field(..., description="Notification channel: none, email, slack, teams")
    webhook_url: Optional[str] = Field(None, description="Slack or Teams webhook URL")
    smtp_server: Optional[str] = Field(None, description="SMTP server address")
    smtp_port: Optional[int] = Field(None, description="SMTP port")
    sender_email: Optional[str] = Field(None, description="Sender email address")
    sender_password: Optional[str] = Field(None, description="Sender email password / app password")
    recipient_email: Optional[str] = Field(None, description="Recipient email address")

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        channel_val = v.strip().lower()
        if channel_val not in ["none", "email", "slack", "teams"]:
            raise ValueError("Channel must be 'none', 'email', 'slack', or 'teams'")
        return channel_val

class CommunicationSettingCreate(CommunicationSettingBase):
    pass

class CommunicationSettingUpdate(CommunicationSettingBase):
    pass

class CommunicationSettingResponse(CommunicationSettingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
