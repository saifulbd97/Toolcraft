---
title: Add Firebase Auth + Firestore for expense tracker
assignees: []
labels: ['enhancement']
---

This PR integrates Firebase Authentication (Email/Password) and Firestore as a backend for per-user expense entries.

What I changed:
- income/expense-tracker.html: added Firebase (CDN compat) scripts, Auth UI, Firestore CRUD and realtime listeners
- firestore.rules: Firestore security rules
- FIREBASE_INSTRUCTIONS.md: instructions for Console setup and deployment steps

Testing checklist
- [ ] Open the site from branch `firebase/integration` or merge to main and open `income/expense-tracker.html` on GitHub Pages.
- [ ] Try Sign up with an email & password.
- [ ] Add an entry and verify it appears in the list and Firestore console under `/users/{uid}/entries`.
- [ ] Logout and log back in — entries should load from Firestore.
- [ ] Try password reset link via the "পাসওয়ার্ড ভুলে গেছেন?" flow.

Notes
- The firebaseConfig object in the HTML uses the values you provided earlier. If you prefer to use another Firebase project, replace the firebaseConfig in `income/expense-tracker.html` with the other project's config from Project settings → SDK setup.
- Ensure Firestore rules are published in the console (or use the included firestore.rules content).
