# Smart Attendance System — Implementation Plan

## Overview
A centrally hosted Smart Attendance System. The system performs webcam-based face recognition with active liveness checking to automate and harden classroom attendance. The application is hosted centrally, allowing teachers to conduct attendance using the web browser on their mobile phones (or other devices) via HTTPS.

---

## Architecture Decision: Centrally Hosted, Multi-Device

### Rationale
The primary deployment target is a central server that hosts the backend and database. Teachers will access the frontend web application via their phones or other devices. This allows multiple professors to use the system simultaneously from different locations, while all data remains centralized in a secure database.

**Decision: Centrally Hosted Cloud Stack.**
The web application communicates with the Node.js backend over HTTPS. The backend communicates with a PostgreSQL database.

```
Teacher's Phone (Browser: Vite + React + PWA)
      ↕  HTTPS (Internet/Intranet)
Node.js + Express API (Central Server)
      ↕  Prisma ORM
PostgreSQL Database (Central Server)
```

Computer Vision runs entirely **in the browser** on the teacher's phone via WebAssembly. **No continuous webcam frames are sent over the network to the backend.** This ensures user privacy, reduces server load, and minimizes bandwidth usage.

---

## Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast dev server, SPA, easy PWA setup |
| Styling | Vanilla CSS + CSS variables | Full control, no build-time dependency |
| State | Zustand | Lightweight, minimal boilerplate |
| Backend | Node.js + Express + TypeScript | Fast to develop, easily hosted on any cloud |
| ORM | Prisma | Type-safe queries, excellent PostgreSQL support |
| Database | PostgreSQL | Robust, scalable relational database for central hosting |
| Auth | JWT (access token) + bcrypt | Stateless tokens |
| CV Runtime | **face-api.js** (see CV section) | Best-fit for browser, WebAssembly, proven accuracy |
| PDF Export | jsPDF | Client-side, no server dependencies |
| CSV Export | papaparse | Client-side |
| Testing | Vitest (frontend) + Jest + Supertest (backend) | Fast, TypeScript-native |
| Deployment | Node.js Server + Local DB | Direct hosting on cloud server without containerization |

---

## Computer Vision Stack — Final Decision

### Evaluation

| Library | Runtime | Face Detect | Landmarks | Embeddings | WASM | Offline | Verdict |
|---|---|---|---|---|---|---|---|
| **face-api.js** | TensorFlow.js | SSD MobileNet V1 | 68-point + 5-point | 128D ResNet-34 | ✅ | ✅ | **SELECTED** |
| MediaPipe Face Mesh | WASM | BlazeFace | 468-point | ❌ (no recognition model) | ✅ | ✅ | No embeddings built-in |
| MediaPipe FaceRecognizer | WASM | ✅ | Limited | Task-specific | ✅ | ✅ | Newer, less battle-tested in browser |
| OpenCV.js | WASM | Haar/DNN | Limited | ❌ | ✅ | ✅ | No high-quality recognition built-in |
| AWS Rekognition | Cloud API | ✅ | ✅ | ✅ | ❌ | ❌ | Disqualified: continuous frame upload required |

**Conclusion: `face-api.js` is the correct choice.** It provides the complete pipeline — detection, landmarks, 128D embedding extraction — all running in the phone's browser via TensorFlow.js WASM backend. 

We will use **MediaPipe's face landmarker** as a supplemental tool specifically for the liveness challenge landmark tracking, where its higher landmark fidelity is valuable.

### Final CV Stack

```
face-api.js          → Face detection (SSD MobileNet V1)
face-api.js          → Face alignment (68-point landmarks)  
face-api.js          → Face quality assessment (bounding box heuristics)
face-api.js          → 128D embedding extraction (ResNet-34)
Custom JS logic      → Euclidean distance matching + threshold evaluation
MediaPipe Landmarker → High-fidelity landmarks for liveness challenge verification
```

Models will be downloaded and cached by the PWA service worker on the teacher's phone upon first load.

### CV Pipeline (per frame during attendance)

```
Phone Camera Frame
    ↓
[face-api.js] Detect faces
    ↓ Multiple faces? → "Show one face only"
    ↓ No face? → "No face detected"
[face-api.js] Extract bounding box + landmarks
    ↓
Quality Check (heuristics):
  - Face too small (< 20% frame width)  → "Move closer"
  - Face not centered                   → "Center your face"
  - Brightness out of range             → "Improve lighting"
  - Pose deviation > threshold          → "Face the camera"
    ↓
[Active Liveness Challenge] (see Liveness section)
    ↓
[face-api.js] Extract 128D face descriptor
    ↓
Euclidean distance vs. all embeddings for current course (cached locally)
    ↓
Best distance → Threshold evaluation:
  < 0.4  → HIGH CONFIDENCE   → mark PRESENT
  0.4–0.5 → UNCERTAIN        → "Please rescan"
  > 0.5  → NO MATCH          → allow manual fallback
```

### Model Specifications
| Property | Value |
|---|---|
| Detection Model | SSD MobileNet V1 |
| Landmark Model | face-api.js 68-point model |
| Embedding Model | face-api.js face recognition ResNet-34 |
| Embedding Dimensions | 128 |
| Similarity Metric | Euclidean Distance |
| High-Confidence Threshold | 0.40 (tunable) |
| Uncertain Threshold | 0.50 (tunable) |
| Input Resolution | 416×416 (detection), 150×150 (recognition) |
| Runtime | TensorFlow.js WASM backend |

### Face Template Schema (multiple embeddings per student)

Storing multiple embeddings per student captures variations in lighting, pose, and expression. The minimum during enrollment will be 3 samples.

```
FaceTemplate
  id              Int (PK)
  studentId       Int (FK → Student)
  embedding       Json     (PostgreSQL native JSON/Float array)
  modelName       String   ("face-api.js-resnet34")
  modelVersion    String   ("0.22.2")
  capturedAt      DateTime
  isActive        Boolean  (allows disabling without deletion)
```

### CV Limitations (documented honestly)

- **Printed photo spoof**: Active liveness (head movement) provides a practical barrier, but a cooperative third party holding the photo at the correct angle could potentially comply with simple challenges.
- **Replay video attack**: A 3D-printed mask or high-quality video replay might satisfy head-movement challenges under some conditions.
- **Lighting extremes**: Very dark or overexposed conditions reduce detection and recognition accuracy.
- **This mechanism significantly raises the effort required for proxy attendance** but does not eliminate it mathematically.

---

## Liveness / Anti-Spoofing

### Mechanism: Randomized Head-Movement Challenge

When a face passes quality check, the system issues a random challenge from:

```
TURN_LEFT   → "Please look to your left"
TURN_RIGHT  → "Please look to your right"
LOOK_UP     → "Please look up"
LOOK_DOWN   → "Please look down"
```

### Verification Method

Using MediaPipe Face Landmarker (468 landmarks), we track head pose angles across a sliding window of frames:
- **Yaw** (left/right rotation)
- **Pitch** (up/down rotation)

A challenge is **passed** when the head angle change exceeds a threshold within a time window in a continuous motion.

After passing the liveness challenge, the embedding is extracted from a **static, well-posed frame** (not the turned frame).

> [!WARNING]
> This is an MVP-grade active liveness mechanism. It is **not** equivalent to a dedicated passive anti-spoofing neural network. Its primary purpose is to make casual photo-spoofing infeasible in a normal classroom setting.

---

## Database Design (PostgreSQL + Prisma)

### Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  name         String
  role         String   // "ADMIN" | "TEACHER"
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions     AttendanceSession[]
  auditLogs    AuditLog[]
}

model Student {
  id                 Int      @id @default(autoincrement())
  registrationNumber String   @unique
  name               String
  email              String?
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  enrollments        Enrollment[]
  faceTemplates      FaceTemplate[]
  attendanceRecords  AttendanceRecord[]
}

model Course {
  id        Int      @id @default(autoincrement())
  code      String
  name      String
  section   String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([code, section])

  enrollments Enrollment[]
  sessions    AttendanceSession[]
}

model Slot {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  startTime String   // "09:00"
  endTime   String   // "10:00"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions  AttendanceSession[]
}

model Enrollment {
  id           Int      @id @default(autoincrement())
  courseId     Int
  studentId    Int
  serialNumber Int      // unique within a course, NOT globally unique
  enrolledAt   DateTime @default(now())

  course   Course  @relation(fields: [courseId], references: [id])
  student  Student @relation(fields: [studentId], references: [id])

  @@unique([courseId, studentId])
  @@unique([courseId, serialNumber])
  @@index([courseId])
}

model FaceTemplate {
  id           Int      @id @default(autoincrement())
  studentId    Int
  embedding    Json     // PostgreSQL JSONB array of 128 floats
  modelName    String   // "face-api.js-resnet34"
  modelVersion String   // "0.22.2"
  isActive     Boolean  @default(true)
  capturedAt   DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id])

  @@index([studentId])
}

model AttendanceSession {
  id        Int      @id @default(autoincrement())
  courseId  Int
  slotId    Int
  teacherId Int
  date      String   // "YYYY-MM-DD"
  status    String   @default("ONGOING")  // "ONGOING" | "FINALIZED"
  startedAt DateTime @default(now())
  finalizedAt DateTime?

  course   Course @relation(fields: [courseId], references: [id])
  slot     Slot   @relation(fields: [slotId], references: [id])
  teacher  User   @relation(fields: [teacherId], references: [id])
  records  AttendanceRecord[]

  @@unique([courseId, slotId, date])
  @@index([courseId, date])
}

model AttendanceRecord {
  id         Int      @id @default(autoincrement())
  sessionId  Int
  studentId  Int
  status     String   // "NOT_MARKED" | "PRESENT" | "ABSENT"
  method     String?  // "FACE" | "MANUAL" | null
  confidence Float?   // Euclidean distance (lower = better match)
  markedAt   DateTime?
  updatedAt  DateTime @updatedAt

  session AttendanceSession @relation(fields: [sessionId], references: [id])
  student Student           @relation(fields: [studentId], references: [id])

  @@unique([sessionId, studentId])  // Prevents duplicates at DB level
  @@index([sessionId])
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int?
  action    String   // e.g., "ATTENDANCE_MARKED", "FACE_ENROLLED"
  entityType String? // e.g., "Student", "AttendanceSession"
  entityId  Int?
  details   String?  // JSON metadata (NO passwords, NO embeddings)
  ip        String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

---

## Project Structure

```
attendance_system/
├── apps/
│   ├── api/                         # Node.js + Express backend
│   │   ├── src/
│   │   ├── prisma/                  # schema.prisma (PostgreSQL)
│   │   └── package.json
│   │
│   └── web/                         # Vite + React frontend (PWA)
│       ├── src/
│       ├── public/
│       │   └── models/              # face-api.js model weights
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared TypeScript types
│
├── docs/
│
├── poc/                             # CV Proof-of-Concept (standalone)
│
├── package.json                     # Root monorepo
└── README.md
```

---

## API Design

*Unchanged from previous architecture.*

---

## Offline Architecture (PWA & IndexedDB)

Because the application is now centrally hosted over the internet, network dropouts in a classroom are a real risk.

We will use a Progressive Web App (PWA) approach:
1. **App Shell & Models:** The Vite PWA plugin will cache the frontend assets and the CV model weights so the app can load without internet.
2. **Session Initialization:** When a teacher starts a session, the backend sends the list of enrolled students and their `FaceTemplate` embeddings. The frontend caches this data in **IndexedDB**.
3. **Offline Attendance:** If the internet drops during attendance, the CV pipeline continues working (since models and templates are in IndexedDB). Attendance records are stored locally in IndexedDB as `status: PENDING_SYNC`.
4. **Background Sync:** Once internet is restored, the frontend synchronizes the pending records to the backend. The backend is responsible for idempotent updates to prevent duplicates.

---

## Development Phases

| Phase | Description | Deliverable |
|---|---|---|
| **1** | Foundation | Monorepo setup, shared types, environment config, local Windows Postgres setup |
| **2** | Database + Backend Core | Prisma schema (PostgreSQL), CRUD APIs, JWT auth |
| **3** | Basic Web UI | Login, admin layout, student/course/slot/enrollment CRUD pages |
| **4** | **CV Proof-of-Concept** | Standalone HTML page on mobile: webcam → detect → embed → match. Validate face-api.js on mobile browser. |
| **5** | Face Enrollment | Admin UI to enroll student faces via webcam. |
| **6** | Face Recognition Engine | Integrate CV pipeline into the web app. |
| **7** | Liveness Challenge | Randomized head-movement challenge with MediaPipe landmark verification. |
| **8** | Attendance Workflow | Complete teacher workflow: start session → live grid → manual fallback → finalize. |
| **9** | Offline Resilience (PWA) | Service worker caching, IndexedDB session storage, offline sync queue. |
| **10** | Reports + Audit Log | Session reports, CSV/PDF export, audit log viewer. |
| **11** | Testing | Backend API tests, frontend component tests, CV tests. |
| **12** | Cloud Deployment | Environment variables setup, HTTPS/CORS config for central hosting. |

### Phase Gate Criteria

Before proceeding from Phase 4 to Phase 5: the CV POC must successfully:
- Request and gain camera permissions on a mobile device browser (iOS Safari / Android Chrome).
- Detect a real face with acceptable frame rate on mobile.
- Generate a consistent 128D embedding.
- Match a test identity with distance < 0.4.

---

## Security Summary

- **HTTPS Required**: The web app must be served over HTTPS, otherwise mobile browsers will block webcam access (`getUserMedia`).
- **CORS**: Must be configured on the backend to allow requests from the centrally hosted frontend domain.
- **Biometric Security**: Face embeddings are never returned in list APIs; they are only transmitted to the teacher's phone upon starting a specific attendance session for that course, over HTTPS.
- Passwords: `bcrypt` with cost factor ≥ 12.
- JWT: Short-lived access tokens, refresh tokens in `httpOnly` cookies.

---

## Acceptance Criteria

*Unchanged, with the addition of verifying mobile browser functionality and offline synchronization.*
