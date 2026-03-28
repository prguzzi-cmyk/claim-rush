---
name: verify
description: Verify browser state, check console logs, screenshot, and recursively debug until the entire system is clean
user_invocable: true
---

# /verify — Recursive Browser Verification & Debug Loop

You are entering a recursive verify-and-fix loop. Your goal is to keep checking the browser and fixing issues until EVERYTHING is clean — zero errors, zero warnings, fully functional UI.

## Procedure

Run this loop. Do NOT stop until a full pass comes back completely clean.

### Step 1: Inject Console Capture
```bash
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh inject
```

### Step 2: Gather Full Browser State
Run ALL of these in parallel:
```bash
# Screenshot the current page
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh screenshot /tmp/verify_screenshot.png

# Get page URL and title
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh url
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh title

# Get ALL console logs
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh logs

# Get only errors
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh logs error

# Check failed network requests
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh network

# Get any visible error text on page
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh js "document.querySelectorAll('.error,.alert-danger,.toast-error,[class*=error],[class*=Error]').length + ' error elements on page'"
```

Then READ the screenshot:
```
Read /tmp/verify_screenshot.png
```

### Step 3: Analyze & Categorize Issues
Review everything collected and categorize:
- **CRITICAL**: JS errors, unhandled exceptions, failed API calls, broken UI
- **WARNING**: Console warnings, deprecation notices, minor UI issues
- **INFO**: Informational logs (usually ignorable)

If there are ZERO critical issues and ZERO warnings, go to Step 6.

### Step 4: Fix Issues
For each issue found:
1. Identify the source file(s) causing the problem
2. Read the relevant source code
3. Apply the fix using Edit tool
4. Explain what was wrong and what you fixed

### Step 5: Re-verify (LOOP BACK)
After fixes are applied:
1. Wait for any build/compilation to finish (check terminal if Angular is running)
2. Clear the console logs:
```bash
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh clear
```
3. Reload the page if needed:
```bash
/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/.claude/safari.sh js "location.reload()"
```
4. Wait 3 seconds for page to load:
```bash
sleep 3
```
5. **GO BACK TO STEP 1** — full re-verification

### Step 6: Final Report
Only when a FULL pass is completely clean, output a summary:

```
## Verify Complete ✓

**Page**: [url] - [title]
**Status**: ALL CLEAR

### Issues Found & Fixed (this session):
- [list each issue and fix, or "None — system was already clean"]

### Final State:
- Console Errors: 0
- Console Warnings: 0
- Failed Network Requests: 0
- UI Error Elements: 0
```

## Rules
- Do NOT stop the loop early. Keep going until a full clean pass.
- Maximum 10 loop iterations to prevent infinite loops. If still broken after 10, report remaining issues.
- Fix the ROOT CAUSE, not symptoms. Don't suppress errors — fix the underlying code.
- If a fix requires backend changes, note it but continue fixing what you can on the frontend.
- If you encounter the same error twice after a fix attempt, try a different approach.
- Always re-inject console capture after a page reload.
