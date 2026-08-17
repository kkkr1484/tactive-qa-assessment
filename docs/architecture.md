# Architecture Document — LibraryOS

## 1. Overview

LibraryOS is a web-based Library Management System built to demonstrate
AI-assisted development, automated test generation, and an AI change loop
for feature iteration.

The system allows a librarian to **issue books to members** and **process
returns with automatic overdue fine calculation**. A holds queue feature
was later added via an AI change loop.

---

## 2. Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│              React (Next.js App Router)                     │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────────┐   │
│  │  Login Page  │  │  Dashboard │  │  Issue / Return   │   │
│  │  /login      │  │  /dashboard│  │  Forms (Client    │   │
│  └──────┬───────┘  └──────┬─────┘  │  Components)      │   │
│         │                 │        └─────────┬─────────┘   │
└─────────┼─────────────────┼─────────────────┼─────────────┘
          │ HTTPS           │                 │
┌─────────▼─────────────────▼─────────────────▼─────────────┐
│                    Next.js Server (Node)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Routes (/api/*)                    │   │
│  │  POST /api/books/issue     ← Auth + Validation      │   │
│  │  POST /api/books/return    ← Auth + Fine calc       │   │
│  │  GET  /api/books           ← Book list              │   │
│  │  GET  /api/books/[id]      ← Book detail            │   │
│  │  GET  /api/members         ← Member list + search   │   │
│  │  GET  /api/members/[id]    ← Member + issuance hist │   │
│  │  ANY  /api/auth/[...]      ← NextAuth.js            │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │              Business Logic Layer                   │   │
│  │  lib/fine-calculator.ts  ← Pure calculation fns     │   │
│  │  lib/auth.ts             ← NextAuth config          │   │
│  │  lib/prisma.ts           ← DB client singleton      │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │              Prisma ORM (v7)                        │   │
│  │  Adapter: @prisma/adapter-better-sqlite3            │   │
│  └──────────────────────────┬──────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   SQLite Database           │
              │   library.db (file-based)   │
              └─────────────────────────────┘
```

---

## 3. Data Flow

### Issue Flow
```
User selects member + book → IssueForm (client)
  → POST /api/books/issue
    → getServerSession() — 401 if not authenticated
    → Zod validation of { memberId, bookId }
    → Prisma: find member → validate active, membership not expired
    → Prisma: find book → validate available > 0
    → Prisma: count active issuances → validate under maxBooks limit
    → Prisma: check no duplicate active issuance
    → prisma.$transaction([
        issuance.create(dueDate = today + 14 days),
        book.update(available -= 1)
      ])
  → 201 { message, issuance }
    → IssueForm renders success with due date
```

### Return Flow
```
User selects member → ReturnForm fetches active issuances
  → GET /api/members/:id → active issuances list
User selects book → POST /api/books/return
  → getServerSession() — 401 if not authenticated
  → Zod validation of { issuanceId }
  → Prisma: find issuance → validate not already RETURNED
  → calculateFine(dueDate, today) → fine = max(0, days_overdue × ₹2)
  → prisma.$transaction([
      issuance.update(status=RETURNED, returnedAt, fine),
      book.update(available += 1)
    ])
  → 200 { message, fine, fineMessage }
    → ReturnForm renders fine amount
```

---

## 4. Technology Choices

| Technology | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Next.js 14 (App Router) | One repo for frontend + API, SSR, TypeScript native |
| Database | SQLite | Zero setup — assessor runs from README with no external DB |
| ORM | Prisma v7 | Type-safe queries, schema migrations, excellent DX |
| Auth | NextAuth.js v4 | Simple session management, credentials provider, JWT |
| Validation | Zod | Runtime schema validation on API inputs, TypeScript inference |
| Testing | Playwright | Browser-level E2E tests, TypeScript native, JSON reporter |
| Styling | Vanilla CSS | Maximum control, no dependency overhead |
| CI | GitHub Actions | Free tier, standard industry tool, mentioned in brief |

---

## 5. Security Architecture

| Concern | Implementation |
|---------|----------------|
| Authentication | NextAuth.js JWT sessions; all API routes check `getServerSession()` |
| Authorization | 401 returned before any DB operation if no valid session |
| Input validation | Zod schemas on all POST endpoints; 400 on invalid input |
| SQL injection | Impossible — Prisma uses parameterized queries exclusively |
| Secrets management | `.env` in `.gitignore`; `.env.example` committed with no real values |
| Password storage | bcryptjs (12 salt rounds) — never stored in plaintext |

---

## 6. AI Tools Used

| Tool | Purpose |
|------|---------|
| Google Gemini (Antigravity IDE) | Code generation, architecture design, test writing |
| Gemini API (ai-loop.sh) | Automated fix generation in Stage 3 change loop |
| GitHub Copilot | Inline code completion during development |
