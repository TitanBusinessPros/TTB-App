# Team Task Board

A single-page team task board backed by Firebase Authentication, Cloud Firestore,
Cloud Storage, and Firebase Hosting. The browser app lives in `public/index.html`.

## Access

- Sign in with email and password. Each user must verify their email address.
- `titanbusinesspros@gmail.com` is the initial admin. After signing in, the admin
  can approve additional email addresses from **Team Members**.
- An approved team member may create a task and assign one team member to it.
- The admin or assigned member may add or change that task's Google Sheets link.
  The Sheet's owner still controls who may view or edit it in Google Drive.
- Task notes are stored separately under `tasks/{taskId}/notes`. Only the admin
  and current assignee may read, add, or delete them. Firestore Security Rules
  enforce this; the public task documents do not contain note text.

## Deployment

This repository is configured for Firebase project `team-task-board-a1fb3`.
The project uses the default Firestore database in `nam5` and a Storage bucket
in `US-CENTRAL1`. Enable the **Email/Password** provider in Firebase Authentication
before signing in. No Admin SDK or service-account key is needed for the site.

```sh
firebase deploy --only firestore:rules,storage,hosting --project team-task-board-a1fb3
```

To run the access-control tests locally:

```sh
npm ci
npm run test:rules
```

The npm packages are development dependencies for the Firebase emulator tests;
the published site loads the Firebase Web SDK directly from Google's CDN.
