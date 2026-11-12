# Admin Dashboard

The Luxiva admin dashboard is built as a single-page application (SPA) using SvelteKit. It is hosted on Firebase Hosting, with data and sensitive operations enforced by Firebase Cloud Functions.

## Architecture

- **Frontend:** SvelteKit (SPA mode, `ssr: false`), TypeScript.
- **Backend:** Firebase Cloud Functions (TypeScript).
- **Database:** Firestore (read directly via client SDK, write via Callable Functions).
- **Authentication:** Firebase Auth (Email/Password). Access is restricted to users with the `admin: true` custom claim.

## Setup & Development

### 1. Environment Variables

Create `.env` in the `admin/` directory (use `admin/.env.example` as a template):

```env
PUBLIC_FIREBASE_API_KEY="..."
PUBLIC_FIREBASE_AUTH_DOMAIN="..."
PUBLIC_FIREBASE_PROJECT_ID="..."
PUBLIC_FIREBASE_STORAGE_BUCKET="..."
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
PUBLIC_FIREBASE_APP_ID="..."
```

### 2. Local Development

Run the frontend app locally:

```bash
cd admin
bun install
bun run dev
```

Run Cloud Functions locally (optional, requires Firebase CLI):

```bash
cd functions
bun install
bun run serve
```

Run tests:

```bash
# Admin tests
cd admin
bun run test

# Functions tests
cd functions
bun run test
```

## Deployment

Build the SvelteKit SPA and deploy everything to Firebase:

```bash
# Build the admin frontend
cd admin
bun run build

# Deploy Hosting, Functions, Firestore rules
cd ..
firebase deploy
```
