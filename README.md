# Team Task Board

A single-page team task board backed by Firebase Authentication, Cloud Firestore,
Cloud Storage, and Firebase Hosting. The browser app lives in `public/index.html`.

## Current local version

- Live app: `https://team-task-board-a1fb3.web.app`
- GitHub repository for this app: `TitanBusinessPros/TTB-App`
- Firebase project: `team-task-board-a1fb3`
- Local source snapshot: `../TTB-App-current-2026-09-27.zip`. It contains the
  tracked source and project instructions, without dependencies, Firebase
  credentials, or the Stripe webhook secret.
- The verified `titanbusinesspros@gmail.com` board has a complimentary premium
  grant through **2027-09-28 03:37 UTC** (September 27 in Oklahoma).
- The app, premium rules, grant functions, and Storage CORS are live. Emulator
  access-rule tests passed. A correctly signed non-payment webhook probe passed;
  delivery from Stripe and a real payment have not yet been verified. Confirm
  the Stripe webhook destination URL, four selected events, and matching
  signing secret before relying on automatic paid activation.

## Access

- Anyone may sign up with email and password. After verifying their email, they
  get their own board and become its admin.
- Each admin adds people by email from **Team Members**. An invited person must
  sign up or sign in with that verified email. They can choose the admin's board
  from the board picker, while keeping their own separate board.
- Each board has five places total: the admin and up to four invited people.
  Pending invitations reserve a place until the admin removes them. Firestore
  Security Rules enforce the limit with four invitation slots per board.
- Boards, tasks, attachments, and invitations are stored under the board owner's
  user ID. Firestore and Storage rules keep each board separate. Removing an
  invitation revokes that person's board access.
- A paid board unlocks document uploads and downloads and Google Sheets links
  for its admin and invited members. The Sheet's owner still controls view and
  edit permissions in Google Drive.
- The verified `titanbusinesspros@gmail.com` account can open **Team Members**
  and add email addresses to **One-year premium grants**. Each grant unlocks
  premium for that email owner's board and its invited members for one calendar
  year from the grant date, whether the owner has already signed up or signs up
  later. The Titan admin can remove a grant there. Grant management runs in
  authenticated Cloud Functions; browser clients cannot write grant documents
  or board premium status directly. A paid Stripe subscription remains valid
  if a separate complimentary grant is removed.
- Task notes are stored under `boards/{boardId}/tasks/{taskId}/notes` and only
  the board admin and current assignee may read, add, or delete them.
- Each task includes a description and sales pitch. The sign-in page and board
  share the Titan Business Pros contact footer and Facebook link.

## Install the app

Open the live site on a phone or computer and choose **Install App**. On browsers
that do not show an install prompt, use **Install app** or **Add to Home Screen**
from the browser menu. The icon and favicon come from `favicon.zip` in the local
workspace. An internet connection is required to load and sync board data.
When an update is ready, an in-app **Get latest version** button activates it
and reloads the page. Increment `CACHE_NAME` in both copies of `sw.js` with
each app release so open tabs can detect the new version.

## Deployment

This repository is configured for Firebase project `team-task-board-a1fb3`.
The project uses the default Firestore database in `nam5` and a Storage bucket
in `US-CENTRAL1`. Enable the **Email/Password** provider in Firebase Authentication
before signing in. The browser uses the Firebase Web SDK; Cloud Functions use
the Admin SDK with their managed service account. No service-account key file
is needed.
Storage rules read Firestore invitations, so the Firebase Storage service agent
must have the `roles/firebaserules.firestoreServiceAgent` IAM role. This role is
already granted in `team-task-board-a1fb3`.
The same change to the web app belongs in both `public/index.html` and
`index.html`. Keep `public/sw.js` and `sw.js` identical and increment their
`CACHE_NAME` for every app release. The current cache is `ttb-static-v7`.
The `gcf-artifacts` repository in `us-central1` has a seven-day cleanup policy.

## Stripe premium setup

Premium is $12 USD **billed yearly** ($1 per month equivalent) for one board
with up to five people total. The app opens the shared Stripe Payment Link with
a `client_reference_id` for the signed-in admin's board. Stripe returns this ID
in `checkout.session.completed`, allowing the webhook to credit the right board.
When someone opens the bare public link directly, the webhook attempts to match
the checkout email to an already-registered, verified board admin. Customers
must use the same email address they use to sign in to their board.

1. Use the existing annual $12 Payment Link
   `https://buy.stripe.com/bJe14o8Jz5ok85Q0oT7AI10`. Verify in Stripe that
   it is a yearly recurring subscription without a trial.
2. Create a Stripe webhook endpoint at
   `https://us-central1-team-task-board-a1fb3.cloudfunctions.net/stripeWebhook`.
   Select only these events: `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
   Stripe uses invoice records behind the scenes for automatic yearly renewal;
   this does not require emailing an invoice to the customer. Configure the
   Payment Link to accept cards only; delayed payment methods require an extra
   success event. Note
   its `whsec_...` signing secret.
3. The webhook signing secret from `Pumpkin.txt` is already stored in Firebase
   Secret Manager as `STRIPE_WEBHOOK_SECRET`. Verify it belongs to the endpoint
   above. The webhook verifies Stripe's signature and uses event data; no Stripe
   API key is needed. If the signing secret belongs to a different endpoint,
   replace `STRIPE_WEBHOOK_SECRET` with the correct one.
4. Install server dependencies with `npm ci --prefix functions`. The premium
   migration has already been applied to the existing task attachment. For a
   fresh project, run `./scripts/migrate-premium.ps1` as a dry run, then run it
   with `-Apply` before releasing premium rules. The migration moves any old
   Sheet links out of readable task documents, removes old file URLs, and
   revokes their download tokens.
5. Storage CORS has already been applied. For a fresh bucket, apply it using
   `gcloud storage buckets update gs://team-task-board-a1fb3.firebasestorage.app --cors-file=storage-cors.json`.
   Then deploy functions, Firestore rules, Storage rules, and Hosting:

   ```sh
   firebase deploy --only functions,firestore:rules,storage,hosting --project team-task-board-a1fb3
   ```

6. Verify one live $12 Checkout payment (or a Stripe test-mode payment before
   using live keys). The webhook sets premium status on the board document;
   Firestore and Storage rules enforce it for all five members. Stripe retries
   failed webhook deliveries. Keep the webhook endpoint enabled for renewals,
   failed payments, and cancellations.

The premium app, functions, and rules are deployed. Stripe must send the four
events above to the webhook URL for payments to unlock a board. A newly created
Stripe webhook destination has its own signing secret; update
`STRIPE_WEBHOOK_SECRET` if that secret differs from the one already stored.

To run the access-control tests locally:

```sh
npm ci
npm run test:rules
```

The npm packages are development dependencies for the Firebase emulator tests;
the published site loads the Firebase Web SDK directly from Google's CDN.
