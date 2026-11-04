import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.report import Report, ReportStatus
from app.models.moderation import ModerationRecord, ModerationAction

logger = logging.getLogger("seed_demo_incidents")

DEMO_EMAIL_DOMAIN = "@nirapotta.local"

DEMO_USERS_DATA = [
    {
        "username": "demo_reporter_dhaka",
        "email": f"demo_reporter_dhaka{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Citizen Reporter (Dhaka)",
        "role": UserRole.USER,
    },
    {
        "username": "demo_reporter_ctg",
        "email": f"demo_reporter_ctg{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Citizen Reporter (Chattogram)",
        "role": UserRole.USER,
    },
    {
        "username": "demo_mod_officer",
        "email": f"demo_mod_officer{DEMO_EMAIL_DOMAIN}",
        "full_name": "Demo Safety Moderator (Officer)",
        "role": UserRole.MODERATOR,
    },
]

DEMO_INCIDENTS_DATA = [
    {
        "key": "demo_savar_robbery_approved",
        "title": "[DEMO] Armed Robbery and Harassment near Savar Bus Stand",
        "category_slug": "crime",
        "location_text": "Savar Bus Stand, Savar, Dhaka",
        "latitude": 23.8583,
        "longitude": 90.2667,
        "days_ago": 2,
        "status": ReportStatus.APPROVED,
        "is_anonymous": False,
        "reporter_username": "demo_reporter_dhaka",
        "description": "Two men on a motorcycle threatened pedestrians with a sharp weapon and snatched bags near the main Savar bus stop around 9:30 PM. Pedestrians alerted nearby locals.",
        "moderation": {
            "action": ModerationAction.APPROVED,
            "user_message": "Report verified and published to citizen safety network.",
            "internal_notes": "Cross-verified with Savar local police station GD entry.",
        },
    },
    {
        "key": "demo_savar_mugging_duplicate_submitted",
        "title": "[DEMO] Mugging with sharp knife near Savar Bus Stand",
        "category_slug": "crime",
        "location_text": "Near Savar Bus Stop, Savar, Dhaka",
        "latitude": 23.8588,
        "longitude": 90.2671,
        "days_ago": 1.5,
        "status": ReportStatus.SUBMITTED,
        "is_anonymous": True,
        "reporter_username": "demo_reporter_dhaka",
        "description": "Muggers with sharp blades snatched smartphone and wallet near Savar bus counter at night. High risk for commuters late evening.",
        "moderation": None,
    },
    {
        "key": "demo_mirpur_manhole_approved",
        "title": "[DEMO] Dangerous Open Manhole on Mirpur 10 Main Avenue",
        "category_slug": "public-safety",
        "location_text": "Mirpur 10 Circle, Mirpur, Dhaka",
        "latitude": 23.8071,
        "longitude": 90.3686,
        "days_ago": 3,
        "status": ReportStatus.APPROVED,
        "is_anonymous": False,
        "reporter_username": "demo_reporter_dhaka",
        "description": "An uncovered storm drain manhole on the north pedestrian crossing at Mirpur 10 roundabout presents severe danger to evening pedestrians and rickshaw traffic.",
        "moderation": {
            "action": ModerationAction.APPROVED,
            "user_message": "Published and forwarded to DNCC civic road maintenance team.",
            "internal_notes": "Notified Dhaka North City Corporation ward emergency team.",
        },
    },
    {
        "key": "demo_agrabad_effluent_approved",
        "title": "[DEMO] Illegal Chemical Effluent Discharge into Karnaphuli Canal",
        "category_slug": "environmental-issue",
        "location_text": "Agrabad C/A, Chattogram",
        "latitude": 22.3275,
        "longitude": 91.8126,
        "days_ago": 5,
        "status": ReportStatus.APPROVED,
        "is_anonymous": False,
        "reporter_username": "demo_reporter_ctg",
        "description": "Dark chemical runoff from an industrial washing unit being pumped directly into the stormwater drainage canal leading to Karnaphuli river during late night hours.",
        "moderation": {
            "action": ModerationAction.APPROVED,
            "user_message": "Report confirmed with photos. Forwarded to Department of Environment (Chattogram).",
            "internal_notes": "High credibility; citizen submitted clear water sample photographs.",
        },
    },
    {
        "key": "demo_dhanmondi_fraud_under_review",
        "title": "[DEMO] Online MFS Cash-Out Phishing and Extortion Scheme",
        "category_slug": "fraud",
        "location_text": "Road 27, Dhanmondi, Dhaka",
        "latitude": 23.7509,
        "longitude": 90.3753,
        "days_ago": 1,
        "status": ReportStatus.UNDER_REVIEW,
        "is_anonymous": False,
        "reporter_username": "demo_reporter_dhaka",
        "description": "Fraudulent gang impersonating customer support agents calling small business merchants to drain merchant wallets via spoofed OTP verification.",
        "moderation": {
            "action": ModerationAction.STARTED_REVIEW,
            "user_message": "Report is currently under active review by the civic safety intelligence team.",
            "internal_notes": "Checked MFS wallet number against known syndicate database; caller ID matches telecom blacklist.",
        },
    },
    {
        "key": "demo_dhanmondi_violence_needs_info",
        "title": "[DEMO] Physical Altercation and Youth Extortion Gang",
        "category_slug": "violence",
        "location_text": "Dhanmondi Lake Walkway, Dhanmondi, Dhaka",
        "latitude": 23.7480,
        "longitude": 90.3780,
        "days_ago": 4,
        "status": ReportStatus.NEEDS_MORE_INFORMATION,
        "is_anonymous": False,
        "reporter_username": "demo_reporter_dhaka",
        "description": "Group of youths demanding illegal tolls from evening joggers and pedestrians along the lake pathway near sector 8.",
        "moderation": {
            "action": ModerationAction.REQUESTED_INFORMATION,
            "user_message": "Please specify the exact section of the walkway and approximate time of occurrence.",
            "internal_notes": "Pending eyewitness statement from lake security guards; need more granular location data.",
        },
    },
    {
        "key": "demo_sylhet_lights_approved",
        "title": "[DEMO] Street Light Outage and Harassment Corridor",
        "category_slug": "public-safety",
        "location_text": "Zindabazar Point, Sylhet",
        "latitude": 24.8968,
        "longitude": 91.8715,
        "days_ago": 6,
        "status": ReportStatus.APPROVED,
        "is_anonymous": True,
        "reporter_username": "demo_reporter_ctg",
        "description": "Continuous blackout of civic street lights over 400 meters creating unsafe conditions for women commuters after 8 PM.",
        "moderation": {
            "action": ModerationAction.APPROVED,
            "user_message": "Verified by community patrol. Forwarded to Sylhet City Corporation.",
            "internal_notes": "Ward 4 councillor contacted.",
        },
    },
]


async def clean_demo_incidents_data(db: AsyncSession) -> int:
    """Safely cleans up previously seeded synthetic demo reports and records."""
    stmt = select(Report).where(Report.title.like("[DEMO]%"))
    result = await db.execute(stmt)
    demo_reports = result.scalars().all()
    count = len(demo_reports)
    for report in demo_reports:
        await db.delete(report)

    if count > 0:
        await db.commit()
        logger.info(f"Cleaned up {count} existing demo incident reports.")
    return count


async def seed_demo_incidents_data(db: AsyncSession, reset_first: bool = False) -> Dict[str, Any]:
    """
    Seeds realistic, clearly labeled synthetic demo reports and moderation records.
    Idempotent and isolated to demo records.
    """
    if reset_first:
        await clean_demo_incidents_data(db)

    # 1. Ensure categories exist or fetch map
    cat_stmt = select(Category)
    cat_result = await db.execute(cat_stmt)
    categories = cat_result.scalars().all()
    cat_map: Dict[str, Category] = {c.slug: c for c in categories}

    # Ensure required categories exist
    required_cats = {
        "crime": ("Crime", "General criminal offenses and illegal activities."),
        "public-safety": ("Public Safety", "Hazards, structural collapses, fires, and infrastructure dangers."),
        "environmental-issue": ("Environmental Issue", "Pollution and environmental hazards."),
        "fraud": ("Fraud", "Financial fraud, cyber scams, forgery."),
        "violence": ("Violence", "Physical violence, assaults, and armed clashes."),
    }

    for slug, (name, desc) in required_cats.items():
        if slug not in cat_map:
            cat = Category(name=name, slug=slug, description=desc, is_active=True)
            db.add(cat)
            await db.flush()
            cat_map[slug] = cat

    # 2. Ensure demo users exist
    user_map: Dict[str, User] = {}
    for user_info in DEMO_USERS_DATA:
        stmt = select(User).where(User.email == user_info["email"])
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=user_info["email"],
                username=user_info["username"],
                full_name=user_info["full_name"],
                hashed_password=get_password_hash("DemoSecret123!"),
                role=user_info["role"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
        user_map[user_info["username"]] = user

    # 3. Seed incident reports
    now = datetime.now(timezone.utc)
    seeded_reports_count = 0
    seeded_records_map = {}

    for item in DEMO_INCIDENTS_DATA:
        stmt = select(Report).where(Report.title == item["title"])
        result = await db.execute(stmt)
        report = result.scalar_one_or_none()

        reporter = user_map.get(item["reporter_username"])
        category = cat_map.get(item["category_slug"])
        if not category:
            continue

        incident_time = now - timedelta(days=item["days_ago"])

        if not report:
            report = Report(
                user_id=reporter.id if reporter else None,
                category_id=category.id,
                title=item["title"],
                description=item["description"],
                location_text=item["location_text"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                incident_date=incident_time,
                is_anonymous=item["is_anonymous"],
                status=item["status"],
                submitted_at=incident_time,
            )
            db.add(report)
            await db.flush()
            seeded_reports_count += 1

            # Seed moderation record if specified
            if item.get("moderation"):
                mod_info = item["moderation"]
                mod_user = user_map.get("demo_mod_officer")
                mod_rec = ModerationRecord(
                    report_id=report.id,
                    admin_id=mod_user.id if mod_user else None,
                    action=mod_info["action"],
                    user_message=mod_info.get("user_message"),
                    internal_notes=mod_info.get("internal_notes"),
                )
                db.add(mod_rec)

        seeded_records_map[item["key"]] = str(report.id)

    await db.commit()

    return {
        "status": "SUCCESS",
        "demo_reports_seeded": seeded_reports_count,
        "total_demo_incidents": len(DEMO_INCIDENTS_DATA),
        "report_ids": seeded_records_map,
    }
