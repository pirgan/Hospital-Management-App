---
description: Generate release notes from git commits and create a GitHub Release
allowed-tools: Bash
argument-hint: <version tag e.g. v1.0.0>
---

1. git tag --sort=-version:refname | head -2   (get current and previous tag)
2. git log <prev>..<current> --oneline --no-merges
3. Categorise commits:
   - feat:  → New Features
   - fix:   → Bug Fixes
   - chore: → Maintenance
   - test:  → Testing
4. gh release create $ARGUMENTS --notes "..." --title "Release $ARGUMENTS"

Output the GitHub Release URL.