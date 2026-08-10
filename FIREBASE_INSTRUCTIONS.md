Firebase Integration for Expense Tracker

What I added
- Created a new branch `firebase/integration` with the following files:
  - income/expense-tracker.html  - updated static HTML + Firebase Auth & Firestore integration (CDN-based, no build step)
  - firestore.rules              - Firestore security rules to allow users to access only their own entries

How it works
- Authentication: Email/Password via Firebase Authentication.
- Database: Firestore, per-user collection at `/users/{uid}/entries/{entryDoc}`. Each entry document has fields: type, amount, category, date, note, createdAt.
- The HTML uses Firebase "compat" CDN scripts so it runs on GitHub Pages without bundling.

Next steps you must do in Firebase Console
1. Confirm/Create Firebase Project
   - I used the firebaseConfig values provided earlier in the HTML. If you want a different project, get its config and replace the firebaseConfig object in `income/expense-tracker.html`.
2. Enable Authentication (Email/Password)
   - Console -> Authentication -> Get started -> Sign-in method -> Enable Email/Password.
3. Create Firestore database
   - Console -> Firestore Database -> Create database. Start in "Production mode" and then paste rules from `firestore.rules` into the Rules tab (or start in Test mode during development).
4. Email templates (optional)
   - Console -> Authentication -> Templates to customize password reset email.

Deploying
- Merge `firebase/integration` into your default branch (eg. `main`) and GitHub Pages will serve the updated `income/expense-tracker.html` if your Pages site serves from the branch and path where this file resides.

Security & Costs
- apiKey and other config values are public in frontend code; protect data via Firestore security rules (already provided).
- Spark (free) tier is fine for small personal usage; monitor usage to avoid paywalls.

If you want me to:
- Update an existing expense-tracker.html content instead of creating a new one, provide the current file path and I'll modify preserving styling.
- Open a Pull Request and include reviewers, I can create the PR on branch `firebase/integration` (already created).
