import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  serverTimestamp, setDoc, updateDoc, writeBatch
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'team-task-board-a1fb3',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  storage: { rules: readFileSync('storage.rules', 'utf8') }
});

const ownerAContext = env.authenticatedContext('owner-a', { email: 'owner-a@example.com', email_verified: true });
const ownerBContext = env.authenticatedContext('owner-b', { email: 'owner-b@example.com', email_verified: true });
const memberContext = env.authenticatedContext('member-a', { email: 'member@example.com', email_verified: true });
const outsiderContext = env.authenticatedContext('outsider', { email: 'outsider@example.com', email_verified: true });
const unverifiedContext = env.authenticatedContext('unverified', { email: 'unverified@example.com', email_verified: false });
const ownerA = ownerAContext.firestore();
const ownerB = ownerBContext.firestore();
const member = memberContext.firestore();
const outsider = outsiderContext.firestore();
const unverified = unverifiedContext.firestore();
const board = (db, boardId) => doc(db, 'boards', boardId);
const memberDoc = (db, boardId, uid) => doc(db, 'boards', boardId, 'members', uid);
const invitation = (db, email, boardId) => doc(db, 'board_invites', email, 'boards', boardId);
const localInvite = (db, boardId, email) => doc(db, 'boards', boardId, 'invites', email);
const slot = (db, boardId, slotId) => doc(db, 'boards', boardId, 'slots', slotId);
const task = (db, boardId) => doc(db, 'boards', boardId, 'tasks', 'task-a');
const notes = (db, boardId) => collection(db, 'boards', boardId, 'tasks', 'task-a', 'notes');
const grantInvite = (email, slotId) => {
  const batch = writeBatch(ownerA);
  batch.set(slot(ownerA, 'owner-a', slotId), { email, addedAt: serverTimestamp() });
  batch.set(localInvite(ownerA, 'owner-a', email), { email, slotId, addedAt: serverTimestamp() });
  batch.set(invitation(ownerA, email, 'owner-a'), {
    boardId: 'owner-a', ownerEmail: 'owner-a@example.com', slotId, addedAt: serverTimestamp()
  });
  return batch.commit();
};

try {
  await assertSucceeds(setDoc(board(ownerA, 'owner-a'), {
    ownerUid: 'owner-a', ownerEmail: 'owner-a@example.com', createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(memberDoc(ownerA, 'owner-a', 'owner-a'), {
    email: 'owner-a@example.com', name: 'Owner A', role: 'admin', joined: serverTimestamp()
  }));
  await assertSucceeds(setDoc(board(ownerB, 'owner-b'), {
    ownerUid: 'owner-b', ownerEmail: 'owner-b@example.com', createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(memberDoc(ownerB, 'owner-b', 'owner-b'), {
    email: 'owner-b@example.com', name: 'Owner B', role: 'admin', joined: serverTimestamp()
  }));
  await assertFails(setDoc(board(outsider, 'owner-a'), {
    ownerUid: 'outsider', ownerEmail: 'outsider@example.com', createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(board(unverified, 'unverified'), {
    ownerUid: 'unverified', ownerEmail: 'unverified@example.com', createdAt: serverTimestamp()
  }));

  await assertSucceeds(grantInvite('member@example.com', '1'));
  await assertSucceeds(grantInvite('second@example.com', '2'));
  await assertSucceeds(grantInvite('third@example.com', '3'));
  await assertSucceeds(grantInvite('fourth@example.com', '4'));
  await assertFails(grantInvite('fifth@example.com', '5'));
  await assertFails(grantInvite('fifth@example.com', '4'));
  await assertFails(setDoc(invitation(ownerA, 'fifth@example.com', 'owner-a'), {
    boardId: 'owner-a', ownerEmail: 'owner-a@example.com', slotId: '4', addedAt: serverTimestamp()
  }));
  await assertFails(deleteDoc(slot(ownerA, 'owner-a', '1')));
  await assertSucceeds(getDoc(invitation(member, 'member@example.com', 'owner-a')));
  await assertFails(getDoc(invitation(outsider, 'member@example.com', 'owner-a')));
  await assertFails(setDoc(memberDoc(outsider, 'owner-a', 'outsider'), {
    email: 'outsider@example.com', name: 'Outsider', role: 'member', joined: serverTimestamp()
  }));
  await assertSucceeds(setDoc(memberDoc(member, 'owner-a', 'member-a'), {
    email: 'member@example.com', name: 'Member', role: 'member', joined: serverTimestamp()
  }));
  await assertFails(updateDoc(memberDoc(member, 'owner-a', 'member-a'), { role: 'admin' }));

  await assertSucceeds(setDoc(board(member, 'member-a'), {
    ownerUid: 'member-a', ownerEmail: 'member@example.com', createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(memberDoc(member, 'member-a', 'member-a'), {
    email: 'member@example.com', name: 'Member', role: 'admin', joined: serverTimestamp()
  }));
  await assertFails(getDoc(board(ownerB, 'owner-a')));

  await assertSucceeds(setDoc(task(ownerA, 'owner-a'), {
    title: 'Call people', description: '', salesPitch: '', priority: 'medium',
    assignee: 'member-a', dueDate: '', sheetUrl: '', column: 'todo',
    createdAt: serverTimestamp(), createdBy: 'owner-a', lastUpdated: '', attachments: []
  }));
  await assertSucceeds(getDoc(task(member, 'owner-a')));
  await assertFails(getDoc(task(ownerB, 'owner-a')));
  await assertFails(getDoc(task(outsider, 'owner-a')));
  await assertFails(getDocs(collection(ownerB, 'boards', 'owner-a', 'tasks')));
  await assertFails(getDoc(doc(ownerA, 'tasks', 'legacy-task')));
  await assertSucceeds(updateDoc(task(member, 'owner-a'), { salesPitch: 'Our offer', lastUpdated: 'now' }));
  await assertFails(updateDoc(task(member, 'owner-a'), { assignee: 'owner-b' }));
  await assertFails(updateDoc(task(ownerB, 'owner-a'), { salesPitch: 'Cross-board edit' }));

  const addedNote = await assertSucceeds(addDoc(notes(member, 'owner-a'), {
    body: 'Private contact details', authorUid: 'member-a', createdAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(ownerA, 'boards', 'owner-a', 'tasks', 'task-a', 'notes', addedNote.id)));
  await assertFails(getDoc(doc(ownerB, 'boards', 'owner-a', 'tasks', 'task-a', 'notes', addedNote.id)));
  await assertFails(getDocs(notes(outsider, 'owner-a')));

  const bucket = 'gs://team-task-board-a1fb3.firebasestorage.app';
  const flyerPath = 'boards/owner-a/attachments/task-a/flyer.png';
  const flyer = memberContext.storage(bucket).ref(flyerPath);
  await assertSucceeds(flyer.putString('Flyer'));
  await assertSucceeds(ownerAContext.storage(bucket).ref(flyerPath).getMetadata());
  await assertFails(ownerBContext.storage(bucket).ref(flyerPath).getMetadata());
  await assertFails(outsiderContext.storage(bucket).ref(flyerPath).getMetadata());

  await assertFails(deleteDoc(invitation(ownerA, 'member@example.com', 'owner-a')));
  const revoke = writeBatch(ownerA);
  revoke.delete(invitation(ownerA, 'member@example.com', 'owner-a'));
  revoke.delete(localInvite(ownerA, 'owner-a', 'member@example.com'));
  revoke.delete(slot(ownerA, 'owner-a', '1'));
  revoke.delete(memberDoc(ownerA, 'owner-a', 'member-a'));
  await assertSucceeds(revoke.commit());
  await assertFails(getDoc(task(member, 'owner-a')));
  await assertFails(memberContext.storage(bucket).ref(flyerPath).getMetadata());
  await assertSucceeds(ownerAContext.storage(bucket).ref(flyerPath).delete());
  await assertSucceeds(grantInvite('replacement@example.com', '1'));

  console.log('Five-person limit, board isolation, private notes, and Storage rules passed.');
} finally {
  await env.cleanup();
}
