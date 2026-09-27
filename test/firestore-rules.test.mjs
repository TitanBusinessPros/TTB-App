import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query,
  serverTimestamp, setDoc, updateDoc, orderBy, Timestamp
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'team-task-board-a1fb3',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  storage: { rules: readFileSync('storage.rules', 'utf8') }
});

const adminContext = env.authenticatedContext('admin', {
  email: 'titanbusinesspros@gmail.com', email_verified: true
});
const assigneeContext = env.authenticatedContext('assignee', {
  email: 'assignee@example.com', email_verified: true
});
const outsiderContext = env.authenticatedContext('outsider', {
  email: 'outsider@example.com', email_verified: true
});
const unapprovedContext = env.authenticatedContext('unapproved', {
  email: 'unapproved@example.com', email_verified: true
});
const admin = adminContext.firestore();
const assignee = assigneeContext.firestore();
const outsider = outsiderContext.firestore();
const unapproved = unapprovedContext.firestore();
const unverifiedAdmin = env.authenticatedContext('fake-admin', {
  email: 'titanbusinesspros@gmail.com', email_verified: false
}).firestore();

const task = db => doc(db, 'tasks', 'task-1');
const note = db => doc(db, 'tasks', 'task-1', 'notes', 'note-1');
const notes = db => collection(db, 'tasks', 'task-1', 'notes');

try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'allowed_emails', 'assignee@example.com'), { addedAt: Timestamp.now() });
    await setDoc(doc(db, 'allowed_emails', 'outsider@example.com'), { addedAt: Timestamp.now() });
    await setDoc(doc(db, 'users', 'admin'), { email: 'titanbusinesspros@gmail.com', name: 'Admin', joined: Timestamp.now() });
    await setDoc(doc(db, 'users', 'assignee'), { email: 'assignee@example.com', name: 'Assignee', joined: Timestamp.now() });
    await setDoc(doc(db, 'users', 'outsider'), { email: 'outsider@example.com', name: 'Outsider', joined: Timestamp.now() });
    await setDoc(task(db), {
      title: 'Call people', description: '', priority: 'medium', assignee: 'assignee',
      dueDate: '', sheetUrl: '', column: 'todo', createdAt: Timestamp.now(),
      createdBy: 'admin', lastUpdated: '', attachments: []
    });
    await setDoc(note(db), { body: 'Private contact details', authorUid: 'assignee', createdAt: Timestamp.now() });
  });

  await assertSucceeds(getDoc(task(outsider)));
  await assertSucceeds(getDoc(note(assignee)));
  await assertSucceeds(getDocs(query(notes(assignee), orderBy('createdAt'))));
  await assertSucceeds(getDoc(note(admin)));
  await assertFails(getDoc(note(outsider)));
  await assertFails(getDocs(query(notes(outsider), orderBy('createdAt'))));
  await assertFails(getDoc(task(unapproved)));
  await assertFails(getDoc(note(unapproved)));
  await assertFails(getDoc(note(unverifiedAdmin)));
  await assertFails(setDoc(doc(unverifiedAdmin, 'allowed_emails', 'unapproved@example.com'), {}));

  await assertSucceeds(updateDoc(task(assignee), {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-id/edit', lastUpdated: 'now'
  }));
  await assertFails(updateDoc(task(outsider), { sheetUrl: 'https://docs.google.com/spreadsheets/d/other/edit' }));
  await assertFails(updateDoc(task(assignee), { assignee: 'outsider' }));
  await assertFails(updateDoc(task(assignee), { notes: ['exposed'] }));
  await assertFails(updateDoc(task(assignee), { sheetUrl: 'javascript:alert(1)' }));

  const bucket = 'gs://team-task-board-a1fb3.firebasestorage.app';
  const uploaded = assigneeContext.storage(bucket).ref('attachments/task-1/test.txt');
  await assertSucceeds(uploaded.putString('Task attachment'));
  await assertSucceeds(outsiderContext.storage(bucket).ref('attachments/task-1/test.txt').getMetadata());
  await assertFails(outsiderContext.storage(bucket).ref('attachments/task-1/blocked.txt').putString('No access'));
  await assertFails(unapprovedContext.storage(bucket).ref('attachments/task-1/test.txt').getMetadata());
  await assertSucceeds(adminContext.storage(bucket).ref('attachments/task-1/test.txt').delete());

  const addedNote = await assertSucceeds(addDoc(notes(assignee), {
    body: 'Called two people', authorUid: 'assignee', createdAt: serverTimestamp()
  }));
  await assertFails(addDoc(notes(outsider), {
    body: 'Not assigned', authorUid: 'outsider', createdAt: serverTimestamp()
  }));
  await assertSucceeds(deleteDoc(doc(admin, 'tasks', 'task-1', 'notes', addedNote.id)));
  await assertFails(deleteDoc(note(outsider)));
  await assertSucceeds(deleteDoc(note(assignee)));

  await assertSucceeds(updateDoc(task(admin), { assignee: 'outsider' }));
  await assertFails(getDocs(query(notes(assignee), orderBy('createdAt'))));
  await assertSucceeds(getDocs(query(notes(outsider), orderBy('createdAt'))));
  assert.equal((await getDoc(task(admin))).data().assignee, 'outsider');

  console.log('Firestore privacy, sheet-link, and Storage rules passed.');
} finally {
  await env.cleanup();
}
