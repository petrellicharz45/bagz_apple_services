# Luxiva Production Setup

This project is now prepared to build before Firebase credentials exist. Firebase-specific Gradle plugins are applied only after `app/google-services.json` is added.

## 1. Create Firebase projects

Create separate Firebase projects for:

- Development
- Staging
- Production

Recommended naming example:

- `luxiva-dev`
- `luxiva-staging`
- `luxiva-prod`

## 2. Register the Android app

In each Firebase project:

1. Add Android app package: `com.carthigan.luxiva`
2. Add debug and release SHA-1/SHA-256 certificates.
3. Download `google-services.json`.
4. Place it at `app/google-services.json`.

The file is ignored by git and must not be committed.

## 3. Enable Firebase products

Enable:

- Firebase Authentication
- Email/password auth
- Cloud Firestore
- Firebase Storage
- Firebase Cloud Messaging
- Crashlytics
- Analytics
- App Check

## 4. Deploy rules

After installing Firebase CLI and logging in:

```sh
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Rules are stored in:

- `firebase/firestore.rules`
- `firebase/storage.rules`
- `firebase/firestore.indexes.json`

## 5. Admin roles

Production security expects Firebase custom claims:

- `admin: true`

Set custom claims through a trusted backend/Cloud Function using Firebase Admin SDK. Do not let the Android app or web dashboard grant admin roles directly.

The legacy `admin/{uid}` collection can still exist for display/auditing, but Firestore rules should rely on custom claims.

## 6. App Check

The Android app initializes:

- Debug App Check provider for debug builds
- Play Integrity App Check provider for release builds

Do not enforce App Check in the Firebase Console until:

- Debug tokens are registered for development devices
- Play Integrity is configured
- Release signing SHA certificates are added
- Cloud Functions/admin dashboard are ready

## 7. Notifications

The Android app subscribes authenticated users to the topic:

- `new-products`

Cloud Functions should send product notifications to this topic when a new active product is created.

## 8. Crashlytics/Analytics

Crashlytics is enabled for non-debug builds. Analytics collection is initialized when Firebase is configured.

## 9. Mobile money

Uganda mobile money payments must be initiated and verified from a backend, not from the Android app. See `docs/UGANDA_MOBILE_MONEY.md`.
