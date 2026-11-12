# Uganda Mobile Money Production Plan

The client is in Uganda, so production checkout should support at least:

- MTN Mobile Money Uganda
- Airtel Money Uganda

## Recommendation

Use a payment aggregator first, then move to direct telco APIs only if transaction volume justifies it.

Recommended providers to evaluate:

1. Yo! Payments
2. Flutterwave
3. Pesapal
4. DPO / Network International
5. Direct MTN MoMo API
6. Direct Airtel Money API

For fastest local launch, start by evaluating Yo! Payments, Flutterwave, and Pesapal for live Uganda support, settlement terms, mobile money fees, webhook support, and API quality.

## Required architecture

The Android app must not call mobile money provider APIs directly.

Production flow:

1. Android app sends checkout request to Firebase Cloud Function.
2. Cloud Function recalculates the order total from Firestore product prices.
3. Cloud Function creates an order with `paymentStatus = pending_payment`.
4. Cloud Function creates a payment record.
5. Cloud Function calls the mobile money provider API.
6. Provider sends payment prompt to customer phone.
7. Provider sends webhook/IPN callback to Cloud Function.
8. Cloud Function verifies callback and/or verifies transaction with provider API.
9. Cloud Function updates payment/order status.
10. Android app and admin dashboard observe Firestore status changes.

## Order statuses

Suggested order fields:

- `orderStatus`: `Pending`, `Confirmed`, `Shipped`, `Delivered`, `Canceled`, `Returned`
- `paymentStatus`: `pending_payment`, `processing`, `paid`, `failed`, `expired`, `refunded`
- `paymentProvider`: `yo_payments`, `flutterwave`, `pesapal`, `mtn_momo`, `airtel_money`
- `currency`: `UGX`
- `customerPhone`: normalized Uganda phone, e.g. `+2567...`
- `providerReference`
- `paymentId`

## Security rules

Only backend Cloud Functions should mark orders as paid.

The Android app and admin dashboard must not be able to directly set:

- `paymentStatus = paid`
- `providerReference`
- `amountPaid`
- `isPaid`

Admins may update fulfillment/order status, but payment confirmation must come from the provider/backend verification flow.

## What is blocked until credentials exist

Cannot complete live payments until the client provides:

- Chosen provider
- Merchant account
- API keys/client secrets
- Webhook/IPN secret
- Sandbox credentials
- Production callback URL approval
- KYC approval
- Settlement currency/fee confirmation
- Live MTN/Airtel support confirmation

## Backend implementation to add next

Create Cloud Functions for:

- `createMobileMoneyCheckout`
- `paymentWebhook`
- `verifyPaymentStatus`
- `setAdminClaim`
- `notifyNewProduct`
- `notifyOrderStatusChanged`

Use Google Secret Manager or Cloud Functions environment secrets for provider API credentials.
