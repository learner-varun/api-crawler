from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database.connection import get_db
from backend.app.models.models import ComplexAPI, Environment
from backend.app.schemas.schemas import ComplexAPICreate, ComplexAPIUpdate, ComplexAPIResponse

router = APIRouter(prefix="/complex-apis", tags=["Complex APIs"])

@router.get("", response_model=List[ComplexAPIResponse])
def get_all_complex_apis(environment_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ComplexAPI)
    if environment_id:
        query = query.filter(ComplexAPI.environment_id == environment_id)
    return query.order_by(ComplexAPI.name).all()

@router.post("", response_model=ComplexAPIResponse, status_code=status.HTTP_201_CREATED)
def create_complex_api(api: ComplexAPICreate, db: Session = Depends(get_db)):
    env = db.query(Environment).filter(Environment.id == api.environment_id).first()
    if not env:
        raise HTTPException(status_code=400, detail="Environment not found")
    
    rules = [r.dict() for r in api.extract_rules] if api.extract_rules else None
    assertions = [a.dict() for a in api.assertions] if api.assertions else None
    
    new_api = ComplexAPI(
        environment_id=api.environment_id,
        name=api.name,
        curl_command=api.curl_command,
        extract_rules=rules,
        assertions=assertions
    )
    db.add(new_api)
    db.commit()
    db.refresh(new_api)
    return new_api

@router.put("/{api_id}", response_model=ComplexAPIResponse)
def update_complex_api(api_id: int, api: ComplexAPIUpdate, db: Session = Depends(get_db)):
    existing = db.query(ComplexAPI).filter(ComplexAPI.id == api_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Complex API not found")
        
    env = db.query(Environment).filter(Environment.id == api.environment_id).first()
    if not env:
        raise HTTPException(status_code=400, detail="Environment not found")
        
    rules = [r.dict() for r in api.extract_rules] if api.extract_rules else None
    assertions = [a.dict() for a in api.assertions] if api.assertions else None
    
    existing.environment_id = api.environment_id
    existing.name = api.name
    existing.curl_command = api.curl_command
    existing.extract_rules = rules
    existing.assertions = assertions
    
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/{api_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_complex_api(api_id: int, db: Session = Depends(get_db)):
    existing = db.query(ComplexAPI).filter(ComplexAPI.id == api_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Complex API not found")
    
    db.delete(existing)
    db.commit()
    return None

@router.post("/{api_id}/execute")
def execute_complex_api(api_id: int, db: Session = Depends(get_db)):
    from backend.app.services.complex_api_service import execute_single_complex_api, validate_assertion_rules
    from backend.app.services.curl_parser import parse_curl_command, substitute_variables
    from backend.app.models.models import GlobalVariable
    
    api = db.query(ComplexAPI).filter(ComplexAPI.id == api_id).first()
    if not api:
        raise HTTPException(status_code=404, detail="Complex API not found")
        
    globals_db = db.query(GlobalVariable).all()
    globals_dict = {gv.key: gv.value for gv in globals_db}
    
    request_info = {"method": "UNKNOWN", "url": "", "headers": {}, "data": None}
    response_info = None
    failures = []
    error_msg = None
    success = False
    extractions = []
    
    try:
        try:
            req_params = parse_curl_command(api.curl_command)
            url = substitute_variables(req_params["url"], globals_dict)
            headers = {k: substitute_variables(v, globals_dict) for k, v in req_params["headers"].items()}
            data = req_params["data"]
            if data:
                data = substitute_variables(data, globals_dict)
            request_info = {
                "method": req_params["method"],
                "url": url,
                "headers": headers,
                "data": data
            }
        except Exception as pe:
            error_msg = f"Failed to parse cURL command: {str(pe)}"
            raise pe
            
        res = execute_single_complex_api(db, api)
        
        raw_resp = res.get("raw_response")
        if raw_resp is not None:
            response_info = {
                "status_code": raw_resp.status_code,
                "body": res.get("response"),
                "headers": dict(raw_resp.headers)
            }
            
            if api.assertions:
                failures = validate_assertion_rules(raw_resp, api.assertions, db)
                success = len(failures) == 0
                error_msg = "Assertion failures" if not success else None
            else:
                success = 200 <= raw_resp.status_code < 300
                error_msg = f"HTTP Error Status {raw_resp.status_code}" if not success else None
        else:
            response_info = {
                "status_code": res.get("status_code", 200),
                "body": res.get("response"),
                "headers": {}
            }
            success = 200 <= response_info["status_code"] < 300
            
        extractions = res.get("extractions", [])
        
    except Exception as e:
        if not error_msg:
            error_msg = f"Request failed: {str(e)}"
            
    return {
        "success": success,
        "error": error_msg,
        "request": request_info,
        "response": response_info,
        "extractions": extractions,
        "assertions": api.assertions or [],
        "failures": failures
    }
