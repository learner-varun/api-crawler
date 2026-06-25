def parse_time_slot(time_str: str):
    """
    Parses time strings entered by the user, supporting:
    - 12-hour AM/PM: '12:00 AM', '2:35 AM', '2 PM', '12.00 AM', '235 AM'
    - 24-hour style: '14:35', '14.30', '1430', '2315'
    Returns (hour, minute) integers.
    Raises ValueError if formatting is invalid.
    """
    time_str = time_str.strip().upper()
    
    # 1. Extract AM/PM if present
    period = None
    if time_str.endswith("AM"):
        period = "AM"
        time_str = time_str[:-2].strip()
    elif time_str.endswith("PM"):
        period = "PM"
        time_str = time_str[:-2].strip()
        
    # 2. Parse hour and minute
    # Try to split by colon or dot
    if ":" in time_str:
        parts = time_str.split(":")
    elif "." in time_str:
        parts = time_str.split(".")
    else:
        # No separator, parse by digits length
        if not time_str.isdigit():
            raise ValueError("Time must contain only digits and optional separators")
        if len(time_str) == 1 or len(time_str) == 2:
            parts = [time_str, "00"]
        elif len(time_str) == 3:
            parts = [time_str[0], time_str[1:]]
        elif len(time_str) == 4:
            parts = [time_str[:2], time_str[2:]]
        else:
            raise ValueError("Invalid time string length")
            
    if len(parts) != 2:
        raise ValueError("Invalid time format")
        
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError:
        raise ValueError("Hour and minute must be integers")
        
    # 3. Validate ranges and apply AM/PM logic
    if period:
        if hour < 1 or hour > 12:
            raise ValueError("Hour must be 1-12 when AM/PM is specified")
        if minute < 0 or minute > 59:
            raise ValueError("Minute must be 0-59")
        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0
    else:
        if hour < 0 or hour > 23:
            raise ValueError("Hour must be 0-23")
        if minute < 0 or minute > 59:
            raise ValueError("Minute must be 0-59")
            
    return hour, minute
