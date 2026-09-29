# Team Task Board project memory

- This directory is the active app repository. Its GitHub origin is
  `TitanBusinessPros/TTB-App`, and its Firebase project is
  `team-task-board-a1fb3`. The live app is
  `https://team-task-board-a1fb3.web.app`.
- The parent directory is a separate checkout of
  `TitanBusinessPros/Team-Task-Board-2`. Never push code edits to that old
  GitHub repository without the user's explicit permission. Check the current
  directory and `git remote -v` before Git operations.
- `titanbusinesspros@gmail.com` is the sole platform admin for complimentary
  premium grants. Grant management is in **Team Members → One-year premium
  grants** and is restricted by Firebase callable functions to that verified
  account. The admin board has a grant ending 2027-09-28 03:37 UTC.
- Any verified email may create its own board. Each board allows five people
  total, including its admin. Free boards can use tasks, sales pitches, and
  private notes. Premium unlocks document uploads/downloads and Google Sheets
  links. Private notes are readable only by the board admin and task assignee.
- Paid premium uses the $12/year Stripe Payment Link and a separate one-time
  $1/30-day trial Payment Link, both recorded in README.md. The trial checkout
  must originate from the signed-in app so it carries `trial_<boardId>`.
  `stripeWebhook` uses `STRIPE_WEBHOOK_SECRET` in Firebase Secret Manager; no
  Stripe `sk_live` key is required. The secret also exists in `../Pumpkin.txt`
  outside this app repository. Never copy or commit that file or print its
  contents. The owner confirmed that the Stripe destination points to the
  webhook. A real payment and matching Stripe delivery still need checking.
- `public/index.html` is the Firebase Hosting entry point. Keep its copy at
  `index.html` identical. Keep `public/sw.js` and `sw.js` identical and bump
  their cache name when releasing the app. The current cache is
  `ttb-static-v14`.
- The user authorized deploying future requested changes for this app to its
  Firebase project as part of completing the work. This standing preference
  applies only to `TTB-App`; it does not authorize GitHub pushes or changes to
  the parent `Team-Task-Board-2` repository. Deploy only the Firebase targets
  affected by the change and verify the live release.
- The 2026-09-28 Hosting-only mobile layout release keeps status columns side
  by side on narrow screens, but still showed multiple task cards per column.
  The live page and service worker returned HTTP 200 with `ttb-static-v10`.
- The 2026-09-28 Hosting-only follow-up fixes the mobile task viewport: each
  status column shows exactly one card at a time, with vertical scroll snapping
  to the next card. Long cards can scroll internally. A seven-card sample was
  checked in headless Edge: the second card began at the bottom of the task
  viewport, and the task list was vertically scrollable. The live page and
  service worker returned HTTP 200 with `ttb-static-v12`.
- The 2026-09-28 Hosting-only mobile spacing follow-up puts the full-width
  login form first, removes vertical centering on phones, keeps the signed-in
  board picker near the title, and collapses empty status columns. Login,
  empty-board, and seven-task views were checked in Edge at an emulated 390px
  viewport without horizontal overflow. The live page and service worker
  returned HTTP 200 with `ttb-static-v13`.
- The 2026-09-28 Hosting-only v14 follow-up uses content-height task cards on
  mobile with one visible card per column. Vertical touch swipes, wheel input,
  and Previous/Next advance through cards. Mobile body layout no longer
  stretches a short signed-in screen. Headless Edge checks at 390px covered
  login, empty board, and seven tasks; Next, wheel, and touch advanced through
  four cards. Hosting has no-store headers for HTML and the service worker,
  and the new worker activates and refreshes open app windows automatically.
- The 2026-09-28 Current Task release added up to 30 checklist items between
  title and description. Each item has editable text and a completion checkbox
  that crosses it out. Admins create/edit items; admins and assignees can toggle
  completion on task cards and in task details. Hosting and Firestore rules were
  deployed; the local access-rule suite passed, and the live page and service
  worker returned HTTP 200 with `ttb-static-v11`. An authenticated checklist
  save on the live board has not been manually checked.
- The 2026-09-28 Hosting-only release fixed attachment View/Download menus in
  task detail and edit dialogs. Attachment chip clicks there must stop
  propagation; the document click listener closes an open menu. The live page
  and service worker were fetched successfully after deployment, and the local
  access-rule suite passed. A signed-in view/download of an actual file has
  not yet been verified.
- Run `npm run test:rules` for changes to Firestore or Storage access rules.
  Deploy with `firebase deploy --only functions,firestore:rules,storage,hosting
  --project team-task-board-a1fb3` when authorized. A local source snapshot
  is saved as `../TTB-App-current-2026-09-27-trial.zip`; it predates the
  attachment menu fix. The previous snapshot remains at
  `../TTB-App-current-2026-09-27.zip`.
