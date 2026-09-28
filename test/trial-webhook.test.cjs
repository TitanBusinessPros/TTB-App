const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fromFunctions = createRequire(require.resolve('../functions/index.cjs'));
const Stripe = fromFunctions('stripe');
const { initializeApp } = fromFunctions('firebase-admin/app');
const { getFirestore } = fromFunctions('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this test with the Firestore emulator.');
const projectId = 'team-task-board-a1fb3';
const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_local_trial_test';
const db = getFirestore(initializeApp({ projectId }));
const boardId = 'trial-webhook-test';
const board = db.doc(`boards/${boardId}`);
const webhook = `http://127.0.0.1:5001/${projectId}/us-central1/stripeWebhook`;

async function sendCheckout(sessionId, amount, reference, mode = 'payment') {
  const created = Math.floor(Date.now() / 1000);
  const session = {
    id: sessionId,
    mode,
    payment_status: 'paid',
    currency: 'usd',
    amount_subtotal: amount,
    amount_total: amount,
    payment_link: 'plink_local_trial',
    payment_intent: 'pi_local_trial',
    subscription: mode === 'subscription' ? 'sub_local_annual' : null,
    customer_details: { email: 'trial@example.com' },
    client_reference_id: reference,
    created,
  };
  const payload = JSON.stringify({
    id: `evt_${sessionId}`, type: 'checkout.session.completed', livemode: true, created,
    data: { object: session },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await fetch(webhook, {
    method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload,
  });
  assert.equal(response.status, 200, await response.text());
  return created;
}

async function main() {
  await board.set({ ownerUid: boardId, ownerEmail: 'trial@example.com' });
  const reference = `trial_${boardId}`;
  const firstCreated = await sendCheckout('cs_live_local_one', 100, reference);
  const firstUntil = (await board.get()).data().premiumTrialUntil.toMillis();
  assert.equal(firstUntil, (firstCreated + 30 * 86400) * 1000);
  await sendCheckout('cs_live_local_one', 100, reference);
  assert.equal((await board.get()).data().premiumTrialUntil.toMillis(), firstUntil);
  await sendCheckout('cs_live_local_wrong_amount', 99, reference);
  await sendCheckout('cs_live_local_no_marker', 100, boardId);
  assert.equal((await board.get()).data().premiumTrialUntil.toMillis(), firstUntil);
  await sendCheckout('cs_live_local_two', 100, reference);
  assert.equal((await board.get()).data().premiumTrialUntil.toMillis(), firstUntil + 30 * 86400000);
  await sendCheckout('cs_live_local_annual', 1200, boardId, 'subscription');
  const finalBoard = (await board.get()).data();
  assert.equal(finalBoard.premiumActive, true);
  assert.ok(finalBoard.premiumUntil.toMillis() > Date.now());
  console.log('Signed $1 trial, retries, amount checks, expiry, and annual checkout passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
