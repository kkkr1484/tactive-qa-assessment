# User Guide — LibraryOS

Welcome to LibraryOS! This guide explains how to use the Library Management
System to issue books to members and process returns.

---

## Getting Started

### Logging In

1. Open your web browser and go to: `http://localhost:3000`
2. You will see the **LibraryOS login page**.
3. Enter your librarian credentials:
   - **Email:** `admin@library.com`
   - **Password:** `librarian123`
4. Click **Sign In**.
5. You will be taken to the **Dashboard**.

---

## The Dashboard

The dashboard has two areas:

- **Left sidebar** — navigation menu
- **Right area** — the current page content

Use the sidebar to switch between sections:

| Menu Item | What it does |
|-----------|-------------|
| 📊 Overview | Shows statistics and recent activity |
| 📤 Issue Book | Issue a book to a member |
| 📥 Return Book | Process a book return |
| 📖 Books | Browse all books and their availability |
| 👥 Members | Browse all members |

---

## Overview Page

The Overview shows at a glance:
- **Total Books** — how many book titles are in the library
- **Available Copies** — how many copies can be borrowed right now
- **Total Members** — number of registered members
- **Active Issuances** — how many books are currently out on loan
- **Overdue Books** _(shown in amber)_ — books not yet returned past their due date

Below the stats, you can see the **10 most recent issuances** — each showing
the book title, member name, issue date, due date, and current status.

---

## Issuing a Book

> **What this does:** Gives a member permission to take a book home for 14 days.

1. Click **📤 Issue Book** in the left sidebar.
2. Use the **Select Member** dropdown to choose the member.
   _(You can scroll through the list.)_
3. Use the **Select Book** dropdown to choose which book to issue.
   _(Only books with at least 1 available copy will appear.)_
4. Click **Issue Book**.

### What happens next
- A green message appears confirming the issuance and showing the **due date**.
- The book's available count goes down by 1.
- The member can now pick up the book.

### Why it might fail
| Message | Meaning |
|---------|---------|
| "Member membership has expired" | The member needs to renew before borrowing |
| "No copies available" | All copies are out — try the Return desk |
| "Member has reached their maximum book limit of 3" | The member must return a book first |
| "Member already has this book issued" | The member already has this title |

---

## Returning a Book

> **What this does:** Records that a member has brought a book back, and calculates any overdue fine.

1. Click **📥 Return Book** in the left sidebar.
2. Use the **Select Member** dropdown to choose the member.
3. Wait a moment — the system loads their currently borrowed books.
4. Use the **Select Book to Return** dropdown to choose which book they're returning.
   - If you see ⚠️ OVERDUE next to the title, a fine will be applied.
5. Click **Process Return**.

### What happens next
- A green message confirms the return.
- The fine amount is displayed (₹0 if returned on time).
- The book becomes available for other members to borrow.

### Fine Calculation
Fines are charged at **₹2 per day** for each day after the due date.

| Days Late | Fine |
|-----------|------|
| 0 days | ₹0 |
| 1 day | ₹2 |
| 7 days | ₹14 |
| 14 days | ₹28 |

---

## Viewing Books

Click **📖 Books** to see the full book catalog.

The table shows:
- **Title** and **Author**
- **ISBN** — the unique book identifier
- **Total** — total copies owned by the library
- **Available** — copies available to borrow right now
- **Status** — green "Available" or red "Unavailable"

---

## Viewing Members

Click **👥 Members** to see all registered library members.

The table shows:
- **Name** and **Email**
- **Membership Expiry** — the date their membership runs out
- **Max Books** — how many books they can borrow at once
- **Status** — Active, Inactive, or Expired

---

## Signing Out

Click **Sign Out** at the bottom of the left sidebar to log out safely.

---

## Quick Reference

| Task | Steps |
|------|-------|
| Issue a book | Sidebar → Issue Book → select member → select book → Issue Book |
| Return a book | Sidebar → Return Book → select member → select book → Process Return |
| Check availability | Sidebar → Books → look at Available column |
| Check a member's status | Sidebar → Members → look at Status column |
| Sign out | Sidebar → Sign Out (bottom left) |

---

*For technical issues, contact your system administrator.*
