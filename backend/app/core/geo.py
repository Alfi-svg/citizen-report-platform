import math
import uuid
from typing import Dict, Tuple, Optional

# Bangladesh District Center Coordinates (All 64 districts)
BD_DISTRICT_COORDS: Dict[str, Tuple[float, float]] = {
    "dhaka": (23.8103, 90.4125),
    "chattogram": (22.3569, 91.7832),
    "chittagong": (22.3569, 91.7832),
    "sylhet": (24.8949, 91.8687),
    "rajshahi": (24.3745, 88.6042),
    "khulna": (22.8122, 89.5644),
    "barishal": (22.7010, 90.3535),
    "barisal": (22.7010, 90.3535),
    "rangpur": (25.7439, 89.2752),
    "mymensingh": (24.7471, 90.4203),
    "gazipur": (23.9999, 90.4203),
    "narayanganj": (23.6238, 90.5000),
    "cumilla": (23.4682, 91.1788),
    "comilla": (23.4682, 91.1788),
    "bogura": (24.8465, 89.3777),
    "bogra": (24.8465, 89.3777),
    "cox's bazar": (21.4272, 92.0058),
    "coxsbazar": (21.4272, 92.0058),
    "noakhali": (22.8696, 91.0998),
    "feni": (23.0159, 91.3976),
    "brahmanbaria": (23.9571, 91.1119),
    "jessore": (23.1664, 89.2081),
    "jashore": (23.1664, 89.2081),
    "kushtia": (23.9013, 89.1205),
    "pabna": (24.0064, 89.2372),
    "dinajpur": (25.6217, 88.6355),
    "tangail": (24.2513, 89.9167),
    "faridpur": (23.6071, 89.8429),
    "jamalpur": (24.9375, 89.9378),
    "bagerhat": (22.6516, 89.7859),
    "bandarban": (22.1953, 92.2184),
    "barguna": (22.0953, 90.0768),
    "bhola": (22.6859, 90.6482),
    "chandpur": (23.2321, 90.6631),
    "chapainawabganj": (24.5965, 88.2775),
    "chuadanga": (23.6402, 88.8418),
    "gaibandha": (25.3288, 89.5430),
    "gopalganj": (23.0051, 89.8266),
    "habiganj": (24.3749, 91.4155),
    "jhalokathi": (22.6406, 90.1987),
    "jhenaidah": (23.5448, 89.1539),
    "joypurhat": (25.1015, 89.0267),
    "khagrachhari": (23.1193, 91.9847),
    "kishoreganj": (24.4449, 90.7766),
    "kurigram": (25.8054, 89.6362),
    "lakshmipur": (22.9425, 90.8412),
    "lalmonirhat": (25.9923, 89.2847),
    "madaripur": (23.1641, 90.1897),
    "magura": (23.4873, 89.4198),
    "manikganj": (23.8644, 90.0047),
    "meherpur": (23.7622, 88.6318),
    "moulvibazar": (24.4829, 91.7774),
    "munshiganj": (23.5422, 90.5305),
    "naogaon": (24.7936, 88.9318),
    "narail": (23.1725, 89.5127),
    "narsingdi": (23.9193, 90.7202),
    "natore": (24.4206, 88.9324),
    "netrokona": (24.8709, 90.7279),
    "nilphamari": (25.9318, 88.8560),
    "panchagarh": (26.3411, 88.5542),
    "patuakhali": (22.3596, 90.3299),
    "pirojpur": (22.5841, 89.9720),
    "rajbari": (23.7574, 89.6445),
    "rangamati": (22.6533, 92.1753),
    "satkhira": (22.7185, 89.0705),
    "shariatpur": (23.2423, 90.4348),
    "sherpur": (25.0205, 90.0153),
    "sirajganj": (24.4534, 89.7008),
    "sunamganj": (25.0658, 91.3950),
    "thakurgaon": (26.0337, 88.4617),
}

# Major Hospital and Medical Hub Reference Coordinates
BD_HOSPITAL_AREAS: Dict[str, Tuple[float, float]] = {
    "dhanmondi": (23.7461, 90.3742),
    "shahbagh": (23.7383, 90.3957),
    "panthapath": (23.7516, 90.3872),
    "mirpur": (23.8055, 90.3639),
    "uttara": (23.8681, 90.3995),
    "gulshan": (23.7925, 90.4152),
    "banani": (23.7937, 90.4046),
    "mohammadpur": (23.7658, 90.3627),
    "farmgate": (23.7597, 90.3912),
    "tejgaon": (23.7597, 90.3912),
    "bakshibazar": (23.7225, 90.3980),
    "old dhaka": (23.7199, 90.3980),
    "kotwali": (23.7150, 90.4070),
    "badda": (23.7700, 90.4240),
    "rampura": (23.7610, 90.4220),
    "motijheel": (23.7330, 90.4172),
    "jatrabari": (23.7104, 90.4349),
    "shyamoli": (23.7725, 90.3644),
    "kalyanpur": (23.7800, 90.3600),
    "kurmitola": (23.8290, 90.4050),
    "cantonment": (23.8200, 90.3950),
    "savar": (23.8583, 90.2667),
    "enam": (23.8583, 90.2667),
    "agrabad": (22.3256, 91.8123),
    "gec": (22.3569, 91.8210),
    "panchlaish": (22.3683, 91.8310),
    "chawkbazar": (22.3580, 91.8400),
    "zindabazar": (24.8980, 91.8710),
    "subidbazar": (24.9080, 91.8600),
    "amberkhana": (24.9020, 91.8680),
    "shaheb bazar": (24.3636, 88.6241),
}

# Known Area to District Lookup
AREA_TO_DISTRICT: Dict[str, str] = {
    "savar": "Dhaka",
    "dhanmondi": "Dhaka",
    "mirpur": "Dhaka",
    "uttara": "Dhaka",
    "shahbagh": "Dhaka",
    "panthapath": "Dhaka",
    "gulshan": "Dhaka",
    "banani": "Dhaka",
    "mohammadpur": "Dhaka",
    "farmgate": "Dhaka",
    "tejgaon": "Dhaka",
    "shyamoli": "Dhaka",
    "badda": "Dhaka",
    "jatrabari": "Dhaka",
    "agrabad": "Chattogram",
    "gec": "Chattogram",
    "panchlaish": "Chattogram",
    "chawkbazar": "Chattogram",
    "zindabazar": "Sylhet",
    "subidbazar": "Sylhet",
    "amberkhana": "Sylhet",
    "shaheb bazar": "Rajshahi",
}


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two decimal coordinates in kilometers."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def resolve_location_coordinates(
    district: Optional[str] = None,
    area: Optional[str] = None,
    name_hint: Optional[str] = None,
    seed_key: Optional[uuid.UUID] = None,
) -> Tuple[float, float]:
    """
    Resolves privacy-safe approximate latitude and longitude for a given district, area, or facility name.
    Applies a deterministic micro-jitter (~100m to 200m) to preserve privacy without compromising proximity.
    """
    area_clean = (area or "").lower().strip()
    dist_clean = (district or "").lower().strip()
    hint_clean = (name_hint or "").lower().strip()

    base_lat: Optional[float] = None
    base_lng: Optional[float] = None

    # 1. Match specific known area or facility
    for key, coords in BD_HOSPITAL_AREAS.items():
        if (area_clean and key in area_clean) or (hint_clean and key in hint_clean):
            base_lat, base_lng = coords
            break

    # 2. Match district center
    if base_lat is None or base_lng is None:
        for key, coords in BD_DISTRICT_COORDS.items():
            if (dist_clean and key in dist_clean) or (area_clean and key in area_clean):
                base_lat, base_lng = coords
                break

    # 3. Fallback to Dhaka central coordinates
    if base_lat is None or base_lng is None:
        base_lat, base_lng = (23.8103, 90.4125)

    # 4. Optional deterministic micro-jitter
    if seed_key:
        h = hash(str(seed_key))
        jitter_lat = ((h % 11) - 5) * 0.0018
        jitter_lng = (((h >> 4) % 11) - 5) * 0.0018
        return round(base_lat + jitter_lat, 3), round(base_lng + jitter_lng, 3)

    return round(base_lat, 3), round(base_lng, 3)
