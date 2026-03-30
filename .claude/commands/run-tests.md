---
description: Run the full test suite (unit + integration + E2E) and report results
allowed-tools: Bash
---

Run the full test suite in sequence:

1. cd server && npm test -- --reporter=verbose
2. cd client && npm test -- --run --reporter=verbose
3. npx playwright test --reporter=list

Output:
## Test Results — [timestamp]

| Suite         | Passed | Failed | Skipped | Duration |
|---------------|--------|--------|---------|----------|
| Unit (server) | X      | X      | X       | Xs       |
| Unit (client) | X      | X      | X       | Xs       |
| Integration   | X      | X      | X       | Xs       |
| E2E           | X      | X      | X       | Xs       |

List each failure with file:line and error message.

Final status: PASS or FAIL

Exit with error code 1 if any failures > 0.