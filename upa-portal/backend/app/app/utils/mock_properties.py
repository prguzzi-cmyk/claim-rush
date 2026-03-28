"""Generate mock property data within a geographic radius."""

import math
import random
import uuid

STREET_NAMES = [
    "Main St", "Oak Ave", "Maple Dr", "Cedar Ln", "Pine St",
    "Elm St", "Washington Blvd", "Park Ave", "Lake Dr", "Hill Rd",
    "Sunset Blvd", "River Rd", "Church St", "Spring St", "Forest Ave",
    "Meadow Ln", "Valley Dr", "Highland Ave", "Willow St", "Birch Ct",
]

PROPERTY_TYPES = [
    "Single Family", "Townhouse", "Condo", "Multi-Family",
    "Mobile Home", "Duplex",
]

# Rough state estimation from coordinates
STATE_CITY_MAP = {
    "TX": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
    "FL": ["Miami", "Orlando", "Tampa", "Jacksonville", "Naples"],
    "OK": ["Oklahoma City", "Tulsa", "Norman", "Edmond", "Broken Arrow"],
    "KS": ["Wichita", "Topeka", "Overland Park", "Lawrence", "Olathe"],
    "NE": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
    "CO": ["Denver", "Colorado Springs", "Aurora", "Boulder", "Pueblo"],
    "MO": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Jefferson City"],
    "AL": ["Birmingham", "Huntsville", "Mobile", "Montgomery", "Tuscaloosa"],
    "GA": ["Atlanta", "Savannah", "Augusta", "Macon", "Columbus"],
    "NC": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Wilmington"],
    "SC": ["Charleston", "Columbia", "Greenville", "Myrtle Beach", "Spartanburg"],
    "LA": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
    "MS": ["Jackson", "Biloxi", "Hattiesburg", "Meridian", "Tupelo"],
    "AR": ["Little Rock", "Fayetteville", "Fort Smith", "Jonesboro", "Pine Bluff"],
    "TN": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"],
    "IL": ["Chicago", "Springfield", "Peoria", "Rockford", "Naperville"],
    "IN": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
    "OH": ["Columbus", "Cleveland", "Cincinnati", "Dayton", "Toledo"],
    "PA": ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown", "Erie"],
    "NY": ["New York", "Buffalo", "Rochester", "Syracuse", "Albany"],
}

# Default fallback
DEFAULT_STATE = "TX"
DEFAULT_CITIES = ["Springfield", "Riverside", "Fairview", "Georgetown", "Greenville"]


def _estimate_state(lat: float, lng: float) -> str:
    """Very rough state estimation from lat/lng."""
    if lat < 28 and lng > -82:
        return "FL"
    if lat < 34 and lng < -94:
        return "TX"
    if 31 <= lat < 34 and lng > -90:
        return "GA"
    if 34 <= lat < 37 and lng > -84:
        return "NC"
    if 31 <= lat < 34 and -94 <= lng < -90:
        return "LA"
    if 34 <= lat < 37 and lng < -95:
        return "OK"
    if 37 <= lat < 40 and lng < -95:
        return "KS"
    if 37 <= lat < 40 and lng > -90:
        return "OH"
    if 40 <= lat < 43 and lng > -80:
        return "PA"
    if lat >= 43 and lng > -80:
        return "NY"
    if 37 <= lat < 40 and -95 <= lng < -90:
        return "MO"
    if 34 <= lat < 37 and -95 <= lng < -90:
        return "AR"
    if 37 <= lat < 40 and -90 <= lng < -85:
        return "IL"
    if lat < 34 and -90 <= lng < -85:
        return "MS"
    if lat < 34 and -88 <= lng < -85:
        return "AL"
    if 34 <= lat < 37 and -84 <= lng < -80:
        return "SC"
    if 35 <= lat < 37 and -90 <= lng < -82:
        return "TN"
    if 38 <= lat < 42 and -87 <= lng < -84:
        return "IN"
    if 39 <= lat < 42 and -105 <= lng < -100:
        return "CO"
    if 40 <= lat < 43 and -100 <= lng < -95:
        return "NE"
    return DEFAULT_STATE


def generate_mock_properties(
    lat: float, lng: float, radius_miles: float
) -> list[dict]:
    """Generate 15-40 random property records within a circle."""
    count = random.randint(15, 40)
    state = _estimate_state(lat, lng)
    cities = STATE_CITY_MAP.get(state, DEFAULT_CITIES)

    properties = []
    for _ in range(count):
        # Uniform random point in circle (sqrt distribution for uniform area)
        angle = random.uniform(0, 2 * math.pi)
        distance = radius_miles * math.sqrt(random.random())

        # Convert miles to degrees (approximate)
        dlat = (distance / 69.0) * math.cos(angle)
        dlng = (distance / (69.0 * math.cos(math.radians(lat)))) * math.sin(angle)

        p_lat = round(lat + dlat, 6)
        p_lng = round(lng + dlng, 6)

        house_num = random.randint(100, 9999)
        street = random.choice(STREET_NAMES)
        zip_code = str(random.randint(10000, 99999))

        properties.append(
            {
                "id": str(uuid.uuid4()),
                "address": f"{house_num} {street}",
                "city": random.choice(cities),
                "state": state,
                "zip_code": zip_code,
                "latitude": p_lat,
                "longitude": p_lng,
                "property_type": random.choice(PROPERTY_TYPES),
            }
        )

    return properties
