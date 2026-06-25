import shlex
import re
import json

def parse_curl_command(curl_str: str):
    """
    Parses a basic curl command string and returns a dict with method, url, headers, and data.
    """
    try:
        tokens = shlex.split(curl_str)
    except ValueError:
        # Fallback if quotes are mismatched
        tokens = curl_str.split()

    if not tokens or tokens[0].lower() != "curl":
        raise ValueError("Not a valid curl command")

    method = "GET"
    url = None
    headers = {}
    data = None

    i = 1
    while i < len(tokens):
        token = tokens[i]
        
        if not token.strip():
            i += 1
            continue
            
        if token in ("-X", "--request"):
            if i + 1 < len(tokens):
                method = tokens[i+1].upper()
                i += 2
                continue
        elif token == "--url":
            if i + 1 < len(tokens):
                url = tokens[i+1]
                i += 2
                continue
        elif token in ("-H", "--header"):
            if i + 1 < len(tokens):
                header_str = tokens[i+1]
                if ":" in header_str:
                    key, val = header_str.split(":", 1)
                    headers[key.strip()] = val.strip()
                i += 2
                continue
        elif token in ("-d", "--data", "--data-raw", "--data-binary"):
            if i + 1 < len(tokens):
                data = tokens[i+1]
                if method == "GET":
                    method = "POST"
                i += 2
                continue
        elif not token.startswith("-"):
            # Assume it's the URL if we haven't found one yet
            if not url:
                url = token
            i += 1
            continue
        else:
            # Skip unknown flags
            i += 1
            
    if not url:
        raise ValueError("URL not found in curl command")
        
    return {
        "method": method,
        "url": url,
        "headers": headers,
        "data": data
    }

def substitute_variables(text: str, variables: dict) -> str:
    """
    Replaces {{variable_name}} with the value from the variables dictionary
    or from the system environment variables if not found.
    """
    if not text:
        return text
        
    import os

    def replacer(match):
        var_name = match.group(1)
        if var_name in variables:
            return str(variables[var_name])
        elif var_name in os.environ:
            return str(os.environ[var_name])
        return match.group(0)
        
    return re.sub(r'\{\{([^}]+)\}\}', replacer, text)

def extract_value_by_path(data: dict, path: str):
    """
    Extracts a value from a nested dictionary using dot notation path (e.g., 'data.user.id').
    Returns None if the path is not found.
    """
    keys = path.split('.')
    current = data
    
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        elif isinstance(current, list) and key.isdigit() and int(key) < len(current):
            current = current[int(key)]
        else:
            return None
            
    return current
