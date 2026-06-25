import csv
import io
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.models.models import API
from backend.app.utils.logger import get_logger

logger = get_logger("import_service")

def parse_and_validate_csv(db: Session, csv_content: str, environment_id: int) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Parses CSV content, validates each row, and flags errors.
    Returns:
        - List of preview rows (dict)
        - can_import boolean (True if all rows are valid, False otherwise)
    """
    # Use io.StringIO to parse csv text
    csv_file = io.StringIO(csv_content.strip())
    reader = csv.reader(csv_file)

    try:
        headers = next(reader)
    except StopIteration:
        raise ValueError("CSV file is empty.")

    # Validate headers
    # Ensure they are lowercase and stripped
    headers = [h.strip().lower() for h in headers]
    if "name" not in headers or "endpoint" not in headers:
        raise ValueError("CSV is missing required columns. Headers must contain 'name' and 'endpoint'.")

    name_idx = headers.index("name")
    endpoint_idx = headers.index("endpoint")

    # Fetch existing APIs from database for duplicate checking within this environment
    existing_apis = db.query(API).filter(API.environment_id == environment_id).all()
    db_names = {api.name.strip().lower() for api in existing_apis}
    db_endpoints = {api.endpoint.strip().lower() for api in existing_apis}

    seen_names = set()
    seen_endpoints = set()
    preview_rows = []
    can_import = True

    serial_number = 1
    for row in reader:
        if not row:
            continue  # Skip empty lines

        # Pad row elements if length is shorter than index
        name = row[name_idx].strip() if len(row) > name_idx else ""
        endpoint = row[endpoint_idx].strip() if len(row) > endpoint_idx else ""

        is_valid = True
        error_message = None

        # 1. Check for empty values
        if not name or not endpoint:
            is_valid = False
            error_message = "Empty value in name or endpoint"
        
        # 2. Validate endpoint format (must be absolute URL)
        elif not (endpoint.startswith("http://") or endpoint.startswith("https://")):
            is_valid = False
            error_message = "Endpoint must start with 'http://' or 'https://'"
            
        # 3. Check for duplicates within the uploaded CSV file
        elif name.lower() in seen_names:
            is_valid = False
            error_message = f"Duplicate name in CSV: '{name}'"
        elif endpoint.lower() in seen_endpoints:
            is_valid = False
            error_message = f"Duplicate endpoint in CSV: '{endpoint}'"

        # 4. Check for duplicates against the SQLite database under this environment
        elif name.lower() in db_names:
            is_valid = False
            error_message = f"API name already exists in this environment: '{name}'"
        elif endpoint.lower() in db_endpoints:
            is_valid = False
            error_message = f"API endpoint already exists in this environment: '{endpoint}'"

        # Record seen values for internal CSV duplicate validation
        if name:
            seen_names.add(name.lower())
        if endpoint:
            seen_endpoints.add(endpoint.lower())

        if not is_valid:
            can_import = False

        preview_rows.append({
            "serial_number": serial_number,
            "name": name,
            "endpoint": endpoint,
            "is_valid": is_valid,
            "error_message": error_message
        })
        serial_number += 1

    # If no rows found after header
    if not preview_rows:
        raise ValueError("CSV contains header but no API rows.")

    return preview_rows, can_import

def commit_imported_apis(db: Session, valid_rows: List[Dict[str, Any]], environment_id: int) -> List[API]:
    """
    Saves validated API list to the database.
    """
    apis_to_create = []
    for row in valid_rows:
        api = API(
            name=row["name"],
            endpoint=row["endpoint"],
            environment_id=environment_id
        )
        db.add(api)
        apis_to_create.append(api)
        
    db.commit()
    for api in apis_to_create:
        db.refresh(api)
        
    logger.info(f"Successfully imported {len(apis_to_create)} new APIs from CSV to environment ID {environment_id}.")
    return apis_to_create
