---
description: Run tests with coverage and flag files below 80% lines / 75% branches
allowed-tools: Bash
---

1. cd server && npm run test:coverage
2. cd client && npm run test:coverage

Flag any file where: line coverage < 80% OR branch coverage < 75%

Output:
## Coverage Report

| File                                    | Lines | Branches | Status |
|-----------------------------------------|-------|----------|--------|
| src/controllers/authController          | 92%   | 88%      | PASS   |
| src/controllers/aiController            | 65%   | 60%      | FAIL   |

For each FAIL: list the untested functions by name.