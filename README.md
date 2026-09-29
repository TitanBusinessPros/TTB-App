# Team Task Board

A single-page team task board backed by Firebase Authentication, Cloud Firestore,
Cloud Storage, and Firebase Hosting. The browser app lives in `public/index.html`.

## Current local version

- Live app: `https://team-task-board-a1fb3.web.app`
- GitHub repository for this app: `TitanBusinessPros/TTB-App`
- Firebase project: `team-task-board-a1fb3`
- Local source snapshot: `../TTB-App-current-2026-09-27-trial.zip`. It contains the
  tracked source and project instructions, without dependencies, Firebase
  credentials, or the Stripe webhook secret. It predates the 2026-09-28
  attachment menu, mobile layout, and Current Task checklist releases.
- The verified `titanbusinesspros@gmail.com` board has a complimentary premium
  grant through **2027-09-28 03:37 UTC** (September 27 in Oklahoma).
- The app, premium rules, grant functions, and Storage CORS are live. Emulator
  access-rule tests and a signed $1/annual webhook test passed. A correctly
  signed non-payment probe reached the live webhook. The project owner confirmed
  that the Stripe destination points to this webhook. Delivery from Stripe and
  a real payment have not yet been verified; check the first payment in Stripe
  and the board's premium status before relying on automatic paid activation.
- On 2026-09-28, a Hosting-only release fixed the attachment menu in the task
  detail and edit dialogs. The click that opened the menu had also reached the
  document click handler, which closed it before View or Download could be
  selected. The live page and `sw.js` returned HTTP 200 and contained the fix
  and `ttb-static-v9` after deployment. The local Firestore/Storage access-rule
  suite passed. An authenticated file view/download on the live board still
  needs a manual check.
- On 2026-09-28, a Hosting-only release restored the desktop-style horizontal
  status columns on mobile. Users can swipe between columns and scroll through
  tasks within a column. It still showed several task cards at once. The live
  page and `sw.js` returned HTTP 200 with `ttb-static-v10`.
- On 2026-09-28, the Current Task release added a checklist between Task Title
  and Description. Admins can create, edit, and remove up to 30 items per task;
  the admin and task assignee can check or uncheck items on the board card or
  detail view. Completed items show a line through their text. The local
  Firestore/Storage rule suite passed, Hosting and Firestore rules were deployed,
  and the live page and `sw.js` returned HTTP 200 with `ttb-static-v11`.
  A signed-in checklist save on the live board has not been manually checked.
- On 2026-09-28, a Hosting-only follow-up made each mobile status column show
  one task card at a time. Scroll up or down in the column to move between
  cards; the column no longer grows into a long task list. Long cards scroll
  internally. A seven-card mobile sample was checked in headless Edge, and the
  live page and `sw.js` returned HTTP 200 with `ttb-static-v12`.
- On 2026-09-28, a Hosting-only follow-up moved the mobile login form to the
  top at full width, tightened the signed-in header and board picker, and made
  empty status columns compact. Screen changes reset the page scroll position.
  Login, empty-board, and seven-task views were checked at an emulated 390px
  viewport without horizontal overflow. The live page and `sw.js` returned
  HTTP 200 with `ttb-static-v13`.
- On 2026-09-28, a Hosting-only follow-up removed the fixed mobile task-card
  height and the short-page stretch. A status column now shows one compact task
  card at a time; vertical swipes, a wheel, or Previous/Next move between
  cards. Headless Edge checks at 390px confirmed the login, board picker, and
  seven-task views have no horizontal overflow. Hosting now serves the page
  and service worker with no-store headers, and the v14 service worker updates
  open app windows when a release activates.
- On 2026-09-28, a Hosting-only follow-up removed the remaining mobile gap
  between the task board and footer. A 390px seven-task preview shows the
  footer starting directly below the board. This release uses `ttb-static-v15`.
- On 2026-09-28, a Hosting-only follow-up made all four mobile status columns
  stretch to the same height, like desktop. A 390px seven-task preview measured
  all four columns at 279px. This release uses `ttb-static-v16`.

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
- The one-time $1 option gives the same premium features for 30 days with no
  automatic renewal. The $12 option is a yearly subscription. Both cover the
  board admin and up to four invited people.
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
- Each task can have up to 30 Current Task checklist items. Board admins edit
  item text; the admin and assigned person can mark each item complete or
  incomplete. Completed items are crossed out.

## Install the app

Open the live site on a phone or computer and choose **Install App**. On browsers
that do not show an install prompt, use **Install app** or **Add to Home Screen**
from the browser menu. The icon and favicon come from `favicon.zip` in the local
workspace. An internet connection is required to load and sync board data.
When a new version is ready, the service worker activates it and refreshes open
app windows. Increment `CACHE_NAME` in both copies of `sw.js` with each app
release so open tabs can detect the new version.

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
`CACHE_NAME` for every app release. The current cache is `ttb-static-v16`.
The `gcf-artifacts` repository in `us-central1` has a seven-day cleanup policy.

## Stripe premium setup

Premium has two checkout options for a board with up to five people total:

- **Try premium:** one-time $1 USD payment for 30 days of all premium features,
  with no automatic renewal. Link:
  `https://buy.stripe.com/4gMfZi8Jz9EA0DodbF7AI11`.
- **Premium for the year:** $12 USD billed yearly ($1 per month equivalent).
  Link: `https://buy.stripe.com/bJe14o8Jz5ok85Q0oT7AI10`.

The app opens either Payment Link with a `client_reference_id` for the signed-in
admin's board. Trial checkouts use `trial_<boardId>` and must be started from
the signed-in app; opening the bare $1 link directly cannot identify the board.
Stripe returns the reference in the completed Checkout Session. The webhook
also checks the paid amount and the checkout email against the verified board
owner. A recorded trial checkout cannot extend access twice if Stripe retries
the event. A separate paid $1 checkout adds another 30 days. For the annual
link, the webhook can also match a bare-link purchase by an existing, verified
board admin's checkout email. Customers must use their board login email.

1. Verify in Stripe that the $1 link is a one-time $1 USD payment and the $12
   link is a yearly recurring subscription without a trial. The public Stripe
   checkout page does not expose those account-side settings.
2. Create a Stripe webhook endpoint at
   `https://us-central1-team-task-board-a1fb3.cloudfunctions.net/stripeWebhook`.
   Select `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.updated`, and `customer.subscription.deleted`.
   Add `checkout.session.async_payment_succeeded` if either Payment Link offers
   delayed payment methods; it handles those payments after they succeed.
   Stripe uses invoice records behind the scenes for automatic yearly renewal;
   this does not require emailing an invoice to the customer. Configure the
   Payment Link to accept cards only if you do not want delayed methods. Note
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

The premium app, functions, and rules are deployed. Stripe must send the core
events above to the webhook URL for payments and renewals to unlock a board. A
newly created Stripe webhook destination has its own signing secret; update
`STRIPE_WEBHOOK_SECRET` if that secret differs from the one already stored.

To run the access-control tests locally:

```sh
npm ci
npm run test:rules
```

On Windows, run `powershell -ExecutionPolicy Bypass -File
test/run-trial-webhook.ps1` to exercise the signed $1 webhook, retries, and
annual checkout in local emulators. The runner temporarily writes a fake
signing secret and removes it afterward; it does not make a real purchase.

The npm packages are development dependencies for the Firebase emulator tests;
the published site loads the Firebase Web SDK directly from Google's CDN.
