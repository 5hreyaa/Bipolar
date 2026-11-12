"""Idempotent database seed script for Snack Overflow.

Demo Credentials:
  Admin:  admin@snackoverflow.com  / admin123
  Member: member@snackoverflow.com / member123

Usage (from backend/ directory):
  python -m scripts.seed
"""

from datetime import datetime, timedelta, timezone
import os
import sys

# Allow running directly as python scripts/seed.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models.activity import Activity, ActivityAction
from app.models.snack import Snack, SnackCategory
from app.models.user import User, UserRole
from app.models.vote import Vote
from app.services.auth import hash_password


DEMO_USERS = [
    {
        "name": "Aarav Patel (Admin)",
        "email": "admin@snackoverflow.com",
        "password": "admin123",
        "role": UserRole.ADMIN.value,
    },
    {
        "name": "Maya Sharma (Member)",
        "email": "member@snackoverflow.com",
        "password": "member123",
        "role": UserRole.MEMBER.value,
    },
]

DEMO_SNACKS = [
    # Sweet (5)
    {
        "name": "Oreo Original Creme Biscuits",
        "brand": "Oreo",
        "category": SnackCategory.SWEET.value,
        "quantity": 18,
        "low_stock_threshold": 5,
        "price": 35.0,
        "image_url": "/uploads/demo/oreo-creme-biscuits.jpg",
    },
    {
        "name": "KitKat Chocolate Wafer",
        "brand": "Nestle KitKat",
        "category": SnackCategory.SWEET.value,
        "quantity": 14,
        "low_stock_threshold": 5,
        "price": 30.0,
        "image_url": "/uploads/demo/kitkat-chocolate-wafer.jpg",
    },
    {
        "name": "Lotus Biscoff Cookies & Spread",
        "brand": "Lotus Biscoff",
        "category": SnackCategory.SWEET.value,
        "quantity": 10,
        "low_stock_threshold": 5,
        "price": 240.0,
        "image_url": "/uploads/demo/lotus-biscoff-cookies.jpg",
    },
    {
        "name": "Cadbury Dairy Milk Chocolate",
        "brand": "Cadbury",
        "category": SnackCategory.SWEET.value,
        "quantity": 4,
        "low_stock_threshold": 5,
        "price": 45.0,
        "image_url": "/uploads/demo/dairy-milk-chocolate.jpg",
    },
    {
        "name": "Parle-G Original Gluco Biscuits",
        "brand": "Parle",
        "category": SnackCategory.SWEET.value,
        "quantity": 24,
        "low_stock_threshold": 6,
        "price": 10.0,
        "image_url": "/uploads/demo/parle-g-biscuits.jpg",
    },
    # Savoury (5)
    {
        "name": "Lay's Classic Salted Chips",
        "brand": "Lay's",
        "category": SnackCategory.SAVOURY.value,
        "quantity": 16,
        "low_stock_threshold": 5,
        "price": 20.0,
        "image_url": "/uploads/demo/lays-classic-salted.jpg",
    },
    {
        "name": "Pringles Sour Cream & Onion",
        "brand": "Pringles",
        "category": SnackCategory.SAVOURY.value,
        "quantity": 3,
        "low_stock_threshold": 5,
        "price": 110.0,
        "image_url": "/uploads/demo/pringles-sour-cream.jpg",
    },
    {
        "name": "Doritos Nacho Cheese Tortillas",
        "brand": "Doritos",
        "category": SnackCategory.SAVOURY.value,
        "quantity": 11,
        "low_stock_threshold": 5,
        "price": 50.0,
        "image_url": "/uploads/demo/doritos-nacho-cheese.jpg",
    },
    {
        "name": "Haldiram's Aloo Bhujia",
        "brand": "Haldiram's",
        "category": SnackCategory.SAVOURY.value,
        "quantity": 9,
        "low_stock_threshold": 5,
        "price": 55.0,
        "image_url": "/uploads/demo/haldirams-aloo-bhujia.jpg",
    },
    {
        "name": "TUC Original Salted Crackers",
        "brand": "TUC",
        "category": SnackCategory.SAVOURY.value,
        "quantity": 0,
        "low_stock_threshold": 5,
        "price": 65.0,
        "image_url": "/uploads/demo/tuc-salted-crackers.jpg",
    },
    # Drink (5)
    {
        "name": "Tropicana 100% Orange Juice",
        "brand": "Tropicana",
        "category": SnackCategory.DRINK.value,
        "quantity": 15,
        "low_stock_threshold": 5,
        "price": 120.0,
        "image_url": "/uploads/demo/tropicana-orange-juice.jpg",
    },
    {
        "name": "Paper Boat Swing Mango Drink",
        "brand": "Paper Boat",
        "category": SnackCategory.DRINK.value,
        "quantity": 20,
        "low_stock_threshold": 6,
        "price": 25.0,
        "image_url": "/uploads/demo/paper-boat-aamras.jpg",
    },
    {
        "name": "Coca-Cola Zero Sugar",
        "brand": "Coca-Cola",
        "category": SnackCategory.DRINK.value,
        "quantity": 8,
        "low_stock_threshold": 4,
        "price": 40.0,
        "image_url": "/uploads/demo/coca-cola-zero.jpg",
    },
    {
        "name": "Starbucks Doubleshot Espresso",
        "brand": "Starbucks",
        "category": SnackCategory.DRINK.value,
        "quantity": 2,
        "low_stock_threshold": 5,
        "price": 180.0,
        "image_url": "/uploads/demo/nescafe-iced-latte.jpg",
    },
    {
        "name": "Red Bull Energy Drink",
        "brand": "Red Bull",
        "category": SnackCategory.DRINK.value,
        "quantity": 0,
        "low_stock_threshold": 4,
        "price": 125.0,
        "image_url": "/uploads/demo/red-bull-energy.jpg",
    },
    # Healthy-ish (4)
    {
        "name": "Yogabar Protein Muesli Choco Almond",
        "brand": "Yogabar",
        "category": SnackCategory.HEALTHY_ISH.value,
        "quantity": 12,
        "low_stock_threshold": 5,
        "price": 95.0,
        "image_url": "/uploads/demo/yogabar-protein-bar.jpg",
    },
    {
        "name": "Special K Dark Chocolate Granola",
        "brand": "Kellogg's",
        "category": SnackCategory.HEALTHY_ISH.value,
        "quantity": 7,
        "low_stock_threshold": 5,
        "price": 220.0,
        "image_url": "/uploads/demo/kelloggs-granola.jpg",
    },
    {
        "name": "Blue Diamond Almond Nut-Thins",
        "brand": "Blue Diamond",
        "category": SnackCategory.HEALTHY_ISH.value,
        "quantity": 3,
        "low_stock_threshold": 5,
        "price": 210.0,
        "image_url": "/uploads/demo/blue-diamond-almonds.jpg",
    },
    {
        "name": "Nature Valley Crunchy Oats & Honey",
        "brand": "Nature Valley",
        "category": SnackCategory.HEALTHY_ISH.value,
        "quantity": 13,
        "low_stock_threshold": 5,
        "price": 60.0,
        "image_url": "/uploads/demo/nature-valley-oats.jpg",
    },
]

LEGACY_UPGRADE_MAP = {
    "Dark Chocolate Almonds": "Oreo Original Creme Biscuits",
    "Lotus Biscoff Cookies": "Lotus Biscoff Cookies & Spread",
    "Peanut Butter Cups": "KitKat Chocolate Wafer",
    "Cinnamon Oatmeal Cookies": "Cadbury Dairy Milk Chocolate",
    "Matcha Wafer Rolls": "Parle-G Original Gluco Biscuits",
    "Sea Salt Kettle Chips": "Lay's Classic Salted Chips",
    "Jalapeno Cheddar Popcorn": "Pringles Sour Cream & Onion",
    "Roasted Salted Cashews": "Doritos Nacho Cheese Tortillas",
    "Pretzel Crisps": "Haldiram's Aloo Bhujia",
    "Sriracha Rice Crackers": "TUC Original Salted Crackers",
    "Cold Brew Oat Latte": "Tropicana 100% Orange Juice",
    "Sparkling Yuzu Water": "Paper Boat Swing Mango Drink",
    "Kombucha Ginger Lemon": "Coca-Cola Zero Sugar",
    "Classic Iced Matcha": "Starbucks Doubleshot Espresso",
    "Greek Yogurt Protein Bar": "Yogabar Protein Muesli Choco Almond",
    "Freeze-Dried Strawberries": "Special K Dark Chocolate Granola",
    "Chia Seed Berry Pouches": "Blue Diamond Almond Nut-Thins",
    "Roasted Chickpea Puffs": "Nature Valley Crunchy Oats & Honey",
}


def seed_database() -> None:
    db = SessionLocal()
    try:
        users_by_email: dict[str, User] = {}
        for user_data in DEMO_USERS:
            existing_user = db.execute(
                select(User).where(User.email == user_data["email"])
            ).scalar_one_or_none()
            if existing_user is None:
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                )
                db.add(user)
                db.flush()
                users_by_email[user.email] = user
                print(f"[+] Created user: {user.email} ({user.role})")
            else:
                users_by_email[existing_user.email] = existing_user
                print(f"[=] User already exists: {existing_user.email}")

        # Non-destructive upgrade for legacy v1 un-imaged demo rows (preserves votes & activities)
        demo_by_name = {item["name"]: item for item in DEMO_SNACKS}
        for legacy_name, target_name in LEGACY_UPGRADE_MAP.items():
            legacy_row = db.execute(select(Snack).where(Snack.name == legacy_name)).scalar_one_or_none()
            target_exists = db.execute(select(Snack).where(Snack.name == target_name)).scalar_one_or_none()
            if legacy_row is not None and legacy_row.image_url is None and target_exists is None:
                spec = demo_by_name[target_name]
                legacy_row.name = spec["name"]
                legacy_row.brand = spec["brand"]
                legacy_row.category = spec["category"]
                legacy_row.image_url = spec["image_url"]
                legacy_row.price = spec["price"]
                db.flush()
                print(f"[~] Upgraded legacy demo snack '{legacy_name}' -> '{target_name}'")

        snacks_by_name: dict[str, Snack] = {}
        for snack_data in DEMO_SNACKS:
            existing_snack = db.execute(
                select(Snack).where(Snack.name == snack_data["name"])
            ).scalar_one_or_none()
            if existing_snack is None:
                snack = Snack(**snack_data)
                db.add(snack)
                db.flush()
                snacks_by_name[snack.name] = snack
                print(f"[+] Created snack: {snack.name} ({snack.category}, qty={snack.quantity})")
            else:
                if existing_snack.brand is None:
                    existing_snack.brand = snack_data["brand"]
                if existing_snack.image_url is None:
                    existing_snack.image_url = snack_data["image_url"]
                if existing_snack.price is None:
                    existing_snack.price = snack_data["price"]
                snacks_by_name[existing_snack.name] = existing_snack

        # Seed initial votes if no votes exist yet
        existing_vote_count = db.execute(select(func.count(Vote.id))).scalar_one()
        admin = users_by_email["admin@snackoverflow.com"]
        member = users_by_email["member@snackoverflow.com"]

        if existing_vote_count == 0:
            initial_votes = [
                (admin.id, snacks_by_name["Oreo Original Creme Biscuits"].id),
                (member.id, snacks_by_name["Oreo Original Creme Biscuits"].id),
                (member.id, snacks_by_name["Tropicana 100% Orange Juice"].id),
                (admin.id, snacks_by_name["Lay's Classic Salted Chips"].id),
                (member.id, snacks_by_name["KitKat Chocolate Wafer"].id),
            ]
            for user_id, snack_id in initial_votes:
                db.add(Vote(user_id=user_id, snack_id=snack_id))
            print(f"[+] Seeded {len(initial_votes)} initial votes")

        # Seed initial activities if none exist yet
        existing_activity_count = db.execute(select(func.count(Activity.id))).scalar_one()
        if existing_activity_count == 0:
            now = datetime.now(timezone.utc)
            sample_activities = [
                Activity(
                    user_id=admin.id,
                    snack_id=snacks_by_name["Tropicana 100% Orange Juice"].id,
                    snack_name="Tropicana 100% Orange Juice",
                    action=ActivityAction.RESTOCK.value,
                    amount=15,
                    created_at=now - timedelta(hours=5),
                ),
                Activity(
                    user_id=member.id,
                    snack_id=snacks_by_name["Oreo Original Creme Biscuits"].id,
                    snack_name="Oreo Original Creme Biscuits",
                    action=ActivityAction.CONSUME.value,
                    amount=2,
                    created_at=now - timedelta(hours=3),
                ),
                Activity(
                    user_id=member.id,
                    snack_id=snacks_by_name["KitKat Chocolate Wafer"].id,
                    snack_name="KitKat Chocolate Wafer",
                    action=ActivityAction.CONSUME.value,
                    amount=1,
                    created_at=now - timedelta(hours=2),
                ),
                Activity(
                    user_id=admin.id,
                    snack_id=snacks_by_name["Lay's Classic Salted Chips"].id,
                    snack_name="Lay's Classic Salted Chips",
                    action=ActivityAction.RESTOCK.value,
                    amount=16,
                    created_at=now - timedelta(hours=1),
                ),
                Activity(
                    user_id=member.id,
                    snack_id=snacks_by_name["Coca-Cola Zero Sugar"].id,
                    snack_name="Coca-Cola Zero Sugar",
                    action=ActivityAction.CONSUME.value,
                    amount=1,
                    created_at=now - timedelta(minutes=25),
                ),
            ]
            db.add_all(sample_activities)
            print(f"[+] Seeded {len(sample_activities)} sample activities")

        db.commit()
        print("\nSeed completed successfully!")
        print("Demo Admin:  admin@snackoverflow.com / admin123")
        print("Demo Member: member@snackoverflow.com / member123")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

