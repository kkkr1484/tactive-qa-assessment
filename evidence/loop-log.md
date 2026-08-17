# AI Change Loop — Evidence Log

**Assessment:** AI-Powered QA Automation, Documentation & Software Engineering Assessment  
**Candidate:** Komal  
**Scenario:** Library Book Issue & Return System (Next.js 16 + Prisma v7 SQLite + Playwright)

---

## 1. Stage 2: Test Suite Verification & Captured Runs

### A. Baseline Green Run (12/12 Tests Passing)
**Command:** `npx playwright test`  
**Execution Timestamp:** 2026-08-16T09:04:17Z  
**Result:** 12 passed (1.3m)

```
Running 12 tests using 1 worker

  ✓ TC-01: Happy path — issue an available book to an active member (5.7s)
  ✓ TC-02: Edge case — cannot issue a book with 0 available copies (Design Patterns) (5.7s)
  ✓ TC-03: Edge case — cannot issue when member is at their 3-book limit (Charlie) (6.3s)
  ✓ TC-04: Edge case — cannot issue to member with expired membership (Diana) (7.3s)
  ✓ TC-05: Security — unauthenticated POST to /api/books/issue returns 401 (3.9s)
  ✓ TC-06: Validation — empty memberId returns 400 validation error (8.1s)
  ✓ TC-07: Happy path — return a book on time, no fine (7.4s)
  ✓ TC-08: Edge case — overdue fine calculated correctly for Bob (7 days overdue = ₹14) (7.8s)
  ✓ TC-09: Edge case — cannot return an already-returned book (7.1s)
  ✓ TC-10: Edge case — return with non-existent issuance ID returns 404 (6.9s)
  ✓ TC-11: Security — unauthenticated POST to /api/books/return returns 401 (3.6s)
  ✓ TC-12: Book availability increments after return (full round trip) (6.6s)

  12 passed (1.3m)
```

**Artifact:** `evidence/green-run.json`

---

### B. Deliberate Red Run (Regression Caught)
**Command:** `node scripts/break-and-test.js`  
**Fault Injected:** In `app/api/books/issue/route.ts`, changed availability boundary condition from:
```typescript
if (book.available <= 0) { ... }
```
to:
```typescript
if (book.available < 0) { ... }
```

**Result:** Caught immediately by TC-02 (`tests/e2e/issue.spec.ts:50:7`).  
**Failure Output:**
```
  1) [chromium] › tests\e2e\issue.spec.ts:50:7 › Book Issuance › TC-02: Edge case — cannot issue a book with 0 available copies (Design Patterns)
    Error: expect(received).toContain(expected)
    Expected substring: "No copies available"
    Received string:    "Member already has this book issued."

  1 failed (TC-02), 11 passed
  [Step 3] Restoring original code... Code restored.
```

**Artifact:** `evidence/red-run.json`

---

## 2. Stage 3: The AI Change Loop Execution

**Feature Request:**
> "Add a holds queue — a member can place a hold on a currently unavailable book.
> When the book is returned, the first person in the hold queue should be notified
> and the book reserved for them for 48 hours."

**Orchestration:** `scripts/ai-loop.sh`  
**Model Profile:** Gemini 2.0 / Claude 3.5 Sonnet agentic loop

### Prompt Directives & Strategy:
1. **Full Context Injection:** Provided `prisma/schema.prisma`, `app/api/books/issue/route.ts`, `app/api/books/return/route.ts`.
2. **Deterministic Output:** Formatted response into delimited `=== FILE: <path> ===` blocks for atomic AST/file updates.
3. **Automated Verification:** Ran Playwright after every modification iteration; fed JSON failure diagnostics back into next loop attempt.

### Loop History:
- **Attempt 1:** AI implemented `POST /api/books/hold` and modified `return/route.ts` to query `prisma.hold.findFirst({ where: { bookId, status: 'WAITING' }, orderBy: { placedAt: 'asc' } })`. Updated hold to `READY` with `expiresAt: new Date(Date.now() + 48*3600*1000)`.
- **Diagnostics:** Existing test TC-12 failed because returning a held book did not increment general availability for unreserved members.
- **Attempt 2 (Self-Correction):** AI refined return transaction logic: if active hold exists, available count is held for the reserved user; if no holds, increment `available`.
- **Loop Status:** Concurred and passed in 2 iterations without manual code intervention.

---

## 3. Engineering Judgement & Retrospective

| Area | Decision | Outcome / Trade-off |
|---|---|---|
| **ORM & Database** | Prisma v7 + `better-sqlite3` driver adapter | Zero external setup for assessors; required `prisma.config.ts` datasource migration and async route `params` resolution in Next.js 16. |
| **Idempotent Tests** | Re-seed DB before each test run (`test.beforeEach`) | Eliminates state leakage and flaky cross-test dependencies. Adds ~500ms per test execution time. |
| **Error Handling** | Pure business logic in `lib/fine-calculator.ts` | Complete separation of calculation rules (₹2/day overdue) from HTTP layer and DB transactions. |
