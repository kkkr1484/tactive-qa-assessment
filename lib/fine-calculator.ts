/**
 * Fine Calculator — Pure business logic
 * Fine rate: ₹2 per day overdue
 */

export const FINE_RATE_PER_DAY = 2; // ₹2 per day

/**
 * Calculate fine for a returned book.
 * Returns 0 if returned on time, positive value if overdue.
 */
export function calculateFine(dueDate: Date, returnDate: Date): number {
  const dueDateMidnight = new Date(dueDate);
  dueDateMidnight.setHours(0, 0, 0, 0);

  const returnDateMidnight = new Date(returnDate);
  returnDateMidnight.setHours(0, 0, 0, 0);

  const diffMs = returnDateMidnight.getTime() - dueDateMidnight.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 0;
  }

  return diffDays * FINE_RATE_PER_DAY;
}

/**
 * Check if a member's membership is still active.
 */
export function isMembershipActive(membershipEnd: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(membershipEnd);
  expiry.setHours(0, 0, 0, 0);
  return expiry >= now;
}

/**
 * Check if a member can borrow more books.
 */
export function canBorrowMore(currentActiveIssuances: number, maxBooks: number): boolean {
  return currentActiveIssuances < maxBooks;
}

/**
 * Standard loan period in days.
 */
export const LOAN_PERIOD_DAYS = 14;

/**
 * Calculate the due date from the issue date.
 */
export function calculateDueDate(issuedAt: Date = new Date()): Date {
  const dueDate = new Date(issuedAt);
  dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
  return dueDate;
}
