import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hospital import (
    Hospital,
    BloodInventory,
    BloodInventoryStatus,
)
from app.models.emergency_service import VerificationStatus
from app.models.blood import BloodGroup

logger = logging.getLogger("seed_hospitals")

VERIFIED_HOSPITALS_DATA: List[Dict[str, Any]] = [
    {
        "name": "Dhaka Medical College Hospital (DMCH)",
        "name_bn": "ঢাকা মেডিকেল কলেজ হাসপাতাল (ডিএমসিএইচ)",
        "blood_bank_name": "DMCH Blood Transfusion Department",
        "district": "Dhaka",
        "area": "Bakshibazar",
        "address": "Secretariate Road, Bakshibazar, Dhaka 1000",
        "address_bn": "সচিবালয় রোড, বকশিবাজার, ঢাকা ১০০০",
        "latitude": 23.7260,
        "longitude": 90.3976,
        "emergency_phone": "+880255165088",
        "alternate_phone": "+880255165089",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (14, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (3, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (9, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (11, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (5, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Bangabandhu Sheikh Mujib Medical University (BSMMU / PG Hospital)",
        "name_bn": "বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয় (বিএসএমএমইউ / পিজি হাসপাতাল)",
        "blood_bank_name": "BSMMU Transfusion Medicine Department",
        "district": "Dhaka",
        "area": "Shahbag",
        "address": "Shahbag Circle, Shahbag, Dhaka 1000",
        "address_bn": "শাহবাগ মোড়, শাহবাগ, ঢাকা ১০০০",
        "latitude": 23.7388,
        "longitude": 90.3956,
        "emergency_phone": "+88029661051",
        "alternate_phone": "+88029661060",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (18, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_POS: (12, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (15, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (3, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (7, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (1, BloodInventoryStatus.LOW_STOCK),
        },
    },
    {
        "name": "Bangladesh Red Crescent Society Central Blood Bank",
        "name_bn": "বাংলাদেশ রেড ক্রিসেন্ট সোসাইটি কেন্দ্রীয় রক্ত কেন্দ্র",
        "blood_bank_name": "Red Crescent Central Blood Bank",
        "district": "Dhaka",
        "area": "Mohammadpur",
        "address": "7/5 Aurangzeb Road, Mohammadpur, Dhaka 1207",
        "address_bn": "৭/৫ আওরঙ্গজেব রোড, মোহাম্মদপুর, ঢাকা ১২০৭",
        "latitude": 23.7634,
        "longitude": 90.3653,
        "emergency_phone": "+88029116563",
        "alternate_phone": "+8801811458524",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (25, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (6, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_POS: (16, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (3, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (20, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (2, BloodInventoryStatus.LOW_STOCK),
        },
    },
    {
        "name": "National Institute of Cardiovascular Diseases (NICVD)",
        "name_bn": "জাতীয় হৃদরোগ ইনস্টিটিউট ও হাসপাতাল",
        "blood_bank_name": "NICVD Blood Transfusion Unit",
        "district": "Dhaka",
        "area": "Sher-e-Bangla Nagar",
        "address": "Sher-e-Bangla Nagar, Mirpur Road, Dhaka 1207",
        "address_bn": "শেরেবাংলা নগর, মিরপুর রোড, ঢাকা ১২০৭",
        "latitude": 23.7711,
        "longitude": 90.3697,
        "emergency_phone": "+88029122560",
        "alternate_phone": "+88029122561",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (7, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
            BloodGroup.B_POS: (9, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (3, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Quantum Foundation Blood Lab",
        "name_bn": "কোয়ান্টাম ফাউন্ডেশন রক্ত ল্যাব",
        "blood_bank_name": "Quantum Voluntary Blood Donation Service",
        "district": "Dhaka",
        "area": "Shantinagar",
        "address": "31/V Shilpacharya Zainul Abedin Sarak, Shantinagar, Dhaka 1217",
        "address_bn": "৩১/ভি শিল্পাচার্য জয়নুল আবেদীন সড়ক, শান্তিনগর, ঢাকা ১২১৭",
        "latitude": 23.7412,
        "longitude": 90.4150,
        "emergency_phone": "+88029351424",
        "alternate_phone": "+8801714010869",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (22, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (5, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_POS: (14, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_POS: (18, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (5, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_POS: (9, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (2, BloodInventoryStatus.LOW_STOCK),
        },
    },
    {
        "name": "Square Hospital Blood Bank",
        "name_bn": "স্কয়ার হাসপাতাল রক্ত ব্যাংক",
        "blood_bank_name": "Square Hospital Transfusion Medicine Service",
        "district": "Dhaka",
        "area": "Panthapath",
        "address": "18/F Bir Uttam Qazi Nuruzzaman Sarak, West Panthapath, Dhaka 1205",
        "address_bn": "১৮/এফ বীর উত্তম কাজী নুরুজ্জামান সড়ক, পশ্চিম পান্থপথ, ঢাকা ১২০৫",
        "latitude": 23.7533,
        "longitude": 90.3817,
        "emergency_phone": "+88028159457",
        "alternate_phone": "+8801713377775",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (10, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (11, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (1, BloodInventoryStatus.LOW_STOCK),
        },
    },
    {
        "name": "Kurmitola General Hospital",
        "name_bn": "কুর্মিটোলা জেনারেল হাসপাতাল",
        "blood_bank_name": "Kurmitola General Hospital Blood Bank",
        "district": "Dhaka",
        "area": "Cantonment",
        "address": "Dhaka-Mymensingh Road, Cantonment, Dhaka 1206",
        "address_bn": "ঢাকা-ময়মনসিংহ রোড, সেনানিবাস, ঢাকা ১২০৬",
        "latitude": 23.8193,
        "longitude": 90.4107,
        "emergency_phone": "+880255067202",
        "alternate_phone": "+880255067204",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (7, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (5, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
            BloodGroup.B_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Chittagong Medical College Hospital (CMCH)",
        "name_bn": "চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (সিএমসিএইচ)",
        "blood_bank_name": "CMCH Blood Transfusion Department",
        "district": "Chattogram",
        "area": "Panchlaish",
        "address": "57 K.B. Fazlul Kader Road, Panchlaish, Chattogram 4203",
        "address_bn": "৫৭ কে বি ফজলুল কাদের রোড, পাঁচলাইশ, চট্টগ্রাম ৪২০৩",
        "latitude": 22.3592,
        "longitude": 91.8285,
        "emergency_phone": "+88031619400",
        "alternate_phone": "+88031630335",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (15, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (11, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (13, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (6, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (1, BloodInventoryStatus.LOW_STOCK),
        },
    },
    {
        "name": "Sylhet MAG Osmani Medical College Hospital",
        "name_bn": "সিলেট এম.এ.জি. ওসমানী মেডিকেল কলেজ হাসপাতাল",
        "blood_bank_name": "SOMCH Blood Transfusion Unit",
        "district": "Sylhet",
        "area": "Kajolshah",
        "address": "Medical Road, Kajolshah, Sylhet 3100",
        "address_bn": "মেডিকেল রোড, কাজলশাহ, সিলেট ৩১০০",
        "latitude": 24.8997,
        "longitude": 91.8542,
        "emergency_phone": "+880821713667",
        "alternate_phone": "+880821717055",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (12, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (10, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Rajshahi Medical College Hospital (RMCH)",
        "name_bn": "রাজশাহী মেডিকেল কলেজ হাসপাতাল (আরএমসিএইচ)",
        "blood_bank_name": "RMCH Blood Transfusion Department",
        "district": "Rajshahi",
        "area": "Laxmipur",
        "address": "Laxmipur, Rajshahi 6000",
        "address_bn": "লক্ষ্মীপুর, রাজশাহী ৬০০০",
        "latitude": 24.3725,
        "longitude": 88.5839,
        "emergency_phone": "+880721772150",
        "alternate_phone": "+880721776001",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (10, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (9, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (12, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (5, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Khulna Medical College Hospital",
        "name_bn": "খুলনা মেডিকেল কলেজ হাসপাতাল",
        "blood_bank_name": "KMCH Blood Bank Unit",
        "district": "Khulna",
        "area": "Boyra",
        "address": "Boyra, Khulna 9000",
        "address_bn": "বয়রা, খুলনা ৯০০০",
        "latitude": 22.8368,
        "longitude": 89.5403,
        "emergency_phone": "+88041761509",
        "alternate_phone": "+88041760350",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (8, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (6, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (9, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (3, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_NEG: (0, BloodInventoryStatus.OUT_OF_STOCK),
        },
    },
    {
        "name": "Mymensingh Medical College Hospital (MMCH)",
        "name_bn": "ময়মনসিংহ মেডিকেল কলেজ হাসপাতাল",
        "blood_bank_name": "MMCH Transfusion Medicine Department",
        "district": "Mymensingh",
        "area": "Charpara",
        "address": "Charpara, Medical College Road, Mymensingh 2200",
        "address_bn": "চরপাড়া, মেডিকেল কলেজ রোড, ময়মনসিংহ ২২০০",
        "latitude": 24.7431,
        "longitude": 90.4140,
        "emergency_phone": "+8809166063",
        "alternate_phone": "+8809167232",
        "verification_status": VerificationStatus.VERIFIED,
        "inventory": {
            BloodGroup.O_POS: (11, BloodInventoryStatus.AVAILABLE),
            BloodGroup.O_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.A_POS: (7, BloodInventoryStatus.AVAILABLE),
            BloodGroup.A_NEG: (1, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.B_POS: (10, BloodInventoryStatus.AVAILABLE),
            BloodGroup.B_NEG: (2, BloodInventoryStatus.LOW_STOCK),
            BloodGroup.AB_POS: (4, BloodInventoryStatus.AVAILABLE),
            BloodGroup.AB_NEG: (1, BloodInventoryStatus.LOW_STOCK),
        },
    },
]


async def seed_hospitals_and_inventory(db: AsyncSession) -> Dict[str, int]:
    """
    Idempotent seeding of verified Bangladesh hospitals and live blood bank inventory.
    """
    hospitals_created = 0
    inventories_created = 0
    now = datetime.now(timezone.utc)

    for h_data in VERIFIED_HOSPITALS_DATA:
        # Check if hospital already exists
        stmt = select(Hospital).where(Hospital.name == h_data["name"])
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing is None:
            hospital = Hospital(
                name=h_data["name"],
                name_bn=h_data.get("name_bn"),
                blood_bank_name=h_data.get("blood_bank_name"),
                district=h_data["district"],
                area=h_data["area"],
                address=h_data["address"],
                address_bn=h_data.get("address_bn"),
                latitude=h_data["latitude"],
                longitude=h_data["longitude"],
                emergency_phone=h_data["emergency_phone"],
                alternate_phone=h_data.get("alternate_phone"),
                verification_status=h_data["verification_status"],
                has_blood_bank=True,
                is_active=True,
            )
            db.add(hospital)
            await db.flush()
            hospitals_created += 1
        else:
            hospital = existing

        # Seed or update inventory for each blood group
        inv_map = h_data.get("inventory", {})
        for bg in [
            BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.B_POS, BloodGroup.B_NEG,
            BloodGroup.AB_POS, BloodGroup.AB_NEG, BloodGroup.O_POS, BloodGroup.O_NEG
        ]:
            units, status_val = inv_map.get(bg, (0, BloodInventoryStatus.UNKNOWN))

            stmt_inv = select(BloodInventory).where(
                BloodInventory.hospital_id == hospital.id,
                BloodInventory.blood_group == bg,
            )
            res_inv = await db.execute(stmt_inv)
            inv_record = res_inv.scalar_one_or_none()

            # Jitter last_updated slightly (between 30 mins and 4 hours ago) for realistic freshness
            random_offset = timedelta(hours=1, minutes=30)
            record_time = now - random_offset

            if inv_record is None:
                new_inv = BloodInventory(
                    hospital_id=hospital.id,
                    blood_group=bg,
                    available_units=units,
                    availability_status=status_val,
                    is_verified=True,
                    last_updated=record_time,
                )
                db.add(new_inv)
                inventories_created += 1
            else:
                inv_record.available_units = units
                inv_record.availability_status = status_val
                inv_record.last_updated = record_time

    await db.commit()
    logger.info("Hospital seeding complete: %d hospitals, %d inventories", hospitals_created, inventories_created)
    return {
        "hospitals_created": hospitals_created,
        "inventories_created": inventories_created,
        "total_hospitals_defined": len(VERIFIED_HOSPITALS_DATA),
    }
