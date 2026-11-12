# Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a separate SvelteKit admin dashboard with Firebase Hosting and Cloud Functions to manage products, orders, admins, and promo notifications.

**Architecture:** A standalone SvelteKit app lives in `admin/` and uses Firebase Auth for sign-in. Firestore is read via client SDK, but all writes go through callable Cloud Functions that enforce the `admin: true` claim and add audit fields.

**Tech Stack:** SvelteKit, TypeScript, Firebase Auth, Firestore, Firebase Storage, Firebase Cloud Functions (TypeScript), Firebase Hosting.

---

### Task 1: Scaffold SvelteKit admin app

**Files:**
- Create: `admin/` (SvelteKit app scaffold)

**Step 1: Scaffold the app**

Run: `npm create svelte@latest admin`
Choose: Skeleton project, TypeScript, ESLint, Prettier, and no additional libs.

Expected: `admin/` created with SvelteKit starter files.

**Step 2: Install dependencies**

Run: `npm --prefix admin install`
Expected: `admin/node_modules` created without errors.

**Step 3: Commit**

```bash
git add admin
git commit -m "chore: scaffold admin dashboard app"
```

---

### Task 2: Configure SvelteKit for Firebase Hosting SPA

**Files:**
- Modify: `admin/svelte.config.js`
- Create: `admin/src/routes/+layout.ts`

**Step 1: Write the failing test**

Create `admin/src/lib/config/spa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSpaConfigValid } from "./spa";

describe("spa config", () => {
  it("requires ssr and prerender to be disabled", () => {
    expect(isSpaConfigValid({ ssr: true, prerender: true })).toBe(false);
    expect(isSpaConfigValid({ ssr: false, prerender: false })).toBe(true);
  });
});
```

Run: `npm --prefix admin run test -- spa.test.ts`
Expected: FAIL with "isSpaConfigValid is not defined".

**Step 2: Implement minimal config helper**

Create `admin/src/lib/config/spa.ts`:

```ts
export const isSpaConfigValid = (options: { ssr: boolean; prerender: boolean }) => {
  return options.ssr === false && options.prerender === false;
};
```

**Step 3: Disable SSR/prerender**

Create `admin/src/routes/+layout.ts`:

```ts
export const ssr = false;
export const prerender = false;
```

**Step 4: Run test**

Run: `npm --prefix admin run test -- spa.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/src/lib/config/spa.ts admin/src/lib/config/spa.test.ts admin/src/routes/+layout.ts
git commit -m "chore: configure admin as SPA"
```

---

### Task 3: Add Firebase web config and auth helpers

**Files:**
- Create: `admin/.env.example`
- Create: `admin/src/lib/firebase.ts`
- Create: `admin/src/lib/auth/claims.ts`
- Create: `admin/src/lib/auth/claims.test.ts`

**Step 1: Write failing test**

Create `admin/src/lib/auth/claims.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAdminClaim } from "./claims";

describe("isAdminClaim", () => {
  it("returns true only when admin claim is true", () => {
    expect(isAdminClaim({})).toBe(false);
    expect(isAdminClaim({ admin: false })).toBe(false);
    expect(isAdminClaim({ admin: true })).toBe(true);
  });
});
```

Run: `npm --prefix admin run test -- claims.test.ts`
Expected: FAIL with "isAdminClaim is not defined".

**Step 2: Implement claim helper**

Create `admin/src/lib/auth/claims.ts`:

```ts
export const isAdminClaim = (claims: Record<string, unknown>) => {
  return claims.admin === true;
};
```

**Step 3: Add Firebase config module**

Create `admin/src/lib/firebase.ts`:

```ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

**Step 4: Add env example**

Create `admin/.env.example` with PUBLIC_ prefixed keys.

**Step 5: Run test**

Run: `npm --prefix admin run test -- claims.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add admin/.env.example admin/src/lib/firebase.ts admin/src/lib/auth/claims.ts admin/src/lib/auth/claims.test.ts
git commit -m "feat: add firebase config and admin claim helper"
```

---

### Task 4: Auth store, login page, and route guard

**Files:**
- Create: `admin/src/lib/stores/auth.ts`
- Create: `admin/src/routes/login/+page.svelte`
- Modify: `admin/src/routes/+layout.svelte`

**Step 1: Write failing test**

Create `admin/src/lib/stores/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveAdminFlag } from "./auth";

describe("deriveAdminFlag", () => {
  it("maps claims into admin boolean", () => {
    expect(deriveAdminFlag(null)).toBe(false);
    expect(deriveAdminFlag({ admin: true })).toBe(true);
  });
});
```

Run: `npm --prefix admin run test -- auth.test.ts`
Expected: FAIL with "deriveAdminFlag is not defined".

**Step 2: Implement auth store helpers**

Create `admin/src/lib/stores/auth.ts`:

```ts
import { writable } from "svelte/store";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "$lib/firebase";
import { isAdminClaim } from "$lib/auth/claims";

export const userStore = writable<null | { uid: string; email: string | null }>(null);
export const adminStore = writable(false);
export const loadingStore = writable(true);

export const deriveAdminFlag = (claims: Record<string, unknown> | null) => {
  return claims ? isAdminClaim(claims) : false;
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    userStore.set(null);
    adminStore.set(false);
    loadingStore.set(false);
    return;
  }

  const token = await user.getIdTokenResult();
  userStore.set({ uid: user.uid, email: user.email });
  adminStore.set(deriveAdminFlag(token.claims));
  loadingStore.set(false);
});
```

**Step 3: Add login page**

Create `admin/src/routes/login/+page.svelte` with email/password form and Firebase Auth sign-in.

**Step 4: Add route guard**

Modify `admin/src/routes/+layout.svelte` to redirect to `/login` when not authenticated or not admin.

**Step 5: Run test**

Run: `npm --prefix admin run test -- auth.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add admin/src/lib/stores/auth.ts admin/src/lib/stores/auth.test.ts admin/src/routes/login/+page.svelte admin/src/routes/+layout.svelte
git commit -m "feat: add admin auth flow and route guard"
```

---

### Task 5: Initialize Firebase Functions (TypeScript)

**Files:**
- Create: `functions/` (Firebase Functions scaffold)

**Step 1: Scaffold functions**

Run: `firebase init functions`
Choose: TypeScript, install dependencies, Node 20, no ESLint for speed.

Expected: `functions/` directory with `src/index.ts`, `package.json`, `tsconfig.json`.

**Step 2: Commit**

```bash
git add functions
git commit -m "chore: scaffold firebase functions"
```

---

### Task 6: Add validators with tests (Functions)

**Files:**
- Create: `functions/src/validators/product.ts`
- Create: `functions/src/validators/product.test.ts`
- Modify: `functions/package.json`

**Step 1: Write failing test**

Create `functions/src/validators/product.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeProductInput } from "./product";

describe("normalizeProductInput", () => {
  it("lowercases name for nameLowercase", () => {
    const result = normalizeProductInput({ name: "Lux Bag" });
    expect(result.nameLowercase).toBe("lux bag");
  });
});
```

Run: `npm --prefix functions run test -- product.test.ts`
Expected: FAIL with "normalizeProductInput is not defined".

**Step 2: Implement validator**

Create `functions/src/validators/product.ts`:

```ts
export const normalizeProductInput = (input: { name: string }) => {
  return {
    ...input,
    nameLowercase: input.name.toLowerCase(),
  };
};
```

**Step 3: Add test script**

Update `functions/package.json` to include:

```json
"devDependencies": {
  "vitest": "^2.1.0"
},
"scripts": {
  "test": "vitest run"
}
```

**Step 4: Run test**

Run: `npm --prefix functions run test -- product.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/validators/product.ts functions/src/validators/product.test.ts functions/package.json
git commit -m "test: add product validator"
```

---

### Task 7: Admin helpers and callable Functions

**Files:**
- Create: `functions/src/auth/assertAdmin.ts`
- Modify: `functions/src/index.ts`

**Step 1: Write failing test**

Create `functions/src/auth/assertAdmin.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertAdmin } from "./assertAdmin";

describe("assertAdmin", () => {
  it("throws when admin claim missing", () => {
    expect(() => assertAdmin({ auth: { token: {} } })).toThrow();
  });
});
```

Run: `npm --prefix functions run test -- assertAdmin.test.ts`
Expected: FAIL with "assertAdmin is not defined".

**Step 2: Implement helper**

Create `functions/src/auth/assertAdmin.ts`:

```ts
import { HttpsError } from "firebase-functions/v2/https";

export const assertAdmin = (context: { auth?: { token: Record<string, unknown> } }) => {
  const isAdmin = context.auth?.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }
};
```

**Step 3: Implement functions in `functions/src/index.ts`**

Add callable stubs for:

- `adminSetClaim`
- `adminUpsertProduct`
- `adminArchiveProduct`
- `adminDeleteProductImage`
- `adminUpdateOrderStatus`
- `adminSendPromoNotification`

Each should call `assertAdmin` and return a minimal success payload.

**Step 4: Run test**

Run: `npm --prefix functions run test -- assertAdmin.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/auth/assertAdmin.ts functions/src/auth/assertAdmin.test.ts functions/src/index.ts
git commit -m "feat: add admin function helpers"
```

---

### Task 8: Update Firebase config for hosting and functions

**Files:**
- Modify: `firebase.json`

**Step 1: Update config**

Add:

```json
"functions": { "source": "functions" },
"hosting": {
  "public": "admin/build",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "rewrites": [{ "source": "**", "destination": "/index.html" }]
}
```

**Step 2: Commit**

```bash
git add firebase.json
git commit -m "chore: add hosting and functions config"
```

---

### Task 9: Product data module + list page

**Files:**
- Create: `admin/src/lib/data/products.ts`
- Create: `admin/src/routes/products/+page.svelte`

**Step 1: Write failing test**

Create `admin/src/lib/data/products.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapProductForm } from "./products";

describe("mapProductForm", () => {
  it("ensures nameLowercase is set", () => {
    const result = mapProductForm({ name: "Lux Bag" });
    expect(result.nameLowercase).toBe("lux bag");
  });
});
```

Run: `npm --prefix admin run test -- products.test.ts`
Expected: FAIL with "mapProductForm is not defined".

**Step 2: Implement data helper**

Create `admin/src/lib/data/products.ts` with Firestore list query + `mapProductForm`.

**Step 3: Build list page**

Create `admin/src/routes/products/+page.svelte` to list products with filter/search.

**Step 4: Run test**

Run: `npm --prefix admin run test -- products.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add admin/src/lib/data/products.ts admin/src/lib/data/products.test.ts admin/src/routes/products/+page.svelte
git commit -m "feat: add product list page"
```

---

### Task 10: Product create/edit pages

**Files:**
- Create: `admin/src/routes/products/new/+page.svelte`
- Create: `admin/src/routes/products/[id]/+page.svelte`

**Step 1: Implement create page**

Add form fields for name, category, price, offer, images, and special flag.

**Step 2: Implement edit page**

Load product by id, allow updates and archive/unarchive.

**Step 3: Commit**

```bash
git add admin/src/routes/products/new/+page.svelte admin/src/routes/products/[id]/+page.svelte
git commit -m "feat: add product create and edit pages"
```

---

### Task 11: Orders list and detail pages

**Files:**
- Create: `admin/src/lib/data/orders.ts`
- Create: `admin/src/routes/orders/+page.svelte`
- Create: `admin/src/routes/orders/[id]/+page.svelte`

**Step 1: Implement orders data module**

Provide list queries and order fetch by id.

**Step 2: Build orders list page**

Filter by order status and payment status.

**Step 3: Build order detail page**

Show address, phone, payment info (read-only), and update fulfillment status.

**Step 4: Commit**

```bash
git add admin/src/lib/data/orders.ts admin/src/routes/orders/+page.svelte admin/src/routes/orders/[id]/+page.svelte
git commit -m "feat: add orders list and detail pages"
```

---

### Task 12: Admin management page

**Files:**
- Create: `admin/src/routes/admin/+page.svelte`

**Step 1: Implement admin management UI**

Form to grant/revoke admin claim by email or uid using callable function.

**Step 2: Commit**

```bash
git add admin/src/routes/admin/+page.svelte
git commit -m "feat: add admin management page"
```

---

### Task 13: Promo notifications page

**Files:**
- Create: `admin/src/routes/notifications/+page.svelte`

**Step 1: Implement promo notification form**

Call `adminSendPromoNotification` with title/body/topic.

**Step 2: Commit**

```bash
git add admin/src/routes/notifications/+page.svelte
git commit -m "feat: add promo notifications page"
```

---

### Task 14: Update documentation

**Files:**
- Modify: `docs/ADMIN_DASHBOARD.md`

**Step 1: Add SvelteKit + Firebase Hosting details**

Include local dev commands and deployment steps.

**Step 2: Commit**

```bash
git add docs/ADMIN_DASHBOARD.md
git commit -m "docs: document admin dashboard setup"
```

---

### Verification

- Admin app tests: `npm --prefix admin run test`
- Functions tests: `npm --prefix functions run test`
- Build admin: `npm --prefix admin run build`
- (Optional) Emulators: `firebase emulators:start`
