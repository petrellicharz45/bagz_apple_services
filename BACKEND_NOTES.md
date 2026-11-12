# Backend Developer Notes

## Technical Developer Note for Your Backend
These requirements have been noted for the backend implementation of the Luxiva app.

### 1. Location-Based Inspection Logic
- **Requirement:** Set up a conditional window in the database. If the delivery address is flagged as "Up-Country," allow the user to open a "Report Issue" ticket for exactly 12 hours after the transit status is marked as delivered.
- **Implementation Strategy:** A Cloud Function triggered by a delivery status update to "Delivered" will check the user's `address.city` or similar up-country flag. If true, it will write a `ticketWindowEnd` timestamp to the order document (current time + 12 hours). The app (and Firestore rules) will only allow a ticket to be created referencing this order if `Firestore.Timestamp.now() < ticketWindowEnd`. 

### 2. Media Upload Feature
- **Requirement:** Ensure the in-app support chat or ticket system allows up-country users to upload clear images and videos of the damaged items for verification.
- **Implementation Strategy:** `storage.rules` has been pre-configured to allow users to upload images (`image/*`) and videos (`video/*`) to the `/tickets/{ticketId}/{mediaId}` storage path. The frontend will need to use an image/video picker and upload these to Firebase Storage, attaching the resulting URLs to the Support Ticket document.

---

*Note: Initial security rules for `/tickets` have been added to `firestore.rules` and `storage.rules` to lay the groundwork for these features.*
