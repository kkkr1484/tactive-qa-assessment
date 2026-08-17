# 5-Minute Video Presentation Script

Use this script to record your 5-minute Loom/OBS video for Deliverable 6.

---

## Part 1: Problem, Approach & Architecture (2 Minutes)

### Minute 0:00 – 0:45: Context & Problem Overview
> "Hello! Today I'm presenting **LibraryOS**, built for the Tactive AI-Powered QA Automation & Engineering Assessment.
> Rather than building multiple shallow features, I chose the Library Book Issuance & Return domain to focus on deep, testable business rules:
> - Strict 3-book concurrent quotas per member
> - Membership expiry and account deactivation checks
> - Real-time inventory tracking with ACID atomic transactions
> - Automated overdue fine calculation at ₹2 per day"

### Minute 0:45 – 1:30: Technical Architecture & Security
> "For our technology stack:
> - **Full-stack Next.js 16** (App Router + TypeScript) for a unified developer and deployment experience
> - **Prisma v7 ORM** with SQLite and the `better-sqlite3` driver adapter — providing zero-setup portability for assessors to run immediately from the README
> - **Security:** Session authentication with NextAuth.js guarding all API route handlers (returning 401 on unauthorized access), Zod runtime schema validation, and parameterized SQL queries to prevent injection"

### Minute 1:30 – 2:00: Testing & AI Orchestration Strategy
> "In Stage 2, I engineered 12 end-to-end Playwright tests with automatic DB re-seeding to ensure idempotent execution.
> We also verified a deliberate 'Red Run' where an injected boundary bug in the availability check was caught by TC-02.
> For Stage 3, we built an automated AI Change Loop script that directs an LLM to implement new features, runs the test suite, feeds failure JSON back into the prompt, and iterates until 100% test passage is restored."

---

## Part 2: Live Demo (3 Minutes)

### Minute 2:00 – 2:45: App Walkthrough (Live Screen)
1. **Show Login:** Navigate to `http://localhost:3000/login` → Log in with `admin@library.com` / `librarian123`.
2. **Dashboard Overview:** Highlight the animated metrics (Total Books, Available Copies, Active Issuances, Overdue Alerts).
3. **Issue Flow:** Go to **Issue Book** tab → select Alice Johnson → select *Clean Code* → click **Issue Book** → show immediate success message with 14-day loan calculation and updated inventory.
4. **Return Flow & Overdue Fine:** Go to **Return Book** tab → select Bob Smith → notice the *⚠️ OVERDUE* indicator on his book (due 7 days ago) → click **Process Return** → show calculated ₹14 fine.

### Minute 2:45 – 3:45: Test Suite & Deliberate Red Run
1. Switch to terminal: run `npm test` → show all 12 tests passing green in ~1.3m.
2. Run `node scripts/break-and-test.js` → point out how the script injects a bug, Playwright catches it (Red Run), and restores the clean code.

### Minute 3:45 – 4:45: AI Change Loop Demonstration
1. Explain `scripts/ai-loop.sh` and walk through `evidence/loop-log.md`.
2. Show how the AI self-corrected on Attempt 2 when the initial holds queue implementation broke test TC-12.

### Minute 4:45 – 5:00: Closing & Honest Evaluation
> "In conclusion, LibraryOS delivers a robust, secure, and production-tested application that closes the build → test → fix loop end-to-end. Thank you for your time!"
