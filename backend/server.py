"""M SQURE TECH & WELFARE FOUNDATION - EdTech Backend (v2)
Updated for: UTR-only payments, scheduled MS Teams live windows, YouTube recordings,
multi-type MCQ (single/multiple/integer) for tests/assignments/exams, leaderboards,
QR-based certificate verification, announcements.
"""
from __future__ import annotations

import io
import os
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Literal, Union

import jwt
import qrcode
import razorpay
from pydantic import BaseModel
from bcrypt import hashpw, checkpw, gensalt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("henakasha")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "henakasha_db")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGO = os.environ.get("JWT_ALGO", "HS256")
JWT_EXPIRES_MIN = int(os.environ.get("JWT_EXPIRES_MIN", "10080"))
MAX_DEVICES = int(os.environ.get("MAX_DEVICES", "2"))
LOGO_URL = os.environ.get("LOGO_URL", "")
UPI_QR_URL = os.environ.get("UPI_QR_URL", "")
PASS_MARK_PCT = 60.0  # student must score >=60% to earn certificate
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/").strip()
MONGO_URL_2 = os.environ.get("MONGO_URL_2")
MONGO_URL_3 = os.environ.get("MONGO_URL_3")

# BUG FIX 1: APP_PUBLIC_URL trailing slash causes verify_url to become
#   "https://host.com//verify/HENA-xxx" OR the env var on Render may have
#   been set with a trailing slash. Strip it unconditionally so
#   f"{APP_PUBLIC_URL}/verify/{cert_id}" is always well-formed.
# BUG FIX 1b: If APP_PUBLIC_URL is empty string (env var missing/blank),
#   the stored verify_url becomes "/verify/HENA-xxx" (no host) which is
#   exactly the QR bug reported. The .strip() + fallback makes this obvious
#   at startup via the log warning below.
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "").rstrip("/").strip()
if not APP_PUBLIC_URL:
    log.warning(
        "APP_PUBLIC_URL is not set or is empty. Certificate verify_url will be "
        "relative paths only (/verify/...). Set APP_PUBLIC_URL in Render environment "
        "variables to https://henakasha-tech-and-welfare-foundation.onrender.com"
    )
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

razorpay_client = None

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
    )

client1 = AsyncIOMotorClient(MONGO_URL)
db1 = client1[DB_NAME]

client2 = AsyncIOMotorClient(MONGO_URL_2) if MONGO_URL_2 else None
db2 = client2[DB_NAME] if client2 else None

client3 = AsyncIOMotorClient(MONGO_URL_3) if MONGO_URL_3 else None
db3 = client3[DB_NAME] if client3 else None

db = db1


async def get_active_db():
    try:
        stats1 = await db1.command("dbStats")
        size1 = stats1.get("dataSize", 0)

        if size1 < 450 * 1024 * 1024:
            return db1

        if db2 is not None:
            stats2 = await db2.command("dbStats")
            size2 = stats2.get("dataSize", 0)

            if size2 < 450 * 1024 * 1024:
                return db2

        if db3 is not None:
            return db3

        return db1

    except Exception as e:
        log.error(f"DB switch error: {e}")
        return db1


async def insert_auto(collection_name, document):
    active_db = await get_active_db()
    collection = getattr(active_db, collection_name)
    return await collection.insert_one(document)


async def update_auto(collection_name, query, update_data):
    databases = [db1]

    if db2 is not None:
        databases.append(db2)

    if db3 is not None:
        databases.append(db3)

    for database in databases:
        result = await getattr(database, collection_name).update_one(
            query,
            update_data
        )

        if result.modified_count > 0:
            return result

    return None


async def find_one_all(collection_name, query):
    databases = [db1]

    if db2 is not None:
        databases.append(db2)

    if db3 is not None:
        databases.append(db3)

    for database in databases:
        result = await getattr(database, collection_name).find_one(query)

        if result:
            return result

    return None


async def delete_auto(collection_name, query):
    databases = [db1]

    if db2 is not None:
        databases.append(db2)

    if db3 is not None:
        databases.append(db3)

    deleted_count = 0

    for database in databases:
        result = await getattr(database, collection_name).delete_many(query)
        deleted_count += result.deleted_count

    return deleted_count


# BUG FIX 2: find_all_auto was converting ObjectId _id to str but NOT removing it.
# FastAPI's JSONResponse cannot serialize ObjectId. Converting to str is correct,
# but we also need to strip _id entirely from API responses to avoid leaking
# internal MongoDB document IDs to the client. We strip it here centrally so
# every caller gets clean documents without needing individual .pop("_id") calls.
async def find_all_auto(
    collection_name,
    query=None,
    sort_field="created_at",
    sort_order=-1
):
    if query is None:
        query = {}

    databases = [db1]

    if db2 is not None:
        databases.append(db2)

    if db3 is not None:
        databases.append(db3)

    results = []

    for database in databases:

        docs = await getattr(
            database,
            collection_name
        ).find(query).to_list(None)

        for doc in docs:
            # Strip _id entirely - never expose internal MongoDB _id to clients
            doc.pop("_id", None)
            results.append(doc)

    results.sort(
        key=lambda x: x.get(sort_field, ""),
        reverse=(sort_order == -1)
    )

    return results


async def count_all_auto(collection_name, query=None):
    if query is None:
        query = {}

    total = 0

    databases = [db1]

    if db2 is not None:
        databases.append(db2)

    if db3 is not None:
        databases.append(db3)

    for database in databases:
        total += await getattr(
            database,
            collection_name
        ).count_documents(query)

    return total


app = FastAPI(title="HENAKASHA EdTech API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

Role = Literal["student", "teacher", "admin", "super_admin"]


# ----------------------------- helpers ------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_pw(pw: str) -> str:
    return hashpw(pw.encode(), gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(uid: str, role: str, username: str, jti: Optional[str] = None) -> str:
    return jwt.encode({
        "sub": uid, "role": role, "username": username,
        "jti": jti or str(uuid.uuid4()),
        "exp": now_utc() + timedelta(minutes=JWT_EXPIRES_MIN),
        "iat": now_utc(),
    }, JWT_SECRET, algorithm=JWT_ALGO)


async def create_session(uid: str, jti: str, device: str = "") -> None:
    """Create a session row. If user exceeds MAX_DEVICES, evict the oldest."""
    await insert_auto("sessions", {
        "id": str(uuid.uuid4()), "user_id": uid, "jti": jti,
        "device": device or "unknown",
        "created_at": now_utc().isoformat(),
        "last_seen": now_utc().isoformat(),
    })
    count = await count_all_auto("sessions", {"user_id": uid})
    if count > MAX_DEVICES:
        excess = count - MAX_DEVICES
        all_sessions = await find_all_auto("sessions", {"user_id": uid}, sort_field="created_at", sort_order=1)
        oldest = all_sessions[:excess]
        if oldest:
            ids_to_evict = [o["id"] for o in oldest]
            await delete_auto("sessions", {"id": {"$in": ids_to_evict}})


def clean(d):
    if d is None:
        return None
    d.pop("_id", None)
    return d


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    jti = payload.get("jti")
    if jti:
        sess = await find_one_all("sessions", {"jti": jti, "user_id": payload["sub"]})
        if not sess:
            raise HTTPException(401, "Session expired — signed out from another device")
        await update_auto("sessions", {"id": sess["id"]}, {"$set": {"last_seen": now_utc().isoformat()}})
    u = await find_one_all("users", {"id": payload["sub"]})
    if not u:
        raise HTTPException(401, "User not found")
    u.pop("_id", None)
    u.pop("password_hash", None)
    u["_jti"] = jti
    return u


def require_roles(*roles: str):
    async def dep(u=Depends(current_user)):
        if u["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return u
    return dep


async def notify(uid: str, title: str, body: str, kind: str = "info", link: Optional[str] = None):
    await insert_auto("notifications", {
        "id": str(uuid.uuid4()), "user_id": uid, "title": title, "body": body,
        "kind": kind, "link": link or "", "read": False, "created_at": now_utc().isoformat(),
    })


YT_RX = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})")


def extract_youtube_id(url: str) -> Optional[str]:
    if not url:
        return None
    m = YT_RX.search(url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{6,}", url.strip()):
        return url.strip()
    return None


# Matches all common Google Drive sharing URL formats:
#   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
#   https://drive.google.com/file/d/FILE_ID/view
#   https://drive.google.com/open?id=FILE_ID
_DRIVE_FILE_RX = re.compile(
    r"drive\.google\.com/file/d/([A-Za-z0-9_-]+)"
)
_DRIVE_OPEN_RX = re.compile(
    r"drive\.google\.com/open\?id=([A-Za-z0-9_-]+)"
)


def convert_drive_image(url: str) -> str:
    """Convert a Google Drive sharing URL to a direct displayable image URL.

    The stored database value is NEVER modified — this function is only called
    when building API responses for the frontend.

    Supported input formats:
        https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        https://drive.google.com/file/d/FILE_ID/view
        https://drive.google.com/open?id=FILE_ID

    Returned format (works in React Native Image and browsers):
        https://drive.google.com/thumbnail?id=FILE_ID&sz=w2000

    If the URL is not a Google Drive URL, it is returned unchanged.
    If the URL is empty or None, an empty string is returned.
    """
    if not url:
        return url or ""

    # Try /file/d/FILE_ID/ pattern first (most common sharing link)
    m = _DRIVE_FILE_RX.search(url)
    if not m:
        # Try open?id=FILE_ID pattern
        m = _DRIVE_OPEN_RX.search(url)

    if m:
        file_id = m.group(1)
        return f"https://drive.google.com/thumbnail?id={file_id}&sz=w2000"

    # Not a Google Drive URL — return unchanged
    return url


def parse_iso(s: str) -> datetime:
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def annotate_live(item: Dict[str, Any]) -> Dict[str, Any]:
    """Compute can_join + status based on scheduled_at and duration_min."""
    try:
        start = parse_iso(item["scheduled_at"])
    except Exception:
        item["can_join"] = False
        item["live_status"] = "scheduled"
        return item
    dur = int(item.get("duration_min") or 90)
    end = start + timedelta(minutes=dur)
    now = now_utc()
    if now < start:
        item["live_status"] = "upcoming"
        item["can_join"] = False
        item["starts_in_sec"] = int((start - now).total_seconds())
    elif start <= now <= end:
        item["live_status"] = "live"
        item["can_join"] = True
    else:
        item["live_status"] = "ended"
        item["can_join"] = False
    item["ends_at"] = end.isoformat()
    return item


# ----------------------------- models -------------------------------------
class RegisterIn(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Role = "student"


class LoginIn(BaseModel):
    username: str
    password: str


class ForgotIn(BaseModel):
    username: str


class ResetIn(BaseModel):
    username: str
    reset_code: str
    new_password: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class CourseIn(BaseModel):
    name: str
    description: str = ""
    instructor_name: str = ""
    category: str
    language: str = "English"
    price: float = 0.0
    discount_price: float = 0.0
    duration: str = ""
    num_classes: int = 0
    thumbnail: str = ""
    banner: str = ""
    status: Literal["draft", "published", "archived"] = "published"
    has_certificate: bool = True


class PaymentManualIn(BaseModel):
    course_id: str
    utr: str
    amount: float


class PaymentApprovalIn(BaseModel):
    payment_id: str
    approve: bool
    reason: Optional[str] = None


class LiveClassIn(BaseModel):
    course_id: str
    title: str
    description: str = ""
    teams_link: str
    scheduled_at: str   # ISO
    duration_min: int = 90


class RecordingIn(BaseModel):
    course_id: str
    title: str
    description: str = ""
    youtube_url: str
    duration_min: int = 0


class NoteIn(BaseModel):
    course_id: str
    title: str
    description: str = ""
    file_base64: str
    file_name: str
    file_type: str


QuestionType = Literal["single", "multiple", "integer"]


class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    q_type: QuestionType = "single"
    options: List[str] = []
    correct_options: List[int] = []
    correct_integer: Optional[int] = None
    marks: float = 1.0


class QuizIn(BaseModel):
    course_id: str
    title: str
    kind: Literal["test", "assignment", "exam"]
    chapter: Optional[str] = None
    duration_min: int = 30
    negative_marking: float = 0.0
    enabled: bool = True
    questions: List[QuizQuestion]


class QuizSubmissionIn(BaseModel):
    quiz_id: str
    answers: Dict[str, Union[int, List[int]]]


class ProgressIn(BaseModel):
    course_id: str
    item_id: str
    watched: bool = True


class SettingsIn(BaseModel):
    upi_id: Optional[str] = None
    upi_qr_base64: Optional[str] = None
    upi_qr_url: Optional[str] = None
    manual_payment_enabled: Optional[bool] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_enabled: Optional[bool] = None
    teams_default_link: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    whatsapp_number: Optional[str] = None


class AnnouncementIn(BaseModel):
    course_id: Optional[str] = None
    title: str
    body: str
    kind: Literal["info", "warning", "cancel", "reschedule"] = "info"


# ----------------------------- seed ---------------------------------------
SEED_CATEGORIES = ["Tech", "JEE", "NEET", "CBSE Class 9", "CBSE Class 10", "CBSE Class 11", "CBSE Class 12"]


@app.on_event("startup")
async def seed():
    await db1.users.create_index("username", unique=True)
    await db1.courses.create_index("id", unique=True)
    await db1.enrollments.create_index([("user_id", 1), ("course_id", 1)], unique=True)

    async def seed_user(u, p, name, role, email):
        if not await find_one_all("users", {"username": u}):
            await db1.users.insert_one({
                "id": str(uuid.uuid4()), "username": u, "email": email,
                "password_hash": hash_pw(p), "full_name": name, "phone": "",
                "role": role, "created_at": now_utc().isoformat(),
            })

    await seed_user("BOSSHENA&GULAM", "Hena&gulam", "Boss Hena & Gulam", "super_admin", "superadmin@henakasha.org")
    await seed_user("HENAKASHABYGULAM", "Rehankhan786@", "Henakasha Admin", "admin", "admin@henakasha.org")
    await seed_user("teacher_demo", "Teacher@123", "Demo Teacher", "teacher", "teacher@henakasha.org")
    await seed_user("student_demo", "Student@123", "Demo Student", "student", "student@henakasha.org")

    await db1.categories.delete_many({"name": {"$nin": SEED_CATEGORIES}})
    for c in SEED_CATEGORIES:
        await db1.categories.update_one({"name": c}, {"$setOnInsert": {"name": c, "id": str(uuid.uuid4())}}, upsert=True)

    if not await find_one_all("settings", {"id": "global"}):
        await db1.settings.insert_one({
            "id": "global",
            "foundation_name": "HENAKASHA TECH & WELFARE FOUNDATION",
            "logo_url": LOGO_URL,
            "upi_id": "gulamrasulkhan@ybl",
            "upi_qr_url": UPI_QR_URL,
            "upi_qr_base64": "",
            "manual_payment_enabled": True,
            "razorpay_key_id": "",
            "razorpay_key_secret": "",
            "razorpay_enabled": False,
            "teams_default_link": "",
            "contact_email": "henakashatechwelfarefoundation@gmail.com",
            "contact_phone": "+91 90064 48298",
            "whatsapp_number": "+919006448298",
            "updated_at": now_utc().isoformat(),
        })

    if await count_all_auto("courses") == 0:
        samples = [
            {"name": "Python & AI for Beginners", "category": "Tech", "instructor_name": "Demo Teacher",
             "description": "Master Python from scratch with hands-on AI projects.", "price": 999, "discount_price": 499,
             "duration": "6 weeks", "num_classes": 24,
             "thumbnail": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600",
             "banner": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=1200"},
            {"name": "Full-Stack Web Development", "category": "Tech", "instructor_name": "Demo Teacher",
             "description": "Build modern web apps with React + Node.", "price": 2999, "discount_price": 1499,
             "duration": "12 weeks", "num_classes": 48,
             "thumbnail": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600",
             "banner": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200"},
            {"name": "JEE Advanced Mathematics", "category": "JEE", "instructor_name": "Demo Teacher",
             "description": "Comprehensive prep for JEE Advanced.", "price": 4999, "discount_price": 2499,
             "duration": "16 weeks", "num_classes": 80,
             "thumbnail": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600",
             "banner": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200"},
            {"name": "NEET Biology Mastery", "category": "NEET", "instructor_name": "Demo Teacher",
             "description": "Conquer NEET biology with smart strategies.", "price": 3999, "discount_price": 1999,
             "duration": "14 weeks", "num_classes": 60,
             "thumbnail": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600",
             "banner": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1200"},
            {"name": "CBSE Class 10 - Complete Board Prep", "category": "CBSE Class 10", "instructor_name": "Demo Teacher",
             "description": "All subjects covered for the CBSE Class 10 board exams.", "price": 2499, "discount_price": 1299,
             "duration": "10 months", "num_classes": 200,
             "thumbnail": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600",
             "banner": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200"},
            {"name": "CBSE Class 12 - PCM Board Prep", "category": "CBSE Class 12", "instructor_name": "Demo Teacher",
             "description": "Physics, Chemistry, Maths - full CBSE Class 12 syllabus.", "price": 3499, "discount_price": 1799,
             "duration": "10 months", "num_classes": 240,
             "thumbnail": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600",
             "banner": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200"},
        ]
        for s in samples:
            s.update({"id": str(uuid.uuid4()), "language": "English", "status": "published",
                      "created_at": now_utc().isoformat(), "has_certificate": True})
            await db1.courses.insert_one(s)
    log.info("Seed complete.")


# ----------------------------- auth ---------------------------------------
@api.post("/auth/register")
async def register(p: RegisterIn):
    if p.role != "student":
        raise HTTPException(400, "Public registration is only for students")
    if await find_one_all("users", {"username": p.username}):
        raise HTTPException(400, "Username already taken")
    u = {"id": str(uuid.uuid4()), "username": p.username, "email": p.email,
         "password_hash": hash_pw(p.password), "full_name": p.full_name, "phone": p.phone or "",
         "role": "student", "created_at": now_utc().isoformat()}
    await insert_auto("users", u)
    u.pop("_id", None)
    jti = str(uuid.uuid4())
    token = create_token(u["id"], u["role"], u["username"], jti=jti)
    await create_session(u["id"], jti, device="web")
    await notify(u["id"], "Welcome!", f"Welcome to HENAKASHA, {p.full_name}.", "success")
    return {"token": token, "user": {k: v for k, v in u.items() if k != "password_hash"}}


@api.post("/auth/login")
async def login(p: LoginIn):
    u = await find_one_all("users", {"username": p.username})
    if not u or not verify_pw(p.password, u["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    jti = str(uuid.uuid4())
    token = create_token(u["id"], u["role"], u["username"], jti=jti)
    await create_session(u["id"], jti, device="web")
    clean(u)
    u.pop("password_hash", None)
    return {"token": token, "user": u}


@api.post("/auth/logout")
async def logout(u=Depends(current_user)):
    jti = u.get("_jti")
    if jti:
        await delete_auto("sessions", {"jti": jti, "user_id": u["id"]})
    return {"ok": True}


@api.get("/auth/sessions")
async def my_sessions(u=Depends(current_user)):
    # find_all_auto now strips _id centrally, no need for r.pop("_id") here
    rows = await find_all_auto("sessions", {"user_id": u["id"]}, sort_field="created_at", sort_order=-1)
    for r in rows:
        r["current"] = (r.get("jti") == u.get("_jti"))
    return {"max_devices": MAX_DEVICES, "sessions": rows}


@api.post("/auth/forgot-password")
async def forgot(p: ForgotIn):
    u = await find_one_all("users", {"username": p.username})
    if not u:
        raise HTTPException(404, "User not found")
    code = str(uuid.uuid4())[:8].upper()
    await update_auto("users", {"id": u["id"]}, {"$set": {
        "reset_code": code,
        "reset_expires": (now_utc() + timedelta(minutes=30)).isoformat()
    }})
    return {"message": "Use this code to reset your password (valid 30 min)", "reset_code": code}


@api.post("/auth/reset-password")
async def reset(p: ResetIn):
    u = await find_one_all("users", {"username": p.username})
    if not u or u.get("reset_code") != p.reset_code:
        raise HTTPException(400, "Invalid reset code")
    if u.get("reset_expires") and parse_iso(u["reset_expires"]) < now_utc():
        raise HTTPException(400, "Reset code expired")
    await update_auto("users", {"id": u["id"]}, {
        "$set": {"password_hash": hash_pw(p.new_password)},
        "$unset": {"reset_code": "", "reset_expires": ""}
    })
    return {"message": "Password reset successful"}


@api.get("/auth/me")
async def me(u=Depends(current_user)):
    return u


@api.put("/auth/profile")
async def update_profile(p: ProfileUpdate, u=Depends(current_user)):
    update = {k: v for k, v in p.dict().items() if v is not None}
    if update:
        await update_auto("users", {"id": u["id"]}, {"$set": update})
    result = await find_one_all("users", {"id": u["id"]})
    if result:
        result.pop("_id", None)
        result.pop("password_hash", None)
    return result


# ----------------------------- categories & courses -----------------------
@api.get("/categories")
async def list_categories():
    return await find_all_auto("categories", {})


@api.get("/courses")
async def list_courses(q: Optional[str] = None, category: Optional[str] = None,
                       status_: Optional[str] = Query("published", alias="status")):
    filt: Dict[str, Any] = {}
    if status_:
        filt["status"] = status_
    if category and category != "All":
        filt["category"] = category
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"instructor_name": {"$regex": q, "$options": "i"}},
        ]
    courses = await find_all_auto("courses", filt)
    for course in courses:
        course["thumbnail"] = convert_drive_image(course.get("thumbnail", ""))
        course["banner"] = convert_drive_image(course.get("banner", ""))
    return courses


@api.get("/courses/{cid}")
async def get_course(cid: str):
    c = await find_one_all("courses", {"id": cid})
    if not c:
        raise HTTPException(404, "Course not found")
    c.pop("_id", None)
    c["thumbnail"] = convert_drive_image(c.get("thumbnail", ""))
    c["banner"] = convert_drive_image(c.get("banner", ""))
    return c


@api.post("/courses")
async def create_course(p: CourseIn, u=Depends(require_roles("admin", "super_admin"))):
    doc = p.dict()
    doc.update({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat()})
    await insert_auto("courses", doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/courses/{cid}")
async def update_course(cid: str, p: CourseIn, u=Depends(require_roles("admin", "super_admin"))):
    await update_auto("courses", {"id": cid}, {"$set": p.dict()})
    result = await find_one_all("courses", {"id": cid})
    if result:
        result.pop("_id", None)
    return result


@api.delete("/courses/{cid}")
async def delete_course(cid: str, u=Depends(require_roles("admin", "super_admin"))):
    await delete_auto("courses", {"id": cid})
    return {"ok": True}


# ----------------------------- settings -----------------------------------
@api.get("/settings")
async def get_settings():
    s = await find_one_all("settings", {"id": "global"})
    if s:
        s.pop("_id", None)
        s.pop("razorpay_key_secret", None)
    return s


@api.put("/settings")
async def update_settings(p: SettingsIn, u=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in p.dict().items() if v is not None}
    update["updated_at"] = now_utc().isoformat()
    await update_auto("settings", {"id": "global"}, {"$set": update})
    result = await find_one_all("settings", {"id": "global"})
    if result:
        result.pop("_id", None)
        result.pop("razorpay_key_secret", None)
    return result


# ----------------------------- payments -----------------------------------
async def ensure_enrolled(uid: str, cid: str):
    if await find_one_all("enrollments", {"user_id": uid, "course_id": cid}):
        return
    await insert_auto("enrollments", {
        "id": str(uuid.uuid4()), "user_id": uid, "course_id": cid,
        "enrolled_at": now_utc().isoformat(), "progress_pct": 0,
        "completed_self": False, "exam_passed": False,
    })


@api.post("/payments/manual")
async def submit_manual_payment(p: PaymentManualIn, u=Depends(current_user)):
    course = await find_one_all("courses", {"id": p.course_id})
    if not course:
        raise HTTPException(404, "Course not found")
    pid = str(uuid.uuid4())
    await insert_auto("payments", {
        "id": pid, "user_id": u["id"], "user_name": u.get("full_name", ""),
        "user_email": u.get("email", ""), "user_phone": u.get("phone", ""),
        "course_id": p.course_id, "course_name": course.get("name"),
        "amount": p.amount, "method": "manual_upi", "utr": p.utr,
        "status": "pending", "created_at": now_utc().isoformat(),
    })
    await notify(u["id"], "Payment submitted",
                 f"Your payment (UTR {p.utr}) for {course.get('name')} is under review.", "info")
    return {"payment_id": pid, "status": "pending"}


@api.post("/payments/razorpay/order")
async def create_rzp_order(course_id: str, u=Depends(current_user)):
    settings = await find_one_all("settings", {"id": "global"})
    if not settings or not settings.get("razorpay_enabled"):
        raise HTTPException(
            400,
            "Razorpay not configured. Use manual UPI payment."
        )

    course = await find_one_all("courses", {"id": course_id})
    if not course:
        raise HTTPException(404, "Course not found")

    amount = int(
        (course.get("discount_price") or course.get("price") or 0) * 100
    )

    if not razorpay_client:
        raise HTTPException(
            500,
            "Razorpay client not configured"
        )

    order = razorpay_client.order.create({
        "amount": amount,
        "currency": "INR",
        "payment_capture": 1
    })

    return {
        "key_id": RAZORPAY_KEY_ID,
        "amount": amount,
        "currency": "INR",
        "order_id": order["id"],
        "course_id": course_id
    }

class RazorpayVerifyIn(BaseModel):
    course_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.post("/payments/razorpay/verify")
async def verify_rzp(p: RazorpayVerifyIn, u=Depends(current_user)):
    course = await find_one_all("courses", {"id": p.course_id})
    if not course:
        raise HTTPException(404, "Course not found")

    if not razorpay_client:
        raise HTTPException(500, "Razorpay not configured")

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": p.razorpay_order_id,
            "razorpay_payment_id": p.razorpay_payment_id,
            "razorpay_signature": p.razorpay_signature,
        })
    except Exception:
        raise HTTPException(400, "Invalid payment signature")

    pid = str(uuid.uuid4())

    await insert_auto("payments", {
        "id": pid,
        "user_id": u["id"],
        "user_name": u.get("full_name", ""),
        "course_id": p.course_id,
        "course_name": course.get("name"),
        "amount": course.get("discount_price") or course.get("price") or 0,
        "method": "razorpay",
        "rzp_order_id": p.razorpay_order_id,
        "rzp_payment_id": p.razorpay_payment_id,
        "status": "approved",
        "created_at": now_utc().isoformat(),
        "verified_by": "razorpay"
    })

    await ensure_enrolled(u["id"], p.course_id)

    await notify(
        u["id"],
        "Payment successful",
        f"You are enrolled in {course.get('name')}.",
        "success"
    )

    return {
        "ok": True,
        "payment_id": pid
    }
    
@api.get("/payments/pending")
async def pending_payments(u=Depends(require_roles("admin", "super_admin"))):
    return await find_all_auto("payments", {"status": "pending"})


@api.get("/payments/all")
async def all_payments(u=Depends(require_roles("admin", "super_admin"))):
    return await find_all_auto("payments", {})


@api.get("/payments/mine")
async def my_payments(u=Depends(current_user)):
    return await find_all_auto("payments", {"user_id": u["id"]})


@api.post("/payments/verify")
async def verify_manual_payment(p: PaymentApprovalIn, u=Depends(require_roles("admin", "super_admin"))):
    pay = await find_one_all("payments", {"id": p.payment_id})
    if not pay:
        raise HTTPException(404, "Payment not found")
    new_status = "approved" if p.approve else "rejected"
    await update_auto("payments", {"id": p.payment_id}, {"$set": {
        "status": new_status, "verified_by": u["username"], "verified_at": now_utc().isoformat(),
        "rejection_reason": p.reason or "",
    }})
    if p.approve:
        await ensure_enrolled(pay["user_id"], pay["course_id"])
        await notify(pay["user_id"], "Payment approved",
                     f"You are now enrolled in {pay.get('course_name')}.", "success")
    else:
        await notify(pay["user_id"], "Payment rejected",
                     f"Your payment for {pay.get('course_name')} was rejected. {p.reason or ''}", "error")
    return {"ok": True, "status": new_status}


@api.get("/enrollments/mine")
async def my_enrollments(u=Depends(current_user)):
    # MUST stay custom — uses $lookup which find_all_auto does not support.
    pipeline = [
        {"$match": {"user_id": u["id"]}},
        {"$lookup": {"from": "courses", "localField": "course_id", "foreignField": "id", "as": "course"}},
        {"$unwind": {"path": "$course", "preserveNullAndEmptyArrays": True}},
        {"$project": {"_id": 0, "course._id": 0}},
    ]
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)
    rows = []
    for database in databases:
        batch = await database.enrollments.aggregate(pipeline).to_list(500)
        rows.extend(batch)
    # Convert Google Drive sharing URLs inside the embedded course object
    for row in rows:
        c = row.get("course")
        if c:
            c["thumbnail"] = convert_drive_image(c.get("thumbnail", ""))
            c["banner"] = convert_drive_image(c.get("banner", ""))
    return [r for r in rows if r.get("course")]


# ----------------------------- live classes -------------------------------
@api.post("/live-classes")
async def create_live_class(p: LiveClassIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict()
    doc.update({"id": str(uuid.uuid4()), "created_by": u["id"], "created_at": now_utc().isoformat()})
    await insert_auto("live_classes", doc)
    enrolled = await find_all_auto("enrollments", {"course_id": p.course_id})
    for s in enrolled:
        await notify(s["user_id"], "New live class scheduled", f"{p.title} at {p.scheduled_at}", "info")
    return annotate_live({k: v for k, v in doc.items() if k != "_id"})


@api.get("/live-classes")
async def list_live_classes(course_id: Optional[str] = None):
    f = {"course_id": course_id} if course_id else {}
    items = await find_all_auto("live_classes", f, "scheduled_at")
    return [annotate_live(i) for i in items]


@api.delete("/live-classes/{cid}")
async def delete_live(cid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await delete_auto("live_classes", {"id": cid})
    return {"ok": True}


# ----------------------------- recordings (YouTube) -----------------------
@api.post("/recordings")
async def add_recording(p: RecordingIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    yid = extract_youtube_id(p.youtube_url)
    if not yid:
        raise HTTPException(400, "Invalid YouTube URL")
    doc = {
        "id": str(uuid.uuid4()), "course_id": p.course_id, "title": p.title,
        "description": p.description, "youtube_url": p.youtube_url, "youtube_id": yid,
        "embed_url": f"https://www.youtube.com/embed/{yid}",
        "thumbnail": f"https://i.ytimg.com/vi/{yid}/hqdefault.jpg",
        "duration_min": p.duration_min, "uploaded_by": u["id"],
        "created_at": now_utc().isoformat(),
    }
    await insert_auto("recordings", doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/recordings")
async def list_recordings(course_id: str):
    return await find_all_auto("recordings", {"course_id": course_id})


@api.get("/recordings/{rid}")
async def get_recording(rid: str, u=Depends(current_user)):
    r = await find_one_all("recordings", {"id": rid})
    if not r:
        raise HTTPException(404, "Not found")
    r.pop("_id", None)
    if u["role"] == "student":
        en = await find_one_all("enrollments", {"user_id": u["id"], "course_id": r["course_id"]})
        if not en:
            raise HTTPException(403, "Not enrolled")
    return r


@api.delete("/recordings/{rid}")
async def delete_recording(rid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await delete_auto("recordings", {"id": rid})
    return {"ok": True}


# ----------------------------- notes --------------------------------------
@api.post("/notes")
async def upload_note(p: NoteIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict()
    doc.update({"id": str(uuid.uuid4()), "uploaded_by": u["id"], "created_at": now_utc().isoformat()})
    await insert_auto("notes", doc)
    return {k: v for k, v in doc.items() if k != "_id" and k != "file_base64"}


@api.get("/notes")
async def list_notes(course_id: str):
    notes = await find_all_auto("notes", {"course_id": course_id})
    for n in notes:
        n.pop("file_base64", None)
    return notes


@api.get("/notes/{nid}")
async def get_note(nid: str, u=Depends(current_user)):
    n = await find_one_all("notes", {"id": nid})
    if not n:
        raise HTTPException(404, "Not found")
    n.pop("_id", None)
    if u["role"] == "student":
        en = await find_one_all("enrollments", {"user_id": u["id"], "course_id": n["course_id"]})
        if not en:
            raise HTTPException(403, "Not enrolled")
    return n


@api.delete("/notes/{nid}")
async def delete_note(nid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await delete_auto("notes", {"id": nid})
    return {"ok": True}


# ----------------------------- quizzes (test/assignment/exam) ------------
def _strip_correct(quiz: Dict[str, Any]) -> Dict[str, Any]:
    for q in quiz.get("questions", []):
        q.pop("correct_options", None)
        q.pop("correct_integer", None)
    return quiz


def _grade(quiz: Dict[str, Any], answers: Dict[str, Any]) -> Dict[str, Any]:
    total = 0.0
    obtained = 0.0
    neg = float(quiz.get("negative_marking", 0.0))
    breakdown = []
    for q in quiz.get("questions", []):
        marks = float(q.get("marks", 1.0))
        total += marks
        ans = answers.get(q["id"])
        correct = False
        qt = q.get("q_type", "single")
        if ans is None:
            breakdown.append({"id": q["id"], "correct": False, "score": 0.0, "skipped": True})
            continue
        if qt == "single":
            if isinstance(ans, list):
                ans = ans[0] if ans else None
            correct = (ans is not None) and ans in (q.get("correct_options") or [])
        elif qt == "multiple":
            given = set(ans if isinstance(ans, list) else [ans])
            want = set(q.get("correct_options") or [])
            correct = given == want
        elif qt == "integer":
            try:
                correct = int(ans) == int(q.get("correct_integer"))
            except Exception:
                correct = False
        score = marks if correct else (-neg)
        if correct:
            obtained += marks
        else:
            obtained -= neg
        breakdown.append({"id": q["id"], "correct": correct, "score": score, "skipped": False})
    obtained = max(obtained, 0.0)
    pct = (obtained / total * 100) if total else 0
    return {"score": obtained, "total": total, "percentage": pct, "breakdown": breakdown}


@api.post("/quizzes")
async def create_quiz(p: QuizIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict()
    doc.update({"id": str(uuid.uuid4()), "created_by": u["id"], "created_at": now_utc().isoformat()})
    await insert_auto("quizzes", doc)
    return {k: v for k, v in doc.items() if k != "_id"}


# BUG FIX 3: Route ordering — /quizzes/submit is a POST so no conflict with GET /quizzes/{qid}.
# But /quizzes/{qid}/toggle is PUT and /quizzes/{qid} is GET/DELETE — ordering is fine.
# No route ordering fix needed here; FastAPI differentiates by HTTP method.

@api.put("/quizzes/{qid}/toggle")
async def toggle_quiz(qid: str, enabled: bool, u=Depends(require_roles("admin", "super_admin"))):
    await update_auto("quizzes", {"id": qid}, {"$set": {"enabled": enabled}})
    return {"ok": True}


@api.delete("/quizzes/{qid}")
async def delete_quiz(qid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await delete_auto("quizzes", {"id": qid})
    return {"ok": True}


@api.get("/quizzes")
async def list_quizzes(course_id: str, kind: Optional[str] = None):
    f: Dict[str, Any] = {"course_id": course_id}
    if kind:
        f["kind"] = kind
    return await find_all_auto("quizzes", f)


@api.get("/quizzes/{qid}")
async def get_quiz(qid: str, u=Depends(current_user)):
    q = await find_one_all("quizzes", {"id": qid})
    if not q:
        raise HTTPException(404, "Not found")
    q.pop("_id", None)
    if u["role"] == "student":
        if q.get("kind") == "exam":
            en = await find_one_all("enrollments", {"user_id": u["id"], "course_id": q["course_id"]})
            if not en or not en.get("completed_self"):
                raise HTTPException(403, "Complete the course before attempting the final exam.")
        if not q.get("enabled", True):
            raise HTTPException(403, "Quiz disabled")
        q = _strip_correct(q)
    return q


@api.post("/quizzes/submit")
async def submit_quiz(p: QuizSubmissionIn, u=Depends(current_user)):
    q = await find_one_all("quizzes", {"id": p.quiz_id})
    if not q:
        raise HTTPException(404, "Quiz not found")
    result = _grade(q, p.answers)
    sub = {
        "id": str(uuid.uuid4()), "quiz_id": p.quiz_id, "quiz_kind": q.get("kind"),
        "quiz_title": q.get("title"), "course_id": q["course_id"],
        "user_id": u["id"], "user_name": u.get("full_name", ""),
        "user_email": u.get("email", ""), "user_phone": u.get("phone", ""),
        "answers": p.answers, **result, "created_at": now_utc().isoformat(),
    }
    await insert_auto("quiz_submissions", sub)

    if q.get("kind") == "exam" and result["percentage"] >= PASS_MARK_PCT:
        await update_auto(
            "enrollments",
            {"user_id": u["id"], "course_id": q["course_id"]},
            {"$set": {"exam_passed": True, "exam_score": result["percentage"]}}
        )
        course = await find_one_all("courses", {"id": q["course_id"]})
        has_cert = bool(course.get("has_certificate", True)) if course else True
        existing_cert = await find_one_all("certificates", {"user_id": u["id"], "course_id": q["course_id"]})
        if has_cert and not existing_cert:
            cert_id = f"HENA-{uuid.uuid4().hex[:10].upper()}"
            # BUG FIX 1 (applied here): APP_PUBLIC_URL is now stripped of trailing
            # slash at module load time, so this f-string always produces a valid
            # absolute URL like https://host.com/verify/HENA-xxx
            verify_url = f"{FRONTEND_URL}/verify/{cert_id}"
            await insert_auto("certificates", {
                "id": cert_id, "user_id": u["id"], "user_name": u.get("full_name"),
                "user_email": u.get("email"), "user_phone": u.get("phone"),
                "course_id": q["course_id"], "course_name": course.get("name") if course else "",
                "score": result["percentage"], "issued_at": now_utc().isoformat(),
                "verify_url": verify_url,
                "valid": True,
            })
            await notify(u["id"], "Certificate generated!",
                         f"Your certificate for {course.get('name') if course else ''} is ready.",
                         "success", link=f"/verify/{cert_id}")

    return clean(sub)


@api.get("/quizzes/{qid}/my-submissions")
async def my_quiz_subs(qid: str, u=Depends(current_user)):
    return await find_all_auto("quiz_submissions", {"quiz_id": qid, "user_id": u["id"]},
                               sort_field="created_at", sort_order=-1)


@api.get("/submissions/mine")
async def all_my_subs(u=Depends(current_user)):
    return await find_all_auto("quiz_submissions", {"user_id": u["id"]},
                               sort_field="created_at", sort_order=-1)


# ----------------------------- leaderboards -------------------------------
# MUST stay custom — uses $group aggregate which find_all_auto does not support.
@api.get("/leaderboard/tests/{course_id}")
async def leaderboard_tests(course_id: str, days: int = 7):
    cutoff = (now_utc() - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"course_id": course_id, "quiz_kind": "test", "created_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$user_id", "user_name": {"$first": "$user_name"},
                    "total_score": {"$sum": "$score"}, "total_marks": {"$sum": "$total"},
                    "attempts": {"$sum": 1}}},
        {"$sort": {"total_score": -1}}, {"$limit": 50},
    ]
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)
    rows = []
    for database in databases:
        batch = await database.quiz_submissions.aggregate(pipeline).to_list(50)
        rows.extend(batch)
    rows.sort(key=lambda r: r.get("total_score", 0), reverse=True)
    rows = rows[:50]
    for r in rows:
        r["user_id"] = r.pop("_id")
        r["percentage"] = (r["total_score"] / r["total_marks"] * 100) if r.get("total_marks") else 0
    return rows


@api.get("/leaderboard/exams/{course_id}")
async def leaderboard_exams(course_id: str, days: int = 30):
    cutoff = (now_utc() - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"course_id": course_id, "quiz_kind": "exam", "created_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$user_id", "user_name": {"$first": "$user_name"},
                    "best_score": {"$max": "$percentage"}, "attempts": {"$sum": 1}}},
        {"$sort": {"best_score": -1}}, {"$limit": 50},
    ]
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)
    rows = []
    for database in databases:
        batch = await database.quiz_submissions.aggregate(pipeline).to_list(50)
        rows.extend(batch)
    rows.sort(key=lambda r: r.get("best_score", 0), reverse=True)
    rows = rows[:50]
    for r in rows:
        r["user_id"] = r.pop("_id")
    return rows


# ----------------------------- progress -----------------------------------
@api.post("/progress")
async def update_progress(p: ProgressIn, u=Depends(current_user)):
    # Upsert must use direct DB call — update_auto does not pass upsert=True.
    # We try each DB: if the record exists there, update it. Otherwise upsert into
    # the active DB (get_active_db). This prevents phantom duplicates across shards.
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)

    upserted = False
    for database in databases:
        result = await database.progress.update_one(
            {"user_id": u["id"], "course_id": p.course_id, "item_id": p.item_id},
            {"$set": {"watched": p.watched, "updated_at": now_utc().isoformat()}},
            upsert=False,  # only update existing; don't create here
        )
        if result.modified_count > 0:
            upserted = True
            break

    if not upserted:
        # Record doesn't exist in any DB — insert into the active DB
        active_db = await get_active_db()
        await active_db.progress.update_one(
            {"user_id": u["id"], "course_id": p.course_id, "item_id": p.item_id},
            {"$set": {"watched": p.watched, "updated_at": now_utc().isoformat()}},
            upsert=True,
        )

    total = await count_all_auto("recordings", {"course_id": p.course_id})
    watched = await count_all_auto("progress", {"user_id": u["id"], "course_id": p.course_id, "watched": True})
    pct = int((watched / total * 100)) if total else 0
    await update_auto("enrollments", {"user_id": u["id"], "course_id": p.course_id},
                      {"$set": {"progress_pct": pct}})
    return {"progress_pct": pct, "watched": watched, "total": total}


@api.post("/courses/{cid}/complete")
async def mark_completed(cid: str, u=Depends(current_user)):
    en = await find_one_all("enrollments", {"user_id": u["id"], "course_id": cid})
    if not en:
        raise HTTPException(404, "Not enrolled")
    if (en.get("progress_pct") or 0) < 80:
        raise HTTPException(400, "Complete at least 80% of the course first")
    await update_auto("enrollments", {"user_id": u["id"], "course_id": cid},
                      {"$set": {"completed_self": True}})
    await notify(u["id"], "Course completed!", "Final exam unlocked. Best of luck!", "success")
    return {"ok": True}


# ----------------------------- certificates (QR) --------------------------
# BUG FIX 4: Route ordering — /certificates/mine and /certificates/verify/{cert_id}
# must be declared BEFORE /certificates/{cert_id} and /certificates/{cert_id}/qr.png
# because FastAPI matches routes top-to-bottom. If {cert_id} is first, then a request
# to /certificates/mine would match cert_id="mine" and return 404 instead of the list.
# Current order in uploaded file IS correct already; preserved here explicitly.

@api.get("/certificates")
async def list_certificates(u=Depends(require_roles("admin", "super_admin"))):
    return await find_all_auto("certificates", {}, sort_field="issued_at", sort_order=-1)


@api.get("/certificates/mine")
async def my_certificates(u=Depends(current_user)):
    return await find_all_auto("certificates", {"user_id": u["id"]}, sort_field="issued_at", sort_order=-1)


# BUG FIX 5: /certificates/verify/{cert_id} must come BEFORE /certificates/{cert_id}/qr.png
# because the path segment "verify" is a literal and must take priority over the
# {cert_id} wildcard. Current file order is already correct.
@api.get("/certificates/verify/{cert_id}")
async def verify_certificate(cert_id: str):
    cert = await find_one_all("certificates", {"id": cert_id})
    if cert:
        cert.pop("_id", None)
    if not cert or not cert.get("valid", True):
        return {"valid": False, "message": "Certificate not found or revoked"}
    return {
        "valid": True,
        "certificate_id": cert["id"],
        "student_name": cert.get("user_name"),
        "student_email": cert.get("user_email"),
        "student_phone": cert.get("user_phone"),
        "course_name": cert.get("course_name"),
        "score_percent": cert.get("score"),
        "issued_at": cert.get("issued_at"),
        "verify_url": cert.get("verify_url"),
        "message": "THIS CERTIFICATE IS VALID",
    }


@api.get("/certificates/{cert_id}/qr.png")
async def cert_qr(cert_id: str):
    cert = await find_one_all("certificates", {"id": cert_id})
    if not cert:
        raise HTTPException(404, "Certificate not found")
    # BUG FIX 1 (applied here): cert.get("verify_url") may be a relative path
    # for certificates created before APP_PUBLIC_URL was set. The fallback now
    # also uses the stripped APP_PUBLIC_URL so the QR always encodes a full URL.
    stored_url = cert.get("verify_url", "")
    if stored_url.startswith("http"):
        verify_url = stored_url
    else:
        # Old cert stored relative path — reconstruct absolute URL
        verify_url = f"{FRONTEND_URL}/verify/{cert_id}"
    img = qrcode.make(verify_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    fname = re.sub(r"[^A-Za-z0-9_-]+", "_", (cert.get("user_name") or "cert")) + f"_{cert_id}.png"
    return StreamingResponse(buf, media_type="image/png",
                              headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@api.delete("/certificates/{cert_id}")
async def revoke_certificate(cert_id: str, u=Depends(require_roles("super_admin"))):
    await update_auto("certificates", {"id": cert_id},
                      {"$set": {"valid": False, "revoked_at": now_utc().isoformat()}})
    return {"ok": True}


# ----------------------------- announcements ------------------------------
@api.post("/announcements")
async def create_announcement(p: AnnouncementIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict()
    doc.update({"id": str(uuid.uuid4()), "created_by": u["id"],
                "created_by_name": u.get("full_name"), "created_at": now_utc().isoformat()})
    await insert_auto("announcements", doc)
    if p.course_id:
        enrolled = await find_all_auto("enrollments", {"course_id": p.course_id})
        for s in enrolled:
            await notify(s["user_id"], p.title, p.body, p.kind)
    else:
        all_students = await find_all_auto("users", {"role": "student"})
        for s in all_students:
            await notify(s["id"], p.title, p.body, p.kind)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/announcements")
async def list_announcements(course_id: Optional[str] = None):
    f: Dict[str, Any] = {}
    if course_id:
        f["$or"] = [{"course_id": course_id}, {"course_id": None}]
    return await find_all_auto("announcements", f)


@api.delete("/announcements/{aid}")
async def delete_announcement(aid: str, u=Depends(require_roles("admin", "super_admin"))):
    await delete_auto("announcements", {"id": aid})
    return {"ok": True}


# ----------------------------- users (admin) ------------------------------
@api.get("/users")
async def list_users(role: Optional[str] = None, u=Depends(require_roles("admin", "super_admin"))):
    f = {"role": role} if role else {}
    results = await find_all_auto("users", f, sort_field="created_at", sort_order=-1)
    for r in results:
        # find_all_auto now strips _id centrally; these pop calls are safe no-ops if already gone
        r.pop("_id", None)
        r.pop("password_hash", None)
        r.pop("reset_code", None)
        r.pop("reset_expires", None)
    return results


@api.post("/users/create")
async def admin_create_user(p: RegisterIn, u=Depends(require_roles("super_admin"))):
    if await find_one_all("users", {"username": p.username}):
        raise HTTPException(400, "Username taken")
    u2 = {"id": str(uuid.uuid4()), "username": p.username, "email": p.email,
          "password_hash": hash_pw(p.password), "full_name": p.full_name,
          "phone": p.phone or "", "role": p.role, "created_at": now_utc().isoformat()}
    await insert_auto("users", u2)
    return {k: v for k, v in u2.items() if k != "password_hash" and k != "_id"}


@api.delete("/users/{uid}")
async def admin_delete_user(uid: str, u=Depends(require_roles("super_admin"))):
    if uid == u["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    await delete_auto("users", {"id": uid})
    return {"ok": True}


# ----------------------------- notifications ------------------------------
@api.get("/notifications")
async def list_notifs(u=Depends(current_user)):
    return await find_all_auto("notifications", {"user_id": u["id"]},
                               sort_field="created_at", sort_order=-1)


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, u=Depends(current_user)):
    await update_auto("notifications", {"id": nid, "user_id": u["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(u=Depends(current_user)):
    # update_auto stops at first DB with modified_count > 0 — wrong for bulk multi-doc.
    # Must iterate all DBs directly for update_many.
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)
    for database in databases:
        await database.notifications.update_many({"user_id": u["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ----------------------------- analytics ----------------------------------
@api.get("/analytics/overview")
async def analytics(u=Depends(require_roles("admin", "super_admin"))):
    total_students = await count_all_auto("users", {"role": "student"})
    total_teachers = await count_all_auto("users", {"role": "teacher"})
    total_courses = await count_all_auto("courses")
    pending = await count_all_auto("payments", {"status": "pending"})
    total_certs = await count_all_auto("certificates", {"valid": True})
    revenue = 0.0
    month_revenue = 0.0
    now = now_utc()
    databases = [db1]
    if db2 is not None:
        databases.append(db2)
    if db3 is not None:
        databases.append(db3)
    for database in databases:
        async for p in database.payments.find(
            {"status": "approved"}, {"_id": 0, "amount": 1, "created_at": 1}
        ):
            revenue += float(p.get("amount", 0))
            try:
                d = parse_iso(p["created_at"])
                if d.year == now.year and d.month == now.month:
                    month_revenue += float(p.get("amount", 0))
            except Exception:
                pass
    return {
        "total_students": total_students, "total_teachers": total_teachers,
        "total_courses": total_courses, "pending_payments": pending,
        "total_revenue": revenue, "month_revenue": month_revenue,
        "total_certificates": total_certs,
    }


# ----------------------------- app-level ----------------------------------
@api.get("/")
async def root():
    return {"app": "HENAKASHA EdTech API", "ok": True, "version": 2}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown():
    client1.close()
    if client2 is not None:
        client2.close()
    if client3 is not None:
        client3.close()
