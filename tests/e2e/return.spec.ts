import { test, expect, Page } from '@playwright/test';
import { execSync } from 'child_process';

async function loginAsLibrarian(page: Page) {
  await page.goto('/login');
  await page.fill('#email', 'admin@library.com');
  await page.fill('#password', 'librarian123');
  await page.click('#login-submit');
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

test.beforeEach(() => {
  execSync('npx ts-node --project tsconfig.seed.json prisma/seed.ts', {
    stdio: 'pipe',
    cwd: process.cwd(),
    timeout: 30000,
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE: Book Return & Fine Calculation
// ═══════════════════════════════════════════════════════════════════════

test.describe('Book Return & Fine Calculation', () => {

  test('TC-07: Happy path — return a book on time, no fine', async ({ page }) => {
    await loginAsLibrarian(page);

    // Issue a book to Alice first
    await page.click('#nav-issue');
    await page.locator('#issue-member').selectOption({ label: 'Alice Johnson (alice@example.com)' });
    await page.waitForTimeout(300);

    const bookVal = await page.locator('#issue-book option', { hasText: 'Clean Code' }).getAttribute('value');
    expect(bookVal).toBeTruthy();
    await page.selectOption('#issue-book', bookVal!);
    await page.click('#issue-submit');
    await expect(page.locator('#issue-result')).toHaveClass(/success-alert/, { timeout: 10000 });

    // Return it
    await page.click('#nav-return');
    await page.locator('#return-member').selectOption({ label: 'Alice Johnson (alice@example.com)' });
    await page.locator('#return-issuance').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#return-issuance option').nth(1).waitFor({ state: 'attached', timeout: 10000 });
    await page.selectOption('#return-issuance', { index: 1 });
    await page.click('#return-submit');

    const result = page.locator('#return-result');
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveClass(/success-alert/);
    await expect(result).toContainText('returned successfully');
    await expect(result).toContainText('No fine');
  });

  test('TC-08: Edge case — overdue fine calculated correctly for Bob (7 days overdue = ₹14)', async ({ page }) => {
    // Bob has a seeded OVERDUE issuance — 7 days past due = ₹14 fine
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Find Bob via API
    const membersRes = await fetch('http://localhost:3000/api/members?q=bob', {
      headers: { Cookie: cookieStr },
    });
    const members = await membersRes.json();
    const bob = members[0];
    expect(bob).toBeDefined();
    expect(bob.name).toContain('Bob');

    // Get Bob's active issuances
    const memberRes = await fetch(`http://localhost:3000/api/members/${bob.id}`, {
      headers: { Cookie: cookieStr },
    });
    const memberData = await memberRes.json();
    const overdueIssuance = memberData.issuances.find(
      (iss: { status: string }) => iss.status === 'OVERDUE'
    );
    expect(overdueIssuance).toBeDefined();

    // Return the overdue book via API
    const returnRes = await fetch('http://localhost:3000/api/books/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ issuanceId: overdueIssuance.id }),
    });

    expect(returnRes.status).toBe(200);
    const body = await returnRes.json();
    expect(body.fine).toBe(14); // 7 days × ₹2 = ₹14
    expect(body.fineMessage).toContain('₹14');
    expect(body.message).toContain('returned successfully');
  });

  test('TC-09: Edge case — cannot return an already-returned book', async ({ page }) => {
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Issue a book to Alice
    const membersRes = await fetch('http://localhost:3000/api/members?q=alice', {
      headers: { Cookie: cookieStr },
    });
    const members = await membersRes.json();
    const alice = members[0];

    const booksRes = await fetch('http://localhost:3000/api/books', {
      headers: { Cookie: cookieStr },
    });
    const books = await booksRes.json();
    const cleanCode = books.find((b: { title: string; available: number }) => 
      b.title === 'Clean Code' && b.available > 0
    );

    const issueRes = await fetch('http://localhost:3000/api/books/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ memberId: alice.id, bookId: cleanCode.id }),
    });
    expect(issueRes.status).toBe(201);
    const issued = await issueRes.json();
    const issuanceId = issued.issuance.id;

    // First return — should succeed
    const firstReturn = await fetch('http://localhost:3000/api/books/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ issuanceId }),
    });
    expect(firstReturn.status).toBe(200);

    // Second return — must fail with 400
    const secondReturn = await fetch('http://localhost:3000/api/books/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ issuanceId }),
    });
    expect(secondReturn.status).toBe(400);
    const body = await secondReturn.json();
    expect(body.error).toContain('already been returned');
  });

  test('TC-10: Edge case — return with non-existent issuance ID returns 404', async ({ page }) => {
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await fetch('http://localhost:3000/api/books/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ issuanceId: 'completely-nonexistent-id-xyz-123' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('not found');
  });

  test('TC-11: Security — unauthenticated POST to /api/books/return returns 401', async ({ request }) => {
    const response = await request.post('/api/books/return', {
      data: { issuanceId: 'any-id' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('TC-12: Book availability increments after return (full round trip)', async ({ page }) => {
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Get initial Clean Code availability
    const booksRes = await fetch('http://localhost:3000/api/books', {
      headers: { Cookie: cookieStr },
    });
    const books = await booksRes.json();
    const cleanCode = books.find((b: { title: string }) => b.title === 'Clean Code');
    const initialAvailable = cleanCode.available;
    expect(initialAvailable).toBeGreaterThan(0);

    // Get Alice
    const membersRes = await fetch('http://localhost:3000/api/members?q=alice', {
      headers: { Cookie: cookieStr },
    });
    const alice = (await membersRes.json())[0];

    // Issue Clean Code to Alice
    const issueRes = await fetch('http://localhost:3000/api/books/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ memberId: alice.id, bookId: cleanCode.id }),
    });
    expect(issueRes.status).toBe(201);
    const issued = await issueRes.json();

    // Verify available decremented
    const afterIssueRes = await fetch('http://localhost:3000/api/books', {
      headers: { Cookie: cookieStr },
    });
    const booksAfterIssue = await afterIssueRes.json();
    const cleanCodeAfterIssue = booksAfterIssue.find((b: { title: string }) => b.title === 'Clean Code');
    expect(cleanCodeAfterIssue.available).toBe(initialAvailable - 1);

    // Return the book
    const returnRes = await fetch('http://localhost:3000/api/books/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ issuanceId: issued.issuance.id }),
    });
    expect(returnRes.status).toBe(200);

    // Verify available back to initial
    const afterReturnRes = await fetch('http://localhost:3000/api/books', {
      headers: { Cookie: cookieStr },
    });
    const booksAfterReturn = await afterReturnRes.json();
    const cleanCodeAfterReturn = booksAfterReturn.find((b: { title: string }) => b.title === 'Clean Code');
    expect(cleanCodeAfterReturn.available).toBe(initialAvailable);
  });

});
