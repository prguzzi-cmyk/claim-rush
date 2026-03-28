---
name: deploy
description: Deploy Claim Rush to Vercel production and verify the live site
user_invocable: true
---

# /deploy — Deploy to Production

Deploy the Claim Rush landing pages to Vercel and verify.

## Procedure

### Step 1: Build locally
```bash
cd /Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/claim-rush && npm run build
```
If build fails, fix the errors first.

### Step 2: Deploy to Vercel
```bash
cd /Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/claim-rush && npx vercel --prod --yes
```

### Step 3: Verify
```bash
curl -s -o /dev/null -w "%{http_code}" https://www.aciunited.com
curl -s -o /dev/null -w "%{http_code}" https://www.aciunited.com/es
```

### Step 4: Report
```
## Deploy Complete

- **Build**: ✓ (bundle size)
- **Vercel**: ✓ (deployment URL)
- **aciunited.com**: ✓ (status code)
- **aciunited.com/es**: ✓ (status code)
```

### Step 5: Update handoff
Update `.claude/handoff.md` with deployment timestamp.
