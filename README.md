# Starline Connectors — Inventory Management System

A full-stack, cloud-native Inventory Management System for **Starline Connectors**, a manufacturing company. Built for deployment on **Google Cloud Platform** (Cloud Run + Cloud SQL + Cloud Storage).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express.js (Docker / Cloud Run) |
| Database | PostgreSQL (Google Cloud SQL) |
| Auth | JWT with role-based access control |
| PDF | Puppeteer + Handlebars invoice templates |
| Email | Nodemailer (SMTP) |
| Storage | Google Cloud Storage (invoice PDFs) |

---

## Roles

| Role | Responsibilities |
|---|---|
| **Inventory Manager** | Add items, track inventory entry stage |
| **QC Inspector** | Approve/reject at incoming & outgoing QC |
| **Production Manager** | Mark items as production-complete |
| **Admin** | Full access, invoice creation, reports |

---

## 5-Stage Workflow

```
Inventory Entry → QC Incoming → Production → QC Outgoing → Finished Goods → Invoice
```

Each transition:
- Validates the actor's role
- Records full stage history
- Sends in-app notifications + email to the next stage's users

---

## Project Structure

```
IMS/
├── backend/
│   ├── db/schema.sql         # PostgreSQL schema
│   ├── src/
│   │   ├── config/           # Database connection
│   │   ├── middleware/       # JWT auth + role guards
│   │   ├── models/           # Query models (6)
│   │   ├── controllers/      # Business logic (6)
│   │   ├── routes/           # Express routers (6)
│   │   └── services/         # Email, GCS, PDF
│   ├── templates/            # Handlebars invoice HTML
│   ├── .env.example
│   └── Dockerfile
└── frontend/
    └── src/
        ├── api/              # Axios service layer
        ├── context/          # Auth context
        ├── components/       # Layout, UI, Notifications
        └── pages/            # 8 pages
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- PostgreSQL ≥ 14
- (For GCS features) Google Cloud project + bucket

### 1. Database Setup
```bash
createdb starline_ims
psql starline_ims < backend/db/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, SMTP, GCS settings
npm install
npm run dev        # http://localhost:8080
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Default Admin Login
| Field | Value |
|---|---|
| Email | `admin@starlineconnectors.com` |
| Password | `Admin@1234` |

> ⚠️ Change this password immediately after first login.

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret (min 32 chars)
- `GCS_BUCKET_NAME` — GCS bucket for invoice PDFs
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — Email credentials
- `COMPANY_STATE` — Home state for GST calculation (default: Maharashtra)

---

## GCP Deployment

### Backend (Cloud Run)
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/starline-ims-backend ./backend

gcloud run deploy starline-ims-backend \
  --image gcr.io/PROJECT_ID/starline-ims-backend \
  --platform managed --region asia-south1 \
  --set-env-vars DATABASE_URL=...,JWT_SECRET=...,GCS_BUCKET_NAME=... \
  --allow-unauthenticated
```

### Cloud SQL
1. Create PostgreSQL 15 instance
2. Run `backend/db/schema.sql`
3. Set `DATABASE_URL` in Cloud Run env vars

### Cloud Storage (Invoice PDFs)
1. Create a **private** bucket
2. Grant Cloud Run service account the `Storage Object Admin` role
3. Set `GCS_BUCKET_NAME` — ADC handles auth automatically on Cloud Run

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/register` | Register user |
| GET | `/api/inventory` | List items |
| POST | `/api/inventory` | Add item |
| POST | `/api/stages/advance/:id` | Advance stage |
| POST | `/api/stages/reject/:id` | Reject at QC |
| POST | `/api/invoices` | Create invoice + PDF |
| GET | `/api/invoices/:id/download` | Fresh signed URL |
| GET | `/api/reports/summary` | Stage counts |
| GET | `/api/notifications` | User notifications |

---

## License

MIT © Starline Connectors
