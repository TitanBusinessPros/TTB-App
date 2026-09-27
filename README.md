# Team Task Board

A single-page team task board backed by Firebase Authentication, Cloud Firestore,
Cloud Storage, and Firebase Hosting. The browser app lives in `public/index.html`.

## Access

- Anyone may sign up with email and password. After verifying their email, they
  get their own board and become its admin.
- Each admin adds people by email from **Team Members**. An invited person must
  sign up or sign in with that verified email. They can choose the admin's board
  from the board picker, while keeping their own separate board.
- Boards, tasks, attachments, and invitations are stored under the board owner's
  user ID. Firestore and Storage rules keep each board separate. Removing an
  invitation revokes that person's board access.
- An admin or assigned member may add or change a task's Google Sheets link.
  The Sheet's owner controls view and edit permissions in Google Drive.
- Task notes are stored under `boards/{boardId}/tasks/{taskId}/notes` and only
  the board admin and current assignee may read, add, or delete them.

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
