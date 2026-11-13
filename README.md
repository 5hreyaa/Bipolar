# Snack Overflow — Bipolar Factory Office Pantry App

**Snack Overflow** is the internal office pantry management application built for **Bipolar Factory** (Coimbatore).

It allows Bipolar Factory teams to browse pantry snacks with product packaging photography, check live stock status, vote for the *Snack of the Week*, and grab snacks safely without race conditions—while giving pantry administrators full CRUD inventory management, image uploads, an AI-assisted **Smart Snack Scanner**, restocking, and an auditable activity log.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, React Router v6, Lucide Icons, Custom CSS
- **Backend:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, Argon2id (`argon2-cffi`), PyJWT
- **Database:** Neon PostgreSQL (with local SQLite fallback support for quick offline testing)
- **Real-Time:** Native FastAPI WebSockets (post-commit event broadcasting)
- **Computer Vision:** Pillow + pretrained Hugging Face `openai/clip-vit-base-patch32` (`transformers`, CPU `torch`)
- **Testing:** Pytest + FastAPI `TestClient` + multi-threaded concurrency tests

---

## Project Structure

```text
bipolar/
├── backend/
│   ├── alembic/                  # Database migration environment & versions
│   │   └── versions/
│   ├── app/
│   │   ├── models/               # SQLAlchemy 2.0 ORM models (User, Snack, Vote, Activity)
│   │   ├── schemas/              # Pydantic request & response validation schemas
│   │   ├── routers/              # Modular API routers (auth, snacks, activities, websocket)
│   │   ├── services/             # Business logic, atomic DB transactions, WS manager
│   │   ├── config.py             # Environment settings loader
│   │   ├── database.py           # Engine, SessionLocal, SQLite/PostgreSQL tuning
│   │   ├── dependencies.py       # JWT authentication & Admin RBAC dependencies
│   │   ├── exceptions.py         # Standard {error: {code, message}} error handlers
│   │   └── main.py               # FastAPI application entrypoint
│   ├── scripts/
│   │   └── seed.py               # Idempotent seed script (demo users + 19 snacks)
│   ├── tests/                    # Pytest suite (auth, CRUD, voting, activity, concurrency, WS)
│   ├── .env.example
│   ├── alembic.ini
│   ├── pytest.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                  # Typed fetch client and endpoint modules
│   │   ├── components/           # Reusable UI components (Navbar, SnackCard, Modals, Skeletons)
│   │   ├── context/              # AuthContext, ToastContext, WebSocketContext
│   │   ├── pages/                # Login, Dashboard, Snacks Catalog, Snack Detail, Admin, Activity
│   │   ├── types/                # Shared TypeScript interfaces
│   │   ├── App.tsx               # Route definitions & protected routes
│   │   └── index.css             # Responsive light-theme design system
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

---

## Demo Credentials

After running the seed script, you can sign in manually or use the **1-click Demo Login buttons** on the login page:

| Role   | Email                        | Password    | Capabilities |
| ------ | ---------------------------- | ----------- | ------------ |
| Admin  | `admin@snackoverflow.com`    | `admin123`  | All member actions + Add/Edit/Delete/Restock snacks + View paginated activity log |
| Member | `member@snackoverflow.com`   | `member123` | Browse, search, filter, paginate, consume snacks, vote & unvote |

---

## Setup & Local Startup

### 1. Neon PostgreSQL Configuration

1. Create a free project at [Neon](https://neon.tech/).
2. Copy your PostgreSQL connection string from the Neon dashboard (e.g. `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. Create `backend/.env` from `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

4. Update `DATABASE_URL` and `JWT_SECRET_KEY` inside `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<neon-host>/<dbname>?sslmode=require
JWT_SECRET_KEY=your-long-random-secret-key
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

> **Note:** `app/config.py` automatically normalizes `postgres://` or `postgresql://` URLs to `postgresql+psycopg2://` for SQLAlchemy 2.0. If no `.env` file is present during quick local evaluation, it falls back to a local SQLite database (`snack_overflow_dev.db`).

### 2. Backend Setup, Migrations & Seed Data

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run Alembic database migrations
alembic upgrade head

# Seed demo users and 19 sample snacks
python -m scripts.seed

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The API will be live at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 3. Frontend Setup & Startup

```bash
cd frontend

# Optional: copy env example (defaults to http://localhost:8000)
cp .env.example .env

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Running Tests

The backend test suite uses **Pytest** with an isolated temporary database per test (never touching your Neon or development database).

```bash
cd backend
pytest -v
```

*(Optionally set `TEST_DATABASE_URL` in `backend/.env` to run the entire suite against an isolated PostgreSQL test database.)*

### What the Tests Cover

- `tests/test_auth.py`: Login success, invalid credentials (`401`), Argon2 hash verification (no plaintext passwords), JWT expiry & malformed tokens (`401`), and RBAC blocking members from admin routes (`403`).
- `tests/test_snacks.py`: Server-side search, category/status filters, sorting, pagination, dynamic stock status boundaries (`stocked` → `running_low` → `gone`), Admin CRUD, duplicate snack name conflicts (`409`), input validation (`422`), insufficient stock (`409`), and deterministic *Snack of the Week* tie-breaking.
- `tests/test_voting.py`: Voting (`201`), duplicate vote conflict (`409`), multi-user vote counting, unvoting (`200`), and missing vote handling (`404`).
- `tests/test_activities.py`: Activity log generation across create, consume, restock, update, and delete operations; pagination; action filters; preserving logs after snack deletion.
- `tests/test_concurrency.py`:
  - **10 simultaneous threads** racing to consume the **last 3 packets**: asserts **exactly 3 succeed (`200`)**, **7 fail with `409 Conflict`**, final DB quantity is **`0`** (never negative), and **exactly 3** `consume` activity rows are saved.
  - **5 simultaneous vote requests** by the same user: asserts **1 succeeds (`201`)** and **4 fail with `409 Conflict`**.
- `tests/test_websocket.py`: Token validation on `/ws` and post-commit real-time broadcast verification.
- `tests/test_images_and_scanner.py`: Product `brand`/`image_url`/`price` persistence and brand search, admin-only `POST /snacks/upload-image` validation & `/uploads` static serving, `GET /scanner/info`, `POST /scanner/predict` (confirming unconfirmed scans never auto-save), and manual creation independence when the CV module is unavailable.

---

## Product Images & Smart Snack Scanner

### Product Image Catalogue
- Every snack supports optional `brand`, `image_url`, and `price` fields (added via non-destructive Alembic migration `7d722c20ad35`).
- Admins can either supply a reliable external `image_url` or upload an image file (`JPEG`, `PNG`, `WEBP`, up to 5 MB) via `POST /snacks/upload-image`. Uploaded images are verified and re-encoded with Pillow, saved under `backend/uploads/snacks/` with UUID filenames, and served via `/uploads/...` while storing only URL references in PostgreSQL.
- Frontend `SnackImage` components display consistent aspect-ratio product photography across cards, *Snack of the Week*, admin tables, and snack detail views, falling back cleanly to `/placeholder-snack.svg` when no image is set or loading fails.
- The seed script (`python -m scripts.seed`) populates 19 realistic branded snacks with locally cached demo packaging photography in `backend/uploads/demo/`.

### Smart Snack Scanner (Computer Vision Module)
- Accessible exclusively to admins under **Smart Scanner** (`/admin/scanner`) in the navigation bar and isolated from core inventory CRUD.
- Processes uploaded snack photos using **Pillow** and the pretrained Hugging Face vision-language model **`openai/clip-vit-base-patch32`** (zero-shot classification across `sweet`, `savoury`, `drink`, and `healthy-ish`, with no custom model training).
- Returns the uploaded preview URL, predicted category, confidence score, full per-category breakdown, and explicit low-confidence flag (`confidence < 0.40`).
- **Explicit Human-in-the-Loop:** Scanning an image (`POST /scanner/predict`) never writes to `snacks` or `activities`. The admin can adjust the category, enter snack name, brand, quantity, and price, and reuse the scanned photo only when explicitly confirming via `POST /snacks`.
- **Known Limitations:** `openai/clip-vit-base-patch32` predicts broad pantry categories only and cannot reliably recognize exact snack brands, weights, or flavours. Manual snack creation remains completely independent if the AI scanner is unavailable.

---

## Database Schema Design

| Table        | Key Columns & Constraints |
| ------------ | ------------------------- |
| `users`      | `id` (PK), `name`, `email` (UNIQUE, indexed), `password_hash`, `role` (`admin` \| `member`, indexed), `created_at` |
| `snacks`     | `id` (PK), `name` (UNIQUE, indexed), `brand` (indexed, nullable), `category` (indexed), `quantity` (`CHECK quantity >= 0`, indexed), `low_stock_threshold` (`CHECK >= 0`, default `5`), `image_url` (nullable), `price` (`CHECK price >= 0`, nullable), `created_at`, `updated_at` |
| `votes`      | `id` (PK), `user_id` (FK → `users.id` ON DELETE CASCADE), `snack_id` (FK → `snacks.id` ON DELETE CASCADE), `created_at`, **`UNIQUE(user_id, snack_id)`** |
| `activities` | `id` (PK), `user_id` (FK → `users.id` ON DELETE SET NULL), `snack_id` (FK → `snacks.id` ON DELETE SET NULL), `snack_name`, `action` (indexed), `amount`, `created_at` (indexed) |

### Dynamic Snack Status Calculation

Status is never stored redundantly—it is derived dynamically from `quantity` and `low_stock_threshold` in both SQL filters and ORM properties so it can never drift out of sync:

- **`stocked`**: `quantity > low_stock_threshold`
- **`running_low`**: `1 <= quantity <= low_stock_threshold`
- **`gone`**: `quantity == 0`

---

## API Endpoints

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for 'Spicy Chips'. Requested 5, but only 3 available."
  }
}
```

| Method   | Endpoint              | Auth Required | Description |
| -------- | --------------------- | ------------- | ----------- |
| `GET`    | `/health`             | Public        | Service health check |
| `POST`   | `/auth/login`         | Public        | Authenticate and receive JWT + user profile |
| `GET`    | `/auth/me`            | Authenticated | Get current logged-in user |
| `GET`    | `/snacks/summary`     | Authenticated | Dashboard stats + Snack of the Week |
| `GET`    | `/snacks`             | Authenticated | Search, filter (`category`, `status`), sort, paginate snacks |
| `GET`    | `/snacks/{id}`        | Authenticated | Get single snack details |
| `POST`   | `/snacks`             | **Admin**     | Create a new snack (`201`) |
| `POST`   | `/snacks/upload-image`| **Admin**     | Upload & verify product photo (`JPEG`/`PNG`/`WEBP`, max 5 MB) |
| `PATCH`  | `/snacks/{id}`        | **Admin**     | Update snack metadata, brand, price, image URL, or threshold |
| `DELETE` | `/snacks/{id}`        | **Admin**     | Delete snack (preserves activity history) |
| `POST`   | `/snacks/{id}/consume`| Authenticated | Atomically consume `{ "amount": N }` (`409` if insufficient) |
| `POST`   | `/snacks/{id}/restock`| **Admin**     | Atomically restock `{ "amount": N }` |
| `POST`   | `/snacks/{id}/vote`   | Authenticated | Cast 1 vote for snack (`409` on duplicate) |
| `DELETE` | `/snacks/{id}/vote`   | Authenticated | Remove your vote (`404` if not voted) |
| `GET`    | `/activities`         | **Admin**     | Paginated activity audit log (`page`, `per_page`, `action`, `snack_id`) |
| `GET`    | `/scanner/info`       | **Admin**     | Smart Snack Scanner model metadata & limitations |
| `POST`   | `/scanner/predict`    | **Admin**     | Predict snack category from photo (preview only; never auto-saves) |
| `WS`     | `/ws?token=<jwt>`     | Authenticated | Live post-commit stock & vote events |

---

## Key Architecture & Design Decisions (Interview Guide)

### 1. How Concurrency & Negative Stock Prevention Work
If two people click **"Grab 1"** at the exact same millisecond when only 1 packet remains, a naive app (`SELECT quantity` in Python → check `if quantity >= 1` → `UPDATE quantity`) suffers from a **Time-of-Check to Time-of-Use (TOCTOU)** race condition, resulting in `-1` stock.

Instead, `consume_snack()` performs a single **atomic conditional SQL `UPDATE`**:
```sql
UPDATE snacks
SET quantity = quantity - :amount, updated_at = :now
WHERE id = :id AND quantity >= :amount
RETURNING quantity, name;
```
PostgreSQL acquires a row-level lock on that snack row during the `UPDATE`. Only requests where `quantity >= amount` holds *at the moment of update* will modify the row. Both the stock decrement and the `activities` row insertion happen in the **same database transaction**. If zero rows are updated, the transaction rolls back and returns `409 Conflict` (or `404` if the snack doesn't exist). A `CHECK (quantity >= 0)` database constraint acts as an extra safety net.

### 2. How Vote Uniqueness Works
The `votes` table has a database-level `UNIQUE(user_id, snack_id)` constraint (`uq_votes_user_snack`). Even if a user sends multiple simultaneous `POST /snacks/{id}/vote` requests, PostgreSQL rejects duplicates with an `IntegrityError`, which the backend catches, rolls back cleanly, and converts into a user-friendly `409 Conflict` (`ALREADY_VOTED`).

### 3. Deterministic "Snack of the Week" Tie-Breaker
When two snacks tie for the highest vote count, the query orders by:
`vote_count DESC, name ASC, id ASC`.
This guarantees every page refresh and every user sees the exact same winner instead of random database row ordering.

### 4. Authentication & Authorization
- Passwords are hashed with **Argon2id** (`argon2-cffi`), never stored in plaintext.
- Login issues an HS256 **JWT** containing `sub` (user ID) and `role`.
- Backend dependencies (`get_current_user`, `require_admin`) verify the token and enforce permissions on every protected route. Hiding admin buttons in React is purely for UX; security is enforced server-side.

### 5. WebSockets as a Post-Commit Enhancement
REST APIs + PostgreSQL remain the single source of truth. `ws_manager.broadcast_from_sync(...)` is called **only after `db.commit()` succeeds**. If a WebSocket drops or fails, database integrity is completely unaffected, and clients automatically reconnect.

### 6. Trade-offs Made
- **Synchronous SQLAlchemy (`psycopg2`) vs Async (`asyncpg`):** Used synchronous SQLAlchemy 2.0 sessions inside FastAPI sync routes (which FastAPI runs in a threadpool) for simpler transaction debugging, straightforward Alembic integration, and rock-solid reliability on Windows and Neon.
- **No Refresh Tokens / Sign-up Flow:** Kept authentication focused on seeded demo accounts and a 24-hour JWT per assignment scope.

---

## What Would Fail First at 100x Users?

If Snack Overflow scaled from one office (~50 users) to 100x traffic (~5,000+ concurrent users across many offices):

1. **In-Memory WebSocket Manager (`active_connections` Set):** Currently lives inside a single Uvicorn worker process. Running multiple backend containers/workers behind a load balancer would mean users connected to Worker A wouldn't receive broadcasts triggered on Worker B.
   - *Fix:* Introduce **Redis Pub/Sub** (or PostgreSQL `LISTEN/NOTIFY`) so all workers broadcast events across instances.
2. **Database Connection Exhaustion on Neon:** Each synchronous request borrows a connection from SQLAlchemy's pool (`pool_size=10, max_overflow=20`). At 100x concurrent load across multiple app replicas, PostgreSQL connection limits would saturate quickly.
   - *Fix:* Use Neon's built-in **PgBouncer pooled connection string** (`-pooler` endpoint) or move to async I/O (`asyncpg`).
3. **Offset Pagination & `COUNT(*)` Queries on `activities`:** As the `activities` table grows to millions of rows, `OFFSET` pagination and full filtered `COUNT(*)` scans slow down linearly.
   - *Fix:* Switch to **cursor/keyset pagination** (`WHERE (created_at, id) < (:last_ts, :last_id)`) and index `(snack_id, created_at DESC)`.
4. **Hot-Row Lock Contention:** If 500 users simultaneously grab the same trending snack, row-level locks on that single `snacks` row serialize updates.
   - *Fix:* Add short request timeouts, optimistic/retry handling, or queue high-burst stock reservations, and cache `GET /snacks/summary` in Redis for 5–10 seconds with invalidation on mutation.

