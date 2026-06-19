"""HENAKASHA TECH & WELFARE FOUNDATION - EdTech Backend (v2)
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
from bcrypt import hashpw, checkpw, gensalt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
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
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "")
PASS_MARK_PCT = 60.0  # student must score >=60% to earn certificate

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
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
    await db.sessions.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "jti": jti,
        "device": device or "unknown",
        "created_at": now_utc().isoformat(),
        "last_seen": now_utc().isoformat(),
    })
    count = await db.sessions.count_documents({"user_id": uid})
    if count > MAX_DEVICES:
        # remove oldest sessions until <= MAX_DEVICES
        excess = count - MAX_DEVICES
        oldest = await db.sessions.find({"user_id": uid}).sort("created_at", 1).limit(excess).to_list(excess)
        if oldest:
            await db.sessions.delete_many({"id": {"$in": [o["id"] for o in oldest]}})


def clean(d):
    if d is None: return None
    d.pop("_id", None); return d


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid token")
    # Enforce session presence (device-limit revocation). Tokens without jti are pre-update -> allow once.
    jti = payload.get("jti")
    if jti:
        sess = await db.sessions.find_one({"jti": jti, "user_id": payload["sub"]})
        if not sess:
            raise HTTPException(401, "Session expired — signed out from another device")
        # update last_seen lazily
        await db.sessions.update_one({"id": sess["id"]}, {"$set": {"last_seen": now_utc().isoformat()}})
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not u: raise HTTPException(401, "User not found")
    u["_jti"] = jti
    return u


def require_roles(*roles: str):
    async def dep(u=Depends(current_user)):
        if u["role"] not in roles: raise HTTPException(403, "Forbidden")
        return u
    return dep


async def notify(uid: str, title: str, body: str, kind: str = "info", link: Optional[str] = None):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "title": title, "body": body,
        "kind": kind, "link": link or "", "read": False, "created_at": now_utc().isoformat(),
    })


YT_RX = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})")


def extract_youtube_id(url: str) -> Optional[str]:
    if not url: return None
    m = YT_RX.search(url)
    if m: return m.group(1)
    # allow raw IDs
    if re.fullmatch(r"[A-Za-z0-9_-]{6,}", url.strip()): return url.strip()
    return None


def parse_iso(s: str) -> datetime:
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return dt


def annotate_live(item: Dict[str, Any]) -> Dict[str, Any]:
    """Compute can_join + status based on scheduled_at and duration_min."""
    try:
        start = parse_iso(item["scheduled_at"])
    except Exception:
        item["can_join"] = False; item["live_status"] = "scheduled"; return item
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
    username: str; email: str; password: str; full_name: str
    phone: Optional[str] = None
    role: Role = "student"


class LoginIn(BaseModel):
    username: str; password: str


class ForgotIn(BaseModel):
    username: str


class ResetIn(BaseModel):
    username: str; reset_code: str; new_password: str


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
    course_id: str; utr: str; amount: float


class PaymentApprovalIn(BaseModel):
    payment_id: str; approve: bool; reason: Optional[str] = None


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
    options: List[str] = []                # for single/multiple
    correct_options: List[int] = []        # for single (len=1) & multiple
    correct_integer: Optional[int] = None  # for integer
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
    # answers: question_id -> single index | list of indices | integer
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
    course_id: Optional[str] = None   # None => global / all batches
    title: str
    body: str
    kind: Literal["info", "warning", "cancel", "reschedule"] = "info"


# ----------------------------- seed ---------------------------------------
SEED_CATEGORIES = ["Tech", "JEE", "NEET", "CBSE Class 9", "CBSE Class 10", "CBSE Class 11", "CBSE Class 12"]


@app.on_event("startup")
async def seed():
    await db.users.create_index("username", unique=True)
    await db.courses.create_index("id", unique=True)
    await db.enrollments.create_index([("user_id", 1), ("course_id", 1)], unique=True)

    async def seed_user(u, p, name, role, email):
        if not await db.users.find_one({"username": u}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "username": u, "email": email,
                "password_hash": hash_pw(p), "full_name": name, "phone": "",
                "role": role, "created_at": now_utc().isoformat(),
            })

    await seed_user("BOSSHENA&GULAM", "Hena&gulam", "Boss Hena & Gulam", "super_admin", "superadmin@henakasha.org")
    await seed_user("HENAKASHABYGULAM", "Rehankhan786@", "Henakasha Admin", "admin", "admin@henakasha.org")
    await seed_user("teacher_demo", "Teacher@123", "Demo Teacher", "teacher", "teacher@henakasha.org")
    await seed_user("student_demo", "Student@123", "Demo Student", "student", "student@henakasha.org")

    # Re-seed categories: remove anything not in current list, upsert the new ones.
    await db.categories.delete_many({"name": {"$nin": SEED_CATEGORIES}})
    for c in SEED_CATEGORIES:
        await db.categories.update_one({"name": c}, {"$setOnInsert": {"name": c, "id": str(uuid.uuid4())}}, upsert=True)

    if not await db.settings.find_one({"id": "global"}):
        await db.settings.insert_one({
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
            "contact_email": "support@henakasha.org",
            "contact_phone": "+91 00000 00000",
            "whatsapp_number": "+919000000000",
            "updated_at": now_utc().isoformat(),
        })

    if await db.courses.count_documents({}) == 0:
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
            s.update({"id": str(uuid.uuid4()), "language": "English", "status": "published", "created_at": now_utc().isoformat()})
            await db.courses.insert_one(s)
    log.info("Seed complete.")


# ----------------------------- auth ---------------------------------------
@api.post("/auth/register")
async def register(p: RegisterIn):
    if p.role != "student": raise HTTPException(400, "Public registration is only for students")
    if await db.users.find_one({"username": p.username}): raise HTTPException(400, "Username already taken")
    u = {"id": str(uuid.uuid4()), "username": p.username, "email": p.email,
         "password_hash": hash_pw(p.password), "full_name": p.full_name, "phone": p.phone or "",
         "role": "student", "created_at": now_utc().isoformat()}
    await db.users.insert_one(u)
    u.pop("_id", None)
    jti = str(uuid.uuid4())
    token = create_token(u["id"], u["role"], u["username"], jti=jti)
    await create_session(u["id"], jti, device="web")
    await notify(u["id"], "Welcome!", f"Welcome to HENAKASHA, {p.full_name}.", "success")
    return {"token": token, "user": {k: v for k, v in u.items() if k != "password_hash"}}


@api.post("/auth/login")
async def login(p: LoginIn):
    u = await db.users.find_one({"username": p.username})
    if not u or not verify_pw(p.password, u["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    jti = str(uuid.uuid4())
    token = create_token(u["id"], u["role"], u["username"], jti=jti)
    await create_session(u["id"], jti, device="web")
    clean(u); u.pop("password_hash", None)
    return {"token": token, "user": u}


@api.post("/auth/logout")
async def logout(u=Depends(current_user)):
    jti = u.get("_jti")
    if jti:
        await db.sessions.delete_one({"jti": jti, "user_id": u["id"]})
    return {"ok": True}


@api.get("/auth/sessions")
async def my_sessions(u=Depends(current_user)):
    rows = await db.sessions.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for r in rows:
        r["current"] = (r.get("jti") == u.get("_jti"))
    return {"max_devices": MAX_DEVICES, "sessions": rows}


@api.post("/auth/forgot-password")
async def forgot(p: ForgotIn):
    u = await db.users.find_one({"username": p.username})
    if not u: raise HTTPException(404, "User not found")
    code = str(uuid.uuid4())[:8].upper()
    await db.users.update_one({"id": u["id"]}, {"$set": {"reset_code": code, "reset_expires": (now_utc() + timedelta(minutes=30)).isoformat()}})
    return {"message": "Use this code to reset your password (valid 30 min)", "reset_code": code}


@api.post("/auth/reset-password")
async def reset(p: ResetIn):
    u = await db.users.find_one({"username": p.username})
    if not u or u.get("reset_code") != p.reset_code: raise HTTPException(400, "Invalid reset code")
    if u.get("reset_expires") and parse_iso(u["reset_expires"]) < now_utc():
        raise HTTPException(400, "Reset code expired")
    await db.users.update_one({"id": u["id"]}, {"$set": {"password_hash": hash_pw(p.new_password)}, "$unset": {"reset_code": "", "reset_expires": ""}})
    return {"message": "Password reset successful"}


@api.get("/auth/me")
async def me(u=Depends(current_user)): return u


@api.put("/auth/profile")
async def update_profile(p: ProfileUpdate, u=Depends(current_user)):
    update = {k: v for k, v in p.dict().items() if v is not None}
    if update: await db.users.update_one({"id": u["id"]}, {"$set": update})
    return await db.users.find_one({"id": u["id"]}, {"_id": 0, "password_hash": 0})


# ----------------------------- categories & courses -----------------------
@api.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(500)


@api.get("/courses")
async def list_courses(q: Optional[str] = None, category: Optional[str] = None,
                       status_: Optional[str] = Query("published", alias="status")):
    filt: Dict[str, Any] = {}
    if status_: filt["status"] = status_
    if category and category != "All": filt["category"] = category
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"instructor_name": {"$regex": q, "$options": "i"}},
        ]
    return await db.courses.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/courses/{cid}")
async def get_course(cid: str):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Course not found")
    return c


@api.post("/courses")
async def create_course(p: CourseIn, u=Depends(require_roles("admin", "super_admin"))):
    doc = p.dict(); doc.update({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat()})
    await db.courses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/courses/{cid}")
async def update_course(cid: str, p: CourseIn, u=Depends(require_roles("admin", "super_admin"))):
    await db.courses.update_one({"id": cid}, {"$set": p.dict()})
    return await db.courses.find_one({"id": cid}, {"_id": 0})


@api.delete("/courses/{cid}")
async def delete_course(cid: str, u=Depends(require_roles("admin", "super_admin"))):
    await db.courses.delete_one({"id": cid}); return {"ok": True}


# ----------------------------- settings -----------------------------------
@api.get("/settings")
async def get_settings():
    return await db.settings.find_one({"id": "global"}, {"_id": 0, "razorpay_key_secret": 0})


@api.put("/settings")
async def update_settings(p: SettingsIn, u=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in p.dict().items() if v is not None}
    update["updated_at"] = now_utc().isoformat()
    await db.settings.update_one({"id": "global"}, {"$set": update})
    return await db.settings.find_one({"id": "global"}, {"_id": 0})


# ----------------------------- payments -----------------------------------
async def ensure_enrolled(uid: str, cid: str):
    if await db.enrollments.find_one({"user_id": uid, "course_id": cid}): return
    await db.enrollments.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "course_id": cid,
        "enrolled_at": now_utc().isoformat(), "progress_pct": 0,
        "completed_self": False, "exam_passed": False,
    })


@api.post("/payments/manual")
async def submit_manual_payment(p: PaymentManualIn, u=Depends(current_user)):
    course = await db.courses.find_one({"id": p.course_id})
    if not course: raise HTTPException(404, "Course not found")
    pid = str(uuid.uuid4())
    await db.payments.insert_one({
        "id": pid, "user_id": u["id"], "user_name": u.get("full_name", ""),
        "user_email": u.get("email", ""), "user_phone": u.get("phone", ""),
        "course_id": p.course_id, "course_name": course.get("name"),
        "amount": p.amount, "method": "manual_upi", "utr": p.utr,
        "status": "pending", "created_at": now_utc().isoformat(),
    })
    await notify(u["id"], "Payment submitted", f"Your payment (UTR {p.utr}) for {course.get('name')} is under review.", "info")
    return {"payment_id": pid, "status": "pending"}


@api.post("/payments/razorpay/order")
async def create_rzp_order(course_id: str, u=Depends(current_user)):
    settings = await db.settings.find_one({"id": "global"})
    if not settings or not settings.get("razorpay_enabled"):
        raise HTTPException(400, "Razorpay not configured. Use manual UPI payment.")
    course = await db.courses.find_one({"id": course_id})
    if not course: raise HTTPException(404, "Course not found")
    return {"key_id": settings.get("razorpay_key_id"),
            "amount": int((course.get("discount_price") or course.get("price") or 0) * 100),
            "currency": "INR", "order_id": f"order_{uuid.uuid4().hex[:14]}", "course_id": course_id}


@api.post("/payments/razorpay/verify")
async def verify_rzp(course_id: str, razorpay_payment_id: str, u=Depends(current_user)):
    course = await db.courses.find_one({"id": course_id})
    if not course: raise HTTPException(404, "Course not found")
    pid = str(uuid.uuid4())
    await db.payments.insert_one({
        "id": pid, "user_id": u["id"], "user_name": u.get("full_name", ""),
        "course_id": course_id, "course_name": course.get("name"),
        "amount": course.get("discount_price") or course.get("price") or 0,
        "method": "razorpay", "rzp_payment_id": razorpay_payment_id,
        "status": "approved", "created_at": now_utc().isoformat(), "verified_by": "system",
    })
    await ensure_enrolled(u["id"], course_id)
    await notify(u["id"], "Payment successful", f"You are enrolled in {course.get('name')}.", "success")
    return {"ok": True, "payment_id": pid}


@api.get("/payments/pending")
async def pending_payments(u=Depends(require_roles("admin", "super_admin"))):
    return await db.payments.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/payments/all")
async def all_payments(u=Depends(require_roles("admin", "super_admin"))):
    return await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/payments/mine")
async def my_payments(u=Depends(current_user)):
    return await db.payments.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/payments/verify")
async def verify_manual_payment(p: PaymentApprovalIn, u=Depends(require_roles("admin", "super_admin"))):
    pay = await db.payments.find_one({"id": p.payment_id})
    if not pay: raise HTTPException(404, "Payment not found")
    new_status = "approved" if p.approve else "rejected"
    await db.payments.update_one({"id": p.payment_id}, {"$set": {
        "status": new_status, "verified_by": u["username"], "verified_at": now_utc().isoformat(),
        "rejection_reason": p.reason or "",
    }})
    if p.approve:
        await ensure_enrolled(pay["user_id"], pay["course_id"])
        await notify(pay["user_id"], "Payment approved", f"You are now enrolled in {pay.get('course_name')}.", "success")
    else:
        await notify(pay["user_id"], "Payment rejected", f"Your payment for {pay.get('course_name')} was rejected. {p.reason or ''}", "error")
    return {"ok": True, "status": new_status}


@api.get("/enrollments/mine")
async def my_enrollments(u=Depends(current_user)):
    # Single aggregation: enrollments + joined course doc (no N+1).
    pipeline = [
        {"$match": {"user_id": u["id"]}},
        {"$lookup": {"from": "courses", "localField": "course_id", "foreignField": "id", "as": "course"}},
        {"$unwind": {"path": "$course", "preserveNullAndEmptyArrays": True}},
        {"$project": {"_id": 0, "course._id": 0}},
    ]
    rows = await db.enrollments.aggregate(pipeline).to_list(500)
    # Filter out enrollments whose course has been deleted (course is None/missing)
    return [r for r in rows if r.get("course")]


# ----------------------------- live classes -------------------------------
@api.post("/live-classes")
async def create_live_class(p: LiveClassIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict(); doc.update({"id": str(uuid.uuid4()), "created_by": u["id"], "created_at": now_utc().isoformat()})
    await db.live_classes.insert_one(doc)
    # notify enrolled students
    students = db.enrollments.find({"course_id": p.course_id}, {"user_id": 1, "_id": 0})
    async for s in students:
        await notify(s["user_id"], "New live class scheduled", f"{p.title} at {p.scheduled_at}", "info")
    return annotate_live({k: v for k, v in doc.items() if k != "_id"})


@api.get("/live-classes")
async def list_live_classes(course_id: Optional[str] = None):
    f = {"course_id": course_id} if course_id else {}
    items = await db.live_classes.find(f, {"_id": 0}).sort("scheduled_at", -1).to_list(500)
    return [annotate_live(i) for i in items]


@api.delete("/live-classes/{cid}")
async def delete_live(cid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await db.live_classes.delete_one({"id": cid}); return {"ok": True}


# ----------------------------- recordings (YouTube) -----------------------
@api.post("/recordings")
async def add_recording(p: RecordingIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    yid = extract_youtube_id(p.youtube_url)
    if not yid: raise HTTPException(400, "Invalid YouTube URL")
    doc = {
        "id": str(uuid.uuid4()), "course_id": p.course_id, "title": p.title,
        "description": p.description, "youtube_url": p.youtube_url, "youtube_id": yid,
        "embed_url": f"https://www.youtube.com/embed/{yid}",
        "thumbnail": f"https://i.ytimg.com/vi/{yid}/hqdefault.jpg",
        "duration_min": p.duration_min, "uploaded_by": u["id"],
        "created_at": now_utc().isoformat(),
    }
    await db.recordings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/recordings")
async def list_recordings(course_id: str):
    return await db.recordings.find({"course_id": course_id}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/recordings/{rid}")
async def get_recording(rid: str, u=Depends(current_user)):
    r = await db.recordings.find_one({"id": rid}, {"_id": 0})
    if not r: raise HTTPException(404, "Not found")
    if u["role"] == "student":
        en = await db.enrollments.find_one({"user_id": u["id"], "course_id": r["course_id"]})
        if not en: raise HTTPException(403, "Not enrolled")
    return r


@api.delete("/recordings/{rid}")
async def delete_recording(rid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await db.recordings.delete_one({"id": rid}); return {"ok": True}


# ----------------------------- notes --------------------------------------
@api.post("/notes")
async def upload_note(p: NoteIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict(); doc.update({"id": str(uuid.uuid4()), "uploaded_by": u["id"], "created_at": now_utc().isoformat()})
    await db.notes.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id" and k != "file_base64"}


@api.get("/notes")
async def list_notes(course_id: str):
    return await db.notes.find({"course_id": course_id}, {"_id": 0, "file_base64": 0}).sort("created_at", -1).to_list(500)


@api.get("/notes/{nid}")
async def get_note(nid: str, u=Depends(current_user)):
    n = await db.notes.find_one({"id": nid}, {"_id": 0})
    if not n: raise HTTPException(404, "Not found")
    if u["role"] == "student":
        en = await db.enrollments.find_one({"user_id": u["id"], "course_id": n["course_id"]})
        if not en: raise HTTPException(403, "Not enrolled")
    return n


@api.delete("/notes/{nid}")
async def delete_note(nid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await db.notes.delete_one({"id": nid}); return {"ok": True}


# ----------------------------- quizzes (test/assignment/exam) ------------
def _strip_correct(quiz: Dict[str, Any]) -> Dict[str, Any]:
    for q in quiz.get("questions", []):
        q.pop("correct_options", None)
        q.pop("correct_integer", None)
    return quiz


def _grade(quiz: Dict[str, Any], answers: Dict[str, Any]) -> Dict[str, Any]:
    total = 0.0; obtained = 0.0
    neg = float(quiz.get("negative_marking", 0.0))
    breakdown = []
    for q in quiz.get("questions", []):
        marks = float(q.get("marks", 1.0)); total += marks
        ans = answers.get(q["id"])
        correct = False
        qt = q.get("q_type", "single")
        if ans is None:
            breakdown.append({"id": q["id"], "correct": False, "score": 0.0, "skipped": True}); continue
        if qt == "single":
            if isinstance(ans, list): ans = ans[0] if ans else None
            correct = (ans is not None) and ans in (q.get("correct_options") or [])
        elif qt == "multiple":
            given = set(ans if isinstance(ans, list) else [ans])
            want = set(q.get("correct_options") or [])
            correct = given == want
        elif qt == "integer":
            try: correct = int(ans) == int(q.get("correct_integer"))
            except Exception: correct = False
        score = marks if correct else (-neg)
        if correct: obtained += marks
        else: obtained -= neg
        breakdown.append({"id": q["id"], "correct": correct, "score": score, "skipped": False})
    obtained = max(obtained, 0.0)
    pct = (obtained / total * 100) if total else 0
    return {"score": obtained, "total": total, "percentage": pct, "breakdown": breakdown}


@api.post("/quizzes")
async def create_quiz(p: QuizIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict(); doc.update({"id": str(uuid.uuid4()), "created_by": u["id"], "created_at": now_utc().isoformat()})
    await db.quizzes.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/quizzes/{qid}/toggle")
async def toggle_quiz(qid: str, enabled: bool, u=Depends(require_roles("admin", "super_admin"))):
    await db.quizzes.update_one({"id": qid}, {"$set": {"enabled": enabled}})
    return {"ok": True}


@api.delete("/quizzes/{qid}")
async def delete_quiz(qid: str, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    await db.quizzes.delete_one({"id": qid}); return {"ok": True}


@api.get("/quizzes")
async def list_quizzes(course_id: str, kind: Optional[str] = None):
    f: Dict[str, Any] = {"course_id": course_id}
    if kind: f["kind"] = kind
    return await db.quizzes.find(f, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/quizzes/{qid}")
async def get_quiz(qid: str, u=Depends(current_user)):
    q = await db.quizzes.find_one({"id": qid}, {"_id": 0})
    if not q: raise HTTPException(404, "Not found")
    if u["role"] == "student":
        if q.get("kind") == "exam":
            en = await db.enrollments.find_one({"user_id": u["id"], "course_id": q["course_id"]})
            if not en or not en.get("completed_self"):
                raise HTTPException(403, "Complete the course before attempting the final exam.")
        if not q.get("enabled", True): raise HTTPException(403, "Quiz disabled")
        q = _strip_correct(q)
    return q


@api.post("/quizzes/submit")
async def submit_quiz(p: QuizSubmissionIn, u=Depends(current_user)):
    q = await db.quizzes.find_one({"id": p.quiz_id})
    if not q: raise HTTPException(404, "Quiz not found")
    result = _grade(q, p.answers)
    sub = {
        "id": str(uuid.uuid4()), "quiz_id": p.quiz_id, "quiz_kind": q.get("kind"),
        "quiz_title": q.get("title"), "course_id": q["course_id"],
        "user_id": u["id"], "user_name": u.get("full_name", ""),
        "user_email": u.get("email", ""), "user_phone": u.get("phone", ""),
        "answers": p.answers, **result, "created_at": now_utc().isoformat(),
    }
    await db.quiz_submissions.insert_one(sub)

    # exam pass → auto-create certificate QR (only if course has_certificate)
    if q.get("kind") == "exam" and result["percentage"] >= PASS_MARK_PCT:
        await db.enrollments.update_one(
            {"user_id": u["id"], "course_id": q["course_id"]},
            {"$set": {"exam_passed": True, "exam_score": result["percentage"]}}
        )
        course = await db.courses.find_one({"id": q["course_id"]}, {"_id": 0})
        has_cert = bool(course.get("has_certificate", True)) if course else True
        if has_cert and not await db.certificates.find_one({"user_id": u["id"], "course_id": q["course_id"]}):
            cert_id = f"HENA-{uuid.uuid4().hex[:10].upper()}"
            await db.certificates.insert_one({
                "id": cert_id, "user_id": u["id"], "user_name": u.get("full_name"),
                "user_email": u.get("email"), "user_phone": u.get("phone"),
                "course_id": q["course_id"], "course_name": course.get("name") if course else "",
                "score": result["percentage"], "issued_at": now_utc().isoformat(),
                "verify_url": f"{APP_PUBLIC_URL}/verify/{cert_id}",
                "valid": True,
            })
            await notify(u["id"], "Certificate generated!", f"Your certificate for {course.get('name') if course else ''} is ready.", "success", link=f"/verify/{cert_id}")

    return clean(sub)


@api.get("/quizzes/{qid}/my-submissions")
async def my_quiz_subs(qid: str, u=Depends(current_user)):
    return await db.quiz_submissions.find({"quiz_id": qid, "user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.get("/submissions/mine")
async def all_my_subs(u=Depends(current_user)):
    return await db.quiz_submissions.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ----------------------------- leaderboards -------------------------------
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
    rows = await db.quiz_submissions.aggregate(pipeline).to_list(50)
    for r in rows: r["user_id"] = r.pop("_id"); r["percentage"] = (r["total_score"] / r["total_marks"] * 100) if r.get("total_marks") else 0
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
    rows = await db.quiz_submissions.aggregate(pipeline).to_list(50)
    for r in rows: r["user_id"] = r.pop("_id")
    return rows


# ----------------------------- progress -----------------------------------
@api.post("/progress")
async def update_progress(p: ProgressIn, u=Depends(current_user)):
    await db.progress.update_one(
        {"user_id": u["id"], "course_id": p.course_id, "item_id": p.item_id},
        {"$set": {"watched": p.watched, "updated_at": now_utc().isoformat()}}, upsert=True,
    )
    total = await db.recordings.count_documents({"course_id": p.course_id})
    watched = await db.progress.count_documents({"user_id": u["id"], "course_id": p.course_id, "watched": True})
    pct = int((watched / total * 100)) if total else 0
    await db.enrollments.update_one({"user_id": u["id"], "course_id": p.course_id}, {"$set": {"progress_pct": pct}})
    return {"progress_pct": pct, "watched": watched, "total": total}


@api.post("/courses/{cid}/complete")
async def mark_completed(cid: str, u=Depends(current_user)):
    en = await db.enrollments.find_one({"user_id": u["id"], "course_id": cid})
    if not en: raise HTTPException(404, "Not enrolled")
    if (en.get("progress_pct") or 0) < 80: raise HTTPException(400, "Complete at least 80% of the course first")
    await db.enrollments.update_one({"user_id": u["id"], "course_id": cid}, {"$set": {"completed_self": True}})
    await notify(u["id"], "Course completed!", "Final exam unlocked. Best of luck!", "success")
    return {"ok": True}


# ----------------------------- certificates (QR) --------------------------
@api.get("/certificates")
async def list_certificates(u=Depends(require_roles("admin", "super_admin"))):
    return await db.certificates.find({}, {"_id": 0}).sort("issued_at", -1).to_list(2000)


@api.get("/certificates/mine")
async def my_certificates(u=Depends(current_user)):
    return await db.certificates.find({"user_id": u["id"]}, {"_id": 0}).sort("issued_at", -1).to_list(200)


@api.get("/certificates/{cert_id}/qr.png")
async def cert_qr(cert_id: str):
    cert = await db.certificates.find_one({"id": cert_id})
    if not cert: raise HTTPException(404, "Certificate not found")
    verify_url = cert.get("verify_url") or f"{APP_PUBLIC_URL}/verify/{cert_id}"
    img = qrcode.make(verify_url)
    buf = io.BytesIO(); img.save(buf, format="PNG"); buf.seek(0)
    fname = re.sub(r"[^A-Za-z0-9_-]+", "_", (cert.get("user_name") or "cert")) + f"_{cert_id}.png"
    return StreamingResponse(buf, media_type="image/png",
                              headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@api.get("/certificates/verify/{cert_id}")
async def verify_certificate(cert_id: str):
    cert = await db.certificates.find_one({"id": cert_id}, {"_id": 0})
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
        "message": "THIS CERTIFICATE IS VALID",
    }


@api.delete("/certificates/{cert_id}")
async def revoke_certificate(cert_id: str, u=Depends(require_roles("super_admin"))):
    await db.certificates.update_one({"id": cert_id}, {"$set": {"valid": False, "revoked_at": now_utc().isoformat()}})
    return {"ok": True}


# ----------------------------- announcements ------------------------------
@api.post("/announcements")
async def create_announcement(p: AnnouncementIn, u=Depends(require_roles("teacher", "admin", "super_admin"))):
    doc = p.dict(); doc.update({"id": str(uuid.uuid4()), "created_by": u["id"],
                                 "created_by_name": u.get("full_name"), "created_at": now_utc().isoformat()})
    await db.announcements.insert_one(doc)
    # notify enrolled students of that course (or all students if global)
    if p.course_id:
        students = db.enrollments.find({"course_id": p.course_id}, {"user_id": 1, "_id": 0})
    else:
        students = db.users.find({"role": "student"}, {"_id": 0, "id": 1}).to_list(5000)
        for s in await students:
            await notify(s["id"], p.title, p.body, p.kind)
        return {k: v for k, v in doc.items() if k != "_id"}
    async for s in students:
        await notify(s["user_id"], p.title, p.body, p.kind)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/announcements")
async def list_announcements(course_id: Optional[str] = None):
    f: Dict[str, Any] = {}
    if course_id: f["$or"] = [{"course_id": course_id}, {"course_id": None}]
    return await db.announcements.find(f, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.delete("/announcements/{aid}")
async def delete_announcement(aid: str, u=Depends(require_roles("admin", "super_admin"))):
    await db.announcements.delete_one({"id": aid}); return {"ok": True}


# ----------------------------- users (admin) ------------------------------
@api.get("/users")
async def list_users(role: Optional[str] = None, u=Depends(require_roles("admin", "super_admin"))):
    f = {"role": role} if role else {}
    return await db.users.find(f, {"_id": 0, "password_hash": 0, "reset_code": 0, "reset_expires": 0}).sort("created_at", -1).to_list(2000)


@api.post("/users/create")
async def admin_create_user(p: RegisterIn, u=Depends(require_roles("super_admin"))):
    if await db.users.find_one({"username": p.username}): raise HTTPException(400, "Username taken")
    u2 = {"id": str(uuid.uuid4()), "username": p.username, "email": p.email,
          "password_hash": hash_pw(p.password), "full_name": p.full_name,
          "phone": p.phone or "", "role": p.role, "created_at": now_utc().isoformat()}
    await db.users.insert_one(u2)
    return {k: v for k, v in u2.items() if k != "password_hash"}


@api.delete("/users/{uid}")
async def admin_delete_user(uid: str, u=Depends(require_roles("super_admin"))):
    if uid == u["id"]: raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"id": uid}); return {"ok": True}


# ----------------------------- notifications ------------------------------
@api.get("/notifications")
async def list_notifs(u=Depends(current_user)):
    return await db.notifications.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, u=Depends(current_user)):
    await db.notifications.update_one({"id": nid, "user_id": u["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(u=Depends(current_user)):
    await db.notifications.update_many({"user_id": u["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ----------------------------- analytics ----------------------------------
@api.get("/analytics/overview")
async def analytics(u=Depends(require_roles("admin", "super_admin"))):
    total_students = await db.users.count_documents({"role": "student"})
    total_teachers = await db.users.count_documents({"role": "teacher"})
    total_courses = await db.courses.count_documents({"status": "published"})
    pending = await db.payments.count_documents({"status": "pending"})
    total_certs = await db.certificates.count_documents({"valid": True})
    revenue = 0.0; month_revenue = 0.0
    now = now_utc()
    async for p in db.payments.find({"status": "approved"}, {"_id": 0, "amount": 1, "created_at": 1}):
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
async def root(): return {"app": "HENAKASHA EdTech API", "ok": True, "version": 2}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown(): client.close()
