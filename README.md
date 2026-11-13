# FolioDay

Mobile-first personal planner combining a **To-Do Calendar**, **Daily Expense & Income Tracker** (with streaks and Weekly/Monthly/Yearly reports), and **Auto-Saving Diary Books**, synced to Firebase Authentication (Google Sign-In) and Cloud Firestore.

## Included in This Package

- `src/` — React 19 + TypeScript + Tailwind CSS v4 source code and bundled diary cover assets
- `firebase-applet-config.json` — Firebase project configuration (`folioday-20a10`, Firestore DB `ai-studio-1d1b22ae-b618-4372-87cf-14642cdcb2a5`)
- `firestore.rules` — Owner-verified Firestore security rules
- `firebase.json` & `.firebaserc` — Ready-to-use Firebase CLI config for Hosting & Firestore rules
- `.github/workflows/deploy-pages.yml` — Automated GitHub Actions workflow for GitHub Pages (`*.github.io`)

## Run Locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build for Production

```bash
npm run lint
npm run build
```

The production bundle is output to `dist/`.

## Publish to GitHub Pages (`*.github.io`)

1. Create a GitHub repository and push this folder to `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial FolioDay release"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Wait for the **Deploy FolioDay to GitHub Pages** workflow in **Actions** to finish.
4. In **Firebase Console → `folioday-20a10` → Authentication → Settings → Authorized domains**, add:
   - `<your-username>.github.io`

## Publish to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy --only hosting
```

To deploy updated Firestore rules from this package:

```bash
firebase deploy --only firestore:rules
```
