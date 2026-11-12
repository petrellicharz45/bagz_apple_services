# Admin Panel Design (SvelteKit + Firebase)

## Goals

- Deliver a separate web admin dashboard for Luxiva.
- Support product and order management with audit trails.
- Enforce admin-only access via Firebase custom claims.
- Keep privileged operations in Cloud Functions.

## Non-goals

- Rebuild customer-facing Android features.
- Directly call payment providers from the dashboard.
- Implement stock/SKU management in v1.

## Architecture

- Frontend: SvelteKit app in a new `admin/` folder, deployed to Firebase Hosting.
- Auth: Firebase Auth email/password sign-in.
- Backend: Firebase Cloud Functions for all privileged writes.
- Data: Firestore as source of truth.
- Security: `admin: true` custom claim enforced in Functions and dashboard routing.

## Feature Scope (v1)

### Products

- Create/edit product
- Archive/unarchive product
- Manage images (upload/delete/reorder)
- Set `special` flag
- Manage price, offer percentage, category
- Validate `nameLowercase`

### Orders

- View all orders
- Filter by order status and payment status
- Update fulfillment status only
- Read-only payment fields

### Notifications

- Manual promotional notification via Cloud Function

### Admin Management

- Super-admin UI to grant/revoke admin claims
- Bootstrap first super-admin manually via CLI/script

## Routing

- `/login`
- `/products`
- `/products/new`
- `/products/[id]`
- `/orders`
- `/orders/[id]`
- `/admin`

## Data Model Notes

- Products use existing fields from `Product` model plus audit fields:
  - `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy`
- Orders use existing fields from `Order` model.
  - `orderStatus` is admin-writable.
  - `paymentStatus`, `providerReference`, `amountPaid` are read-only in admin UI.

## Cloud Functions (proposed)

- `adminSetClaim(uid, isAdmin)`
- `adminUpsertProduct(product, images)`
- `adminArchiveProduct(productId, archived)`
- `adminDeleteProductImage(productId, imagePath)`
- `adminUpdateOrderStatus(orderId, status)`
- `adminSendPromoNotification(title, body, topic?)`

All functions validate `admin: true` custom claim and apply audit fields.

## Security

- Admin dashboard rejects non-admin users.
- Firestore rules rely on custom claims as per `docs/PRODUCTION_SETUP.md`.
- No secrets or FCM keys in the dashboard; use Functions for privileged work.

## Error Handling

- Functions return standard Firebase error codes.
- UI maps to friendly messages and retry guidance.

## Testing & Verification

- Unit tests for claim setting and order status updates.
- Manual flows: login, create/edit product, update order status, admin grant.
- Verify non-admin is blocked from dashboard and protected writes.
