---
name: Python package bootstrap side effects
description: Unexpected workspace files created when installing Python packages in a repo without a root Python project manifest.
---

When installing Python packages in a repository without a root Python project manifest, inspect the workspace immediately afterward. The package manager may initialize a root project, generate starter files and lockfiles, and modify `.replit`, even when the packages are only needed for tests.

**Why:** A test-only install created an unrelated root Python starter project and changed imported Replit configuration, requiring cleanup before delivery.

**How to apply:** Prefer using dependencies already declared in the project's existing manifest. If a package install is necessary, check `git status` immediately, retain only intentional dependency changes, and restore incidental bootstrap files and configuration before finishing.
