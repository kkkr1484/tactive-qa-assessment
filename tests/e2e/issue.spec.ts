import { test, expect, Page } from '@playwright/test';
import { execSync } from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Shared login helper
// ─────────────────────────────────────────────────────────────────────────────
async function loginAsLibrarian(page: Page) {
  await page.goto('/login');
  await page.fill('#email', 'admin@library.com');
  await page.fill('#password', 'librarian123');
  await page.click('#login-submit');
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-seed before each test for clean, predictable state
// ─────────────────────────────────────────────────────────────────────────────
test.beforeEach(() => {
  execSync('npx ts-node --project tsconfig.seed.json prisma/seed.ts', {
    stdio: 'pipe',
    cwd: process.cwd(),
    timeout: 30000,
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE: Book Issuance
// ═══════════════════════════════════════════════════════════════════════

test.describe('Book Issuance', () => {

  test('TC-01: Happy path — issue an available book to an active member', async ({ page }) => {
    await loginAsLibrarian(page);
    await page.click('#nav-issue');

    await page.locator('#issue-member').selectOption({ label: 'Alice Johnson (alice@example.com)' });
    await page.waitForTimeout(300);

    const bookVal = await page.locator('#issue-book option', { hasText: 'Clean Code' }).getAttribute('value');
    expect(bookVal).toBeTruthy();
    await page.selectOption('#issue-book', bookVal!);
    await page.click('#issue-submit');

    const result = page.locator('#issue-result');
    await expect(result).toBeVisible({ timeout: 10000 });
    await expect(result).toHaveClass(/success-alert/);
    await expect(result).toContainText('issued successfully');
  });

  test('TC-02: Edge case — cannot issue a book with 0 available copies (Design Patterns)', async ({ page }) => {
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Get books list to find Design Patterns ID
    const booksRes = await fetch('http://localhost:3000/api/books', {
      headers: { Cookie: cookieStr },
    });
    const books = await booksRes.json();
    const designPatterns = books.find((b: { title: string }) => b.title === 'Design Patterns');
    expect(designPatterns).toBeDefined();
    expect(designPatterns.available).toBe(0);

    // Get a valid member (Alice)
    const membersRes = await fetch('http://localhost:3000/api/members?q=alice', {
      headers: { Cookie: cookieStr },
    });
    const members = await membersRes.json();
    const alice = members[0];

    // Attempt to issue unavailable book
    const issueRes = await fetch('http://localhost:3000/api/books/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ memberId: alice.id, bookId: designPatterns.id }),
    });

    expect(issueRes.status).toBe(400);
    const body = await issueRes.json();
    expect(body.error).toContain('No copies available');
  });

  test('TC-03: Edge case — cannot issue when member is at their 3-book limit (Charlie)', async ({ page }) => {
    await loginAsLibrarian(page);
    await page.click('#nav-issue');

    // Charlie already has 3 books issued (seeded)
    await page.locator('#issue-member').selectOption({ label: 'Charlie Brown (charlie@example.com)' });
    await page.waitForTimeout(300);

    const bookVal = await page.locator('#issue-book option', { hasText: 'Introduction to Algorithms' }).getAttribute('value');
    if (bookVal) {
      await page.selectOption('#issue-book', bookVal);
      await page.click('#issue-submit');

      const result = page.locator('#issue-result');
      await expect(result).toBeVisible({ timeout: 10000 });
      await expect(result).toHaveClass(/error-alert/);
      await expect(result).toContainText('maximum book limit');
    }
  });

  test('TC-04: Edge case — cannot issue to member with expired membership (Diana)', async ({ page }) => {
    await loginAsLibrarian(page);
    await page.click('#nav-issue');

    // Diana has expired membership (seeded)
    await page.locator('#issue-member').selectOption({ label: 'Diana Prince (diana@example.com)' });
    await page.waitForTimeout(300);

    const bookVal = await page.locator('#issue-book option', { hasText: 'Clean Code' }).getAttribute('value');
    if (bookVal) {
      await page.selectOption('#issue-book', bookVal);
      await page.click('#issue-submit');

      const result = page.locator('#issue-result');
      await expect(result).toBeVisible({ timeout: 10000 });
      await expect(result).toHaveClass(/error-alert/);
      await expect(result).toContainText('membership has expired');
    }
  });

  test('TC-05: Security — unauthenticated POST to /api/books/issue returns 401', async ({ request }) => {
    // Direct API call with no session — no cookies
    const response = await request.post('/api/books/issue', {
      data: { memberId: 'any', bookId: 'any' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('TC-06: Validation — empty memberId returns 400 validation error', async ({ page }) => {
    await loginAsLibrarian(page);
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await fetch('http://localhost:3000/api/books/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify({ memberId: '', bookId: '' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Validation');
  });

});
