#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ai-loop.sh — Semi-automated AI Change Loop (Stage 3)
#
# This script implements the AI-powered build→test→fix loop:
#   1. Run Playwright tests → capture JSON output
#   2. If tests fail → feed failures + codebase context to AI API
#   3. AI generates a fix (patch or file content)
#   4. Apply the fix → re-run tests
#   5. Repeat until all tests pass (or max attempts reached)
#   6. Log all prompts, responses, diffs to evidence/loop-log.md
#
# Usage:
#   ./scripts/ai-loop.sh
#
# Requirements:
#   - GEMINI_API_KEY or ANTHROPIC_API_KEY env var
#   - jq installed (brew install jq / apt install jq)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MAX_ATTEMPTS=5
LOOP_LOG="evidence/loop-log.md"
TEST_RESULTS="test-results/results.json"
AI_MODEL="gemini-2.0-flash"   # or claude-3-5-sonnet-20241022

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[AI-LOOP]${NC} $1"; }
success() { echo -e "${GREEN}[AI-LOOP ✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[AI-LOOP ⚠]${NC} $1"; }
error() { echo -e "${RED}[AI-LOOP ✗]${NC} $1"; }

# ─── Setup ─────────────────────────────────────────────────────────────────

mkdir -p evidence test-results

# Initialize loop log
cat > "$LOOP_LOG" << 'HEADER'
# AI Change Loop — Evidence Log

**Feature Request:**
> "Add a holds queue — a member can place a hold on a currently unavailable book.
> When the book is returned, the first person in the hold queue should be notified
> and the book reserved for them for 48 hours."

**Strategy:** Semi-automated loop using Gemini API
- Script: `scripts/ai-loop.sh`
- Max attempts: 5
- Test framework: Playwright

---

HEADER

echo "## Loop Execution" >> "$LOOP_LOG"
echo "Started: $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$LOOP_LOG"
echo "" >> "$LOOP_LOG"

# ─── Helper: Run tests and capture output ───────────────────────────────────

run_tests() {
  log "Running Playwright test suite..."
  
  # Run tests, capturing both output and JSON results
  if npx playwright test --reporter=json,list 2>&1 | tee /tmp/test_output.txt; then
    return 0
  else
    return 1
  fi
}

# ─── Helper: Extract test failures from JSON ────────────────────────────────

extract_failures() {
  if [ ! -f "$TEST_RESULTS" ]; then
    echo "No test results JSON found"
    return
  fi
  
  jq -r '
    .suites[] |
    .suites[]? |
    .tests[]? |
    select(.status == "failed") |
    "FAILED: \(.title)\nError: \(.results[0].error.message // "Unknown error")\n"
  ' "$TEST_RESULTS" 2>/dev/null || echo "Could not parse test results"
}

# ─── Helper: Call Gemini API ────────────────────────────────────────────────

call_gemini() {
  local prompt="$1"
  local api_key="${GEMINI_API_KEY:-}"
  
  if [ -z "$api_key" ]; then
    error "GEMINI_API_KEY not set. Please export GEMINI_API_KEY=your_key"
    exit 1
  fi
  
  local response
  response=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${api_key}" \
    -H "Content-Type: application/json" \
    -d "{
      \"contents\": [{
        \"parts\": [{\"text\": $(echo "$prompt" | jq -Rs '.')}]
      }],
      \"generationConfig\": {
        \"temperature\": 0.2,
        \"maxOutputTokens\": 8192
      }
    }")
  
  echo "$response" | jq -r '.candidates[0].content.parts[0].text // "No response generated"'
}

# ─── Helper: Build context for AI ───────────────────────────────────────────

build_context() {
  local test_failures="$1"
  local attempt="$2"
  
  # Gather key files
  local schema_content=""
  local issue_api_content=""
  local return_api_content=""
  
  [ -f "prisma/schema.prisma" ] && schema_content=$(cat prisma/schema.prisma)
  [ -f "app/api/books/issue/route.ts" ] && issue_api_content=$(cat app/api/books/issue/route.ts)
  [ -f "app/api/books/return/route.ts" ] && return_api_content=$(cat app/api/books/return/route.ts)
  
  cat << PROMPT
You are a senior TypeScript/Next.js developer working on a Library Management System.

## Current Task
Implement a "holds queue" feature. A member can place a hold on an unavailable book.
When the book is returned, the first person in the hold queue gets the book reserved for 48 hours.

## Attempt ${attempt} of ${MAX_ATTEMPTS}

## Test Failures (that you must fix):
${test_failures}

## Current Prisma Schema:
\`\`\`prisma
${schema_content}
\`\`\`

## Current Issue API (app/api/books/issue/route.ts):
\`\`\`typescript
${issue_api_content}
\`\`\`

## Current Return API (app/api/books/return/route.ts):
\`\`\`typescript
${return_api_content}
\`\`\`

## Instructions:
1. Analyze the test failures
2. Determine the minimal code changes needed to make all tests pass
3. For each file that needs changes, provide the COMPLETE new file content
4. Format your response as:

=== FILE: path/to/file.ts ===
[complete new file content]
=== END FILE ===

=== FILE: another/file.ts ===
[complete new file content]
=== END FILE ===

Do NOT include any other text outside the FILE blocks.
Focus only on making the failing tests pass without breaking passing ones.
PROMPT
}

# ─── Helper: Apply AI-generated changes ─────────────────────────────────────

apply_changes() {
  local ai_response="$1"
  local changes_applied=0
  
  # Parse FILE blocks from response
  while IFS= read -r line; do
    if [[ "$line" =~ ^=== FILE: (.+) ===$ ]]; then
      local filepath="${BASH_REMATCH[1]}"
      local content=""
      
      # Read until END FILE
      while IFS= read -r content_line; do
        [[ "$content_line" == "=== END FILE ===" ]] && break
        content+="${content_line}"$'\n'
      done
      
      # Create directory if needed
      mkdir -p "$(dirname "$filepath")"
      
      # Save diff before applying
      local diff_output=""
      if [ -f "$filepath" ]; then
        diff_output=$(diff "$filepath" <(echo "$content") 2>/dev/null || true)
        if [ -n "$diff_output" ]; then
          log "Applying changes to: $filepath"
          echo "$content" > "$filepath"
          changes_applied=$((changes_applied + 1))
        fi
      else
        log "Creating new file: $filepath"
        echo "$content" > "$filepath"
        changes_applied=$((changes_applied + 1))
      fi
    fi
  done <<< "$ai_response"
  
  echo "$changes_applied"
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────────────────────────────────────

log "Starting AI Change Loop"
log "Feature: Holds queue for unavailable books"
log "Max attempts: $MAX_ATTEMPTS"
echo ""

# First, re-seed to get clean state
log "Resetting database to clean state..."
npx ts-node --project tsconfig.seed.json prisma/seed.ts

ATTEMPT=0
LOOP_SUCCESS=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  log "━━━ Attempt $ATTEMPT / $MAX_ATTEMPTS ━━━"
  
  echo "" >> "$LOOP_LOG"
  echo "### Attempt $ATTEMPT" >> "$LOOP_LOG"
  echo "**Timestamp:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  # Run tests
  TEST_PASSED=false
  if run_tests; then
    TEST_PASSED=true
  fi
  
  # Capture test output
  TEST_OUTPUT=$(cat /tmp/test_output.txt 2>/dev/null || echo "No output")
  TEST_FAILURES=$(extract_failures)
  
  echo "**Test Status:** $([ "$TEST_PASSED" = true ] && echo '✅ PASSED' || echo '❌ FAILED')" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  if [ "$TEST_PASSED" = true ]; then
    success "All tests passed on attempt $ATTEMPT!"
    echo "**Result:** All tests passed ✅" >> "$LOOP_LOG"
    echo "" >> "$LOOP_LOG"
    echo "---" >> "$LOOP_LOG"
    LOOP_SUCCESS=true
    break
  fi
  
  warn "Tests failed on attempt $ATTEMPT. Calling AI for fix..."
  
  # Log failures
  echo "**Failing Tests:**" >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "$TEST_FAILURES" >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  # Build prompt and call AI
  PROMPT=$(build_context "$TEST_FAILURES" "$ATTEMPT")
  
  echo "**AI Prompt (key excerpt):**" >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "${PROMPT:0:500}..." >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  log "Calling AI API (attempt $ATTEMPT)..."
  AI_RESPONSE=$(call_gemini "$PROMPT")
  
  echo "**AI Response (key excerpt):**" >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "${AI_RESPONSE:0:1000}..." >> "$LOOP_LOG"
  echo "\`\`\`" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  # Apply AI changes
  CHANGES=$(apply_changes "$AI_RESPONSE")
  
  echo "**Changes Applied:** $CHANGES file(s)" >> "$LOOP_LOG"
  echo "" >> "$LOOP_LOG"
  
  if [ "$CHANGES" -eq 0 ]; then
    warn "AI produced no actionable changes on attempt $ATTEMPT"
  else
    log "Applied $CHANGES file change(s). Re-running tests..."
  fi
done

# ─── Final Report ────────────────────────────────────────────────────────────

echo "" >> "$LOOP_LOG"
echo "---" >> "$LOOP_LOG"
echo "## Summary" >> "$LOOP_LOG"
echo "- **Total attempts:** $ATTEMPT" >> "$LOOP_LOG"
echo "- **Outcome:** $([ "$LOOP_SUCCESS" = true ] && echo 'SUCCESS — Loop converged ✅' || echo 'PARTIAL — Max attempts reached ⚠️')" >> "$LOOP_LOG"
echo "- **Ended:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$LOOP_LOG"

if [ "$LOOP_SUCCESS" = true ]; then
  success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  success "Loop converged in $ATTEMPT attempt(s)!"
  success "Evidence logged to: $LOOP_LOG"
  success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  warn "Loop did not fully converge after $MAX_ATTEMPTS attempts."
  warn "Manual intervention may be required."
  warn "Evidence logged to: $LOOP_LOG"
fi
