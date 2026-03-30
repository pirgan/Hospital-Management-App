---
description: Run unit tests before deployment; block deploy if any fail
allowed-tools: Bash
---

1. cd server && npm run test:unit -- --run
2. cd client && npm run test:unit -- --run

If ALL pass output:
## Pre-Deploy Check: PASSED
- Server unit tests: X passed
- Client unit tests: X passed
- Proceeding with deployment...

If ANY fail output:
## Pre-Deploy Check: FAILED
- [test name] at [file:line]
- DEPLOYMENT BLOCKED. Fix failing tests before deploying.

Exit with code 1 to halt deployment on failure.