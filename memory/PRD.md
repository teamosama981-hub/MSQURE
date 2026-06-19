# HENAKASHA TECH & WELFARE FOUNDATION — EdTech Platform

A complete multi-role learning platform built with **Expo (web + native) + FastAPI + MongoDB**.
Same codebase runs on web (static export) and as a native Android/iOS app.

## Roles
- **Super Admin** — full control, Razorpay & UPI settings, manage admins/teachers/students.
- **Admin** — manage courses, payments, certificates, announcements, content.
- **Teacher** — upload recordings, notes, schedule live classes, create quizzes.
- **Student** — browse, enroll, learn, take tests/exams, earn certificate QR.

## Categories (exactly 4 buckets per latest spec)

1. **Tech** — programming, AI, web/cyber, etc. (AI courses live here)
2. **JEE**
3. **NEET**
4. **CBSE Class 9 / 10 / 11 / 12** (CBSE board exam preparation)

UPSC, SSC, Railway, Banking, etc. were removed per request.

## Session / Device Limit

- A user can be signed in on **at most 2 devices at the same time** (env-configurable via `MAX_DEVICES`).
- On every login a session row is created with a unique JTI.
- If a 3rd device logs in, the **oldest active session is automatically signed out** — that device sees:
  `"Session expired — signed out from another device"`.
- `GET /api/auth/sessions` lists active sessions; `POST /api/auth/logout` revokes the current one.

## Default seeded accounts

| Role        | Username           | Password       |
|-------------|--------------------|----------------|
| Super Admin | BOSSHENA&GULAM     | Hena&gulam     |
| Admin       | HENAKASHABYGULAM   | Rehankhan786@  |
| Teacher     | teacher_demo       | Teacher@123    |
| Student     | student_demo       | Student@123    |

## Key features
- **Multi-role auth** (JWT, bcrypt). Public registration restricted to students.
- **Course catalog** with categories, search, filter; admin CRUD with `has_certificate` toggle per course.
- **Manual UPI payment**: PhonePe QR + UTR-only submission. Admin approves → auto enrollment.
- **Razorpay scaffold**: Super Admin sets keys + enable flag in Settings.
- **Live classes**: Teacher schedules MS Teams link + start time + duration. Students see "UPCOMING / ● LIVE NOW / ENDED" and the **Go Live** button is enabled ONLY during the live window.
- **Recordings**: YouTube URL (saves DB cost); auto thumbnail + embed; player works on web & native.
- **Notes**: PDF/PPT/DOCX/ZIP/image upload (base64), download on web.
- **Quizzes (Tests / Assignments / Exams)** — single screen / single backend; 3 question types per question: **single-choice MCQ**, **multiple-choice MCQ**, **integer answer**. Timer, negative marking, instant result. "Chapter 1 Test — Completed" with tap-to-view result. Exam locked until course progress ≥80%.
- **Leaderboards**: weekly (tests) and monthly (exams) per course.
- **Certificate QR system**: when student scores ≥60% on a course **final exam AND** course `has_certificate=true`, a QR + record is auto-created. Admin can download the QR PNG (file is named after the student) and embed it in a designed certificate (e.g. ChatGPT / Canva). Scanning the QR opens `/verify/<id>` which displays student name, email, phone, course, score, issue date and a green **"THIS CERTIFICATE IS VALID"** badge.
- **Announcements** (global or per-course) — sends in-app notifications to all enrolled students. Kinds: info / warning / cancel / reschedule.
- **In-app notifications** with badge counter on bell.
- **Analytics** dashboard: students, teachers, courses, pending payments, certificates, total + month revenue.

## Tech stack
- Backend: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt + qrcode + reportlab.
- Frontend: Expo SDK 54 + Expo Router + React Native 0.81 + expo-image + react-native-webview.
- Single repo. Web + Android + iOS from one codebase.

## Project structure
```
/app
├── backend/                   FastAPI app, runs on Render `Web Service`
│   ├── server.py              single-file API (all routes under /api)
│   ├── requirements.txt
│   ├── Procfile               for Render / Heroku-style platforms
│   └── runtime.txt            python-3.11
├── frontend/                  Expo Router app (web + native)
│   ├── app/                   file-based routes
│   │   ├── landing.tsx        public marketing/home
│   │   ├── (auth)/            login, register, forgot
│   │   ├── (student)/         tabs: home, browse, my-study, profile
│   │   ├── (admin)/           tabs: dashboard, courses, payments, certificates, settings
│   │   ├── course/[id].tsx    course detail + sections
│   │   ├── payment/[course].tsx
│   │   ├── quiz/[id].tsx      MCQ/Integer quiz player
│   │   ├── recording/[id].tsx YouTube embed
│   │   ├── note/[id].tsx
│   │   ├── verify/[id].tsx    public certificate verifier
│   │   └── notifications.tsx
│   └── src/
│       ├── lib/               api.ts, auth.tsx, theme.ts
│       └── components/        Logo, Button, Input, Card
├── render.yaml                Render Blueprint (1-click deploy)
└── DEPLOY_RENDER.md           Step-by-step deployment guide
```

## Deployment
- See **DEPLOY_RENDER.md** for full Render deployment (backend + web).
- Mobile: click **Publish** in Emergent for Android/iOS builds, or use `eas build` locally.

## Brand
- Logo, colors and tagline derived from the uploaded HENAKASHA logo:
  saffron (#FF8A1E), deep blue (#1B2A6E), green (#2EA84B), white. Educate • Empower • Elevate.
