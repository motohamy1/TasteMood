# TasteMood — AI Restaurant & Food Discovery Backend

TasteMood is an AI-powered food discovery platform for Egypt that answers the core question: **"What should I eat?"**

The system converts user natural language into structured preferences, retrieves candidates deterministically from a PostgreSQL database, ranks them using a transparent multi-factor scoring formula, and generates factual AI explanations.

---

## 🏗 Architectural Pipeline

```text
User Natural Language
        ↓
AI Intent / Preference Extraction (Gemini / OpenAI / Mock with Zod validation)
        ↓
Structured Recommendation Request
        ↓
Database Candidate Retrieval (Prisma PostgreSQL - Hard constraints & filters)
        ↓
Deterministic Scoring & Ranking (Preference, Price, Distance, Taste, Popularity, Freshness)
        ↓
Factual AI Explanation (Anti-hallucination strictly bounded by database facts)
        ↓
Final Recommendation Response
```

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase / PostgreSQL credentials and Gemini / OpenAI keys:
```bash
cp .env.example .env
```

### 3. Database Migration & Seeding
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000/api/v1` and interactive Swagger UI docs will be available at `http://localhost:5000/api/v1/docs`.

### 5. Run Automated Tests
```bash
npm test
```

---

## 📚 API Endpoints Overview

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/health` | Health check endpoint | Public |
| `POST` | `/api/v1/recommendations` | AI natural language & structured recommendation engine | Optional Auth |
| `GET` | `/api/v1/search/restaurants` | Structured & geo search for restaurants | Public |
| `GET` | `/api/v1/search/dishes` | Structured search for dishes with multi-criteria filters | Public |
| `GET` | `/api/v1/restaurants` | List restaurants (paginated, cuisine & price filters) | Public |
| `GET` | `/api/v1/restaurants/:id` | Get restaurant details, branches, and menus | Public |
| `GET` | `/api/v1/branches` | List branches with live open status & distance | Public |
| `GET` | `/api/v1/branches/:id` | Get branch details & operating hours | Public |
| `GET` | `/api/v1/menus/:id` | Get menu with structured dishes | Public |
| `GET` | `/api/v1/dishes/:id` | Get dish details, taste profile, and price history | Public |
| `GET` | `/api/v1/taxonomies` | List cuisines, categories, food tags, and atmosphere | Public |
| `GET` | `/api/v1/me` | Current authenticated user profile | User Token |
| `GET` | `/api/v1/me/preferences` | Get user dietary & cuisine preferences | User Token |
| `PUT` | `/api/v1/me/preferences` | Update explicit user preferences | User Token |
| `POST` | `/api/v1/interactions` | Record user interaction signal (LIKE, DISLIKE, etc.) | User Token |
| `GET` | `/api/v1/admin/stats` | Platform statistics and verification counts | Admin Token |
| `PUT` | `/api/v1/admin/restaurants/:id/verify` | Update restaurant verification status | Admin Token |
| `PUT` | `/api/v1/admin/dishes/:id/verify` | Update dish verification status | Admin Token |
