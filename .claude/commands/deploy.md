---
description: Run pre-deploy tests, build, deploy to Vercel production, and create a GitHub Release
allowed-tools: Bash
---

Step 1: cd server && npm run test:unit -- --run
        cd client && npm run test:unit -- --run
        If any fail: DEPLOYMENT BLOCKED — stop here.
Step 2: cd client && npm run build
Step 3: vercel --prod --confirm
Step 4: Capture deployment URL from vercel output
Step 5: TAG=$(git tag --sort=-version:refname | head -1)
        gh release create $TAG --generate-notes

Output:
## Deployment Complete
- URL:     [vercel URL]
- Release: [GitHub Release URL]