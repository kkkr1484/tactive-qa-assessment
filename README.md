# LibraryOS 📚

[![Playwright Tests](https://github.com/kkkr1484/tactive-qa-assessment/actions/workflows/test.yml/badge.svg)](https://github.com/kkkr1484/tactive-qa-assessment/actions/workflows/test.yml)

A **Library Management System** built for the Tactive AI-Powered QA Automation
Internship Assessment. Demonstrates an AI change loop where an AI agent implements
a feature, runs tests, detects failures, and self-corrects.

## 🎯 What's Built

**Core Feature:** Book Issue & Return system with:
- Librarian authentication (session-based)
- Book availability tracking
- Member borrowing limits (max 3 books)
- Membership expiry validation  
- Overdue fine calculation (₹2/day)
- Atomic database transactions

**AI Change Loop (Stage 3):** Holds queue added via semi-automated AI loop:
- `scripts/ai-loop.sh` calls Gemini API with test failures
- Applies fixes and re-runs tests until suite passes
- Evidence logged to `evidence/loop-log.md`

---

## 🚀 Quick Start (From Scratch)

### Prerequisites
- Node.js 18+ (check: `node --version`)
- npm 9+ (check: `npm --version`)
- Git Bash or WSL (for shell scripts on Windows)

### 1. Clone / Extract

```bash
git clone <repo-url> komal_tactic
cd komal_tactic
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
cp .env.example .env
# .env already has working defaults for local development
# No changes needed to run locally
```

### 4. Set Up Database

```bash
# Create the SQLite database and apply schema
npm run db:migrate

# Seed with test data (members, books, issuances)
npm run db:seed
```

### 5. Start the App

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

**Login:** `admin@library.com` / `librarian123`

---

## 🧪 Running Tests

### Install Playwright browsers (first time only)

```bash
npx playwright install chromium
```

### Run the full test suite

```bash
npm test
```

### Run with visual browser (headed mode)

```bash
npm run test:headed
```

### View HTML test report

```bash
npm run test:report
```

---

## 🔴 Deliberate Red Run (Demonstrating Test Failures)

To see the tests catch a bug:

```bash
# This script breaks the availability check, runs tests (they fail),
# then restores the code
node scripts/break-and-test.js
```

Or manually:
1. Open `app/api/books/issue/route.ts`
2. Change `book.available <= 0` to `book.available < 0` (removes the = 0 case)
3. Run `npm test` — TC-02 and TC-03 will fail
4. Revert the change to restore

Evidence of a red run is in `evidence/red-run.json`.

---

## 🤖 Running the AI Change Loop (Stage 3)

The AI loop adds a "holds queue" feature autonomously:

```bash
# Set your Gemini API key
export GEMINI_API_KEY=your_api_key_here

# Run the loop (requires Git Bash / WSL on Windows)
bash scripts/ai-loop.sh
```

The loop:
1. Runs all Playwright tests
2. Feeds failures to Gemini API
3. Applies generated fixes
4. Repeats until all tests pass (max 5 attempts)

Evidence is logged to `evidence/loop-log.md`.

---

## 📁 Project Structure

```
komal_tactic/
├── README.md                     # This file
├── .env.example                  # Safe to commit — no real secrets
├── .env                          # Local env (gitignored)
├── prisma/
│   ├── schema.prisma             # Data model
│   ├── seed.ts                   # Test data seeder
│   └── migrations/               # Migration history
├── prisma.config.ts              # Prisma v7 config (datasource URL here)
├── lib/
│   ├── prisma.ts                 # DB client singleton
│   ├── auth.ts                   # NextAuth configuration
│   └── fine-calculator.ts        # Business logic (pure functions)
├── app/
│   ├── layout.tsx                # Root layout + SEO
│   ├── page.tsx                  # Redirect (login or dashboard)
│   ├── globals.css               # Design system (dark glassmorphism)
│   ├── providers.tsx             # NextAuth SessionProvider
│   ├── login/page.tsx            # Login page
│   ├── dashboard/
│   │   ├── page.tsx              # Server component (auth + data fetch)
│   │   └── DashboardClient.tsx   # Client component (tabs, state)
│   └── api/
│       ├── auth/[...nextauth]/   # NextAuth handler
│       ├── books/
│       │   ├── route.ts          # GET /api/books
│       │   ├── [id]/route.ts     # GET /api/books/:id
│       │   ├── issue/route.ts    # POST /api/books/issue
│       │   └── return/route.ts   # POST /api/books/return
│       └── members/
│           ├── route.ts          # GET /api/members
│           └── [id]/route.ts     # GET /api/members/:id
├── components/
│   ├── IssueForm.tsx             # Issue form UI
│   └── ReturnForm.tsx            # Return form UI
├── tests/
│   └── e2e/
│       ├── issue.spec.ts         # 6 issuance tests
│       └── return.spec.ts        # 6 return tests
├── playwright.config.ts          # Test config (JSON + HTML reporters)
├── scripts/
│   └── ai-loop.sh               # Stage 3 AI change loop
├── evidence/
│   ├── green-run.json            # Passing test run output
│   ├── red-run.json              # Deliberate failure run output
│   └── loop-log.md              # AI change loop evidence
├── docs/
│   ├── architecture.md           # Component diagram, tech choices
│   ├── design.md                 # Data model, API, business rules
│   └── user-guide.md            # Non-technical usage guide
└── .github/
    └── workflows/test.yml        # GitHub Actions CI
```

---

## 🛡️ Security Notes

- **Authentication:** All API routes require a valid NextAuth session (401 if missing)
- **Input validation:** Zod schemas validate all POST request bodies
- **SQL injection:** Not possible — Prisma uses parameterized queries
- **Secrets:** `.env` is gitignored; `.env.example` contains no real values
- **Passwords:** Hashed with bcryptjs (10 salt rounds)

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:migrate` | Create DB and apply schema |
| `npm run db:seed` | Populate with test data |
| `npm run db:reset` | Wipe and re-migrate (destroys data) |
| `npm run db:studio` | Open Prisma Studio (GUI for DB) |
| `npm test` | Run Playwright test suite |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:report` | Open HTML test report |

---

## 📊 Test Coverage

| Test Case | Scenario | Expected |
|-----------|----------|---------|
| TC-01 | Happy path: issue available book | 201 + success message |
| TC-02 | Unavailable book (available = 0) | 401 from direct API |
| TC-03 | Member at book limit (3/3) | 400 + limit error |
| TC-04 | Expired membership | 400 + expiry error |
| TC-05 | Unauthenticated issue request | 401 |
| TC-06 | Missing required fields | 400 validation error |
| TC-07 | Happy path: return on time, no fine | 200 + "No fine" |
| TC-08 | Overdue return: Bob, 7 days = ₹14 | 200 + fine = 14 |
| TC-09 | Double return of same book | 400 + "already returned" |
| TC-10 | Return non-existent issuance | 404 |
| TC-11 | Unauthenticated return request | 401 |
| TC-12 | Availability count correctness | count = initial after issue + return |

---

## 📋 AI Tools Used

| Tool | Used for |
|------|---------|
| Google Gemini (Antigravity IDE) | Code generation, architecture, test writing, documentation |
| Gemini API | Stage 3 automated change loop (`scripts/ai-loop.sh`) |
| GitHub Copilot | Inline code suggestions during development |

---

## 🎓 Assessment Deliverables

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Source code + README | This repository |
| 2 | Test suite + captured runs | `tests/`, `evidence/` |
| 3 | AI change loop evidence | `evidence/loop-log.md` |
| 4 | Architecture, Design, User Guide | `docs/` |
| 5 | Presentation deck | `docs/presentation.pdf` |
| 6 | Video demo | `docs/demo-video.mp4` or link |
