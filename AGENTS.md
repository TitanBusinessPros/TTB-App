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
  `ttb-static-v8`.
- Run `npm run test:rules` for changes to Firestore or Storage access rules.
  Deploy with `firebase deploy --only functions,firestore:rules,storage,hosting
  --project team-task-board-a1fb3` when authorized. A local source snapshot
  is saved as `../TTB-App-current-2026-09-27-trial.zip`. The previous snapshot
  remains at `../TTB-App-current-2026-09-27.zip`.
