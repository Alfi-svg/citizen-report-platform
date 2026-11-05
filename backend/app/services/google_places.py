"""
Google Places API Integration for Hospital Discovery.

Provides safe discovery and enrichment of legitimate hospital and medical center
locations using Google Places API (New) when credentials are provided in settings.
Strict data integrity:
- Google Places DOES NOT provide blood inventory. Real-time blood units are NEVER inferred from Places.
- If GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY is not configured, logs status and gracefully returns empty list.
"""

import logging
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("google_places")


async def search_google_places_hospitals(
    latitude: float,
    longitude: float,
    radius_meters: float = 25000.0,
    max_results: int = 15,
) -> List[Dict[str, Any]]:
    """
    Queries Google Places API (New) for nearby hospitals and medical centers.
    Returns structured list of place records, or empty list if credentials missing / request fails.
    """
    api_key = settings.GOOGLE_PLACES_API_KEY or settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        logger.debug("Google Places API key is not configured; skipping external Places lookup.")
        return []

    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,places.location,"
            "places.internationalPhoneNumber,places.googleMapsUri,places.types"
        ),
    }

    payload = {
        "includedTypes": ["hospital"],
        "maxResultCount": min(max_results, 20),
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "radius": float(radius_meters),
            }
        },
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning(
                    "Google Places API responded with status %d: %s",
                    resp.status_code,
                    resp.text[:200],
                )
                return []

            data = resp.json()
            places = data.get("places", [])
            results = []
            for p in places:
                loc = p.get("location", {})
                display_name = p.get("displayName", {}).get("text", "")
                results.append({
                    "place_id": p.get("id"),
                    "name": display_name,
                    "formatted_address": p.get("formattedAddress", ""),
                    "latitude": loc.get("latitude"),
                    "longitude": loc.get("longitude"),
                    "phone": p.get("internationalPhoneNumber"),
                    "google_maps_uri": p.get("googleMapsUri"),
                    "types": p.get("types", []),
                    "source": "Google Places API (New)",
                })
            return results
    except Exception as e:
        logger.warning("Error fetching Google Places hospitals: %s", e)
        return []
