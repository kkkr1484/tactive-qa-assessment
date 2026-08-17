/**
 * break-and-test.js — Demonstrates the Red Run
 *
 * This script:
 * 1. Introduces a deliberate bug in the issue API (changes <= to <)
 * 2. Runs the Playwright tests (some will fail)
 * 3. Restores the original code
 *
 * Usage: node scripts/break-and-test.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ISSUE_ROUTE = path.join(__dirname, '..', 'app', 'api', 'books', 'issue', 'route.ts');

const ORIGINAL_LINE = '  if (book.available <= 0) {';
const BROKEN_LINE   = '  if (book.available < 0) {  // DELIBERATE BUG: should be <= 0';

console.log('🔴 Starting Deliberate Red Run Demo');
console.log('══════════════════════════════════');

// Step 1: Introduce bug
console.log('\n[Step 1] Introducing deliberate bug in issue route...');
const content = fs.readFileSync(ISSUE_ROUTE, 'utf8');
if (!content.includes(ORIGINAL_LINE)) {
  console.error('ERROR: Could not find the target line. Has the file changed?');
  process.exit(1);
}
const broken = content.replace(ORIGINAL_LINE, BROKEN_LINE);
fs.writeFileSync(ISSUE_ROUTE, broken);
console.log(`  Changed: "${ORIGINAL_LINE.trim()}" → "${BROKEN_LINE.trim()}"`);

// Step 2: Run tests (expect failures)
console.log('\n[Step 2] Running tests against broken code...');
console.log('  (Expect TC-02 to fail: book with 0 available should be rejected)\n');
try {
  execSync('npx playwright test --reporter=json,list', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    timeout: 120000,
  });
  console.log('\n⚠️  All tests passed — the break may not have worked as expected');
} catch (e) {
  console.log('\n✅ Tests failed as expected (red run confirmed)');
}

// Step 3: Restore
console.log('\n[Step 3] Restoring original code...');
const restored = fs.readFileSync(ISSUE_ROUTE, 'utf8').replace(BROKEN_LINE, ORIGINAL_LINE);
fs.writeFileSync(ISSUE_ROUTE, restored);
console.log('  Code restored. Run `npm test` to verify green run.');
