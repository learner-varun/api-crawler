from typing import Any, List, Dict

def compare_responses(baseline: Any, live: Any, path: str = "") -> List[Dict[str, Any]]:
    """
    Recursively compare baseline and live JSON responses.
    Returns a list of diff dictionaries detailing the differences.
    """
    diffs = []
    
    # 1. Type mismatch
    if type(baseline) != type(live):
        # Allow integer vs float comparison if mathematically equivalent (e.g. 5 vs 5.0)
        if isinstance(baseline, (int, float)) and isinstance(live, (int, float)) and baseline == live:
            return diffs
            
        diffs.append({
            "field": path or "root",
            "expected": f"Type: {type(baseline).__name__} ({str(baseline)[:100]})",
            "actual": f"Type: {type(live).__name__} ({str(live)[:100]})",
            "reason": "Response Structure Changed"
        })
        return diffs

    # 2. Dictionary structure comparison
    if isinstance(baseline, dict):
        baseline_keys = set(baseline.keys())
        live_keys = set(live.keys())
        
        # Missing keys in live response
        missing_keys = baseline_keys - live_keys
        for key in missing_keys:
            key_path = f"{path}.{key}" if path else key
            diffs.append({
                "field": key_path,
                "expected": f"Key '{key}' with value: {str(baseline[key])[:100]}",
                "actual": "Key missing",
                "reason": "Missing Key"
            })
            
        # Additional keys in live response
        additional_keys = live_keys - baseline_keys
        for key in additional_keys:
            key_path = f"{path}.{key}" if path else key
            diffs.append({
                "field": key_path,
                "expected": "Key absent",
                "actual": f"Key '{key}' with value: {str(live[key])[:100]}",
                "reason": "Response Structure Changed"
            })
            
        # Common keys recursive comparison
        common_keys = baseline_keys & live_keys
        for key in common_keys:
            key_path = f"{path}.{key}" if path else key
            diffs.extend(compare_responses(baseline[key], live[key], key_path))

    # 3. List comparison
    elif isinstance(baseline, list):
        # Check array length mismatch
        if len(baseline) != len(live):
            diffs.append({
                "field": path or "root",
                "expected": f"Array of length {len(baseline)}",
                "actual": f"Array of length {len(live)}",
                "reason": "Response Structure Changed"
            })
            
        # Compare overlapping elements recursively
        for i in range(min(len(baseline), len(live))):
            item_path = f"{path}[{i}]"
            diffs.extend(compare_responses(baseline[i], live[i], item_path))

    # 4. Primitive values comparison (int, float, str, bool, None)
    else:
        if baseline != live:
            diffs.append({
                "field": path or "root",
                "expected": str(baseline),
                "actual": str(live),
                "reason": "Response Value Changed"
            })
            
    return diffs
