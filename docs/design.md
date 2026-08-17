# Design Document — LibraryOS

## 1. Data Model

### Entity Relationship

```
User (Librarian)
  id, email, password (bcrypt), name, role

Member
  id, name, email, phone
  membershipEnd (DateTime)  ← compared to today for validity
  maxBooks (Int, default 3) ← maximum concurrent issuances
  isActive (Boolean)

Book
  id, title, author, isbn (unique)
  totalCopies (Int)         ← never changes after creation
  available (Int)           ← decremented on issue, incremented on return

Issuance (join: Member ↔ Book)
  id
  bookId (FK → Book)
  memberId (FK → Member)
  issuedAt (DateTime, auto)
  dueDate (DateTime)        ← issuedAt + 14 days
  returnedAt (DateTime?)    ← null until returned
  fine (Float?)             ← calculated on return
  status: ACTIVE | RETURNED | OVERDUE

Hold (added in Stage 3 AI loop)
  id
  bookId (FK → Book)
  memberId (FK → Member)
  placedAt (DateTime, auto)
  expiresAt (DateTime?)     ← set when status becomes READY
  status: WAITING | READY | EXPIRED | CANCELLED
```

### State Transitions

**Issuance States:**
```
[Issue]
  → ACTIVE
     ↓ (if dueDate passes without return)
  → OVERDUE
     ↓ (on return — always possible from ACTIVE or OVERDUE)
  → RETURNED  ✓ terminal
```

**Hold States:**
```
[Hold placed]
  → WAITING
     ↓ (book returned and this hold is first in queue)
  → READY (expiresAt = now + 48h)
     ↓ expiresAt passes without issuance  ↓ member issues the book
  → EXPIRED ✓ terminal                  → CANCELLED ✓ terminal
```

---

## 2. Key Business Rules

| Rule | Implementation | Edge Case |
|------|---------------|-----------|
| Book must be available | `book.available > 0` check | Returns 400 if 0 |
| Member must have active membership | `membershipEnd >= today` | Returns 400 with expiry message |
| Member must be active | `member.isActive === true` | Returns 400 |
| Member cannot exceed maxBooks | `activeIssuances < member.maxBooks` | Returns 400 with current limit |
| No duplicate active issuance | Check for existing ACTIVE/OVERDUE for same member+book | Returns 400 |
| Cannot return already-returned book | `issuance.status === 'RETURNED'` | Returns 400 |
| Fine = days_overdue × ₹2 | `Math.floor(diffMs / 86400000) * 2` | 0 if on time |
| Loan period | 14 days from issue date | `dueDate = issuedAt + 14 days` |

---

## 3. API Design

### POST /api/books/issue

**Request:**
```json
{ "memberId": "string", "bookId": "string" }
```

**Success (201):**
```json
{
  "message": "Book issued successfully",
  "issuance": {
    "id": "cuid...",
    "dueDate": "2026-08-30T...",
    "book": { "title": "Clean Code", "author": "...", "isbn": "..." },
    "member": { "name": "Alice Johnson", "email": "..." }
  }
}
```

**Error responses:**
| Code | Condition |
|------|-----------|
| 401 | Not authenticated |
| 400 | Validation failure (Zod) |
| 404 | Member or book not found |
| 400 | Any business rule violation |

### POST /api/books/return

**Request:**
```json
{ "issuanceId": "string" }
```

**Success (200):**
```json
{
  "message": "Book returned successfully",
  "fine": 14,
  "fineMessage": "A fine of ₹14 has been applied for 7 days overdue.",
  "issuance": { "book": {...}, "member": {...}, "returnedAt": "..." }
}
```

---

## 4. Fine Calculation Logic

```typescript
// lib/fine-calculator.ts

const FINE_RATE_PER_DAY = 2; // ₹2 per day
const LOAN_PERIOD_DAYS = 14;

function calculateFine(dueDate: Date, returnDate: Date): number {
  // Normalize to midnight for fair day-level comparison
  const due = midnight(dueDate);
  const ret = midnight(returnDate);
  
  const diffDays = Math.floor((ret - due) / 86_400_000);
  return diffDays > 0 ? diffDays * FINE_RATE_PER_DAY : 0;
}
```

**Examples:**
- Returned same day as due: fine = ₹0
- Returned 1 day late: fine = ₹2
- Returned 7 days late: fine = ₹14
- Returned early: fine = ₹0

---

## 5. Error Handling Strategy

All API routes follow this pattern:

1. **Auth check first** — fail fast with 401 before touching DB
2. **Parse + validate body** — catch invalid JSON (400), then Zod parse (400)
3. **Entity existence** — 404 if member/book/issuance not found
4. **Business rules** — 400 with descriptive error messages for UX
5. **Happy path** — atomic DB transaction for data integrity

No unhandled exceptions reach the client. All errors are caught and
returned as structured JSON `{ error: "..." }`.

---

## 6. Atomic Transactions

Both issue and return use `prisma.$transaction` to ensure consistency:

**Issue transaction:**
```
1. issuance.create(...)
2. book.update({ available: { decrement: 1 } })
```

If either fails, both roll back — no ghost issuances, no wrong counts.

**Return transaction:**
```
1. issuance.update({ status: RETURNED, returnedAt, fine })
2. book.update({ available: { increment: 1 } })
```
