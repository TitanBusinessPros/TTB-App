const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const Stripe = require('stripe');

initializeApp();
const db = getFirestore();
const webhookKey = defineSecret('STRIPE_WEBHOOK_SECRET');
const paymentLinkUrl = 'https://buy.stripe.com/bJe14o8Jz5ok85Q0oT7AI10';
const boardDoc = uid => db.collection('boards').doc(uid);
const subscriptionDoc = id => db.collection('stripe_subscriptions').doc(id);
const paidPeriodDoc = id => db.collection('stripe_paid_periods').doc(id);
const acceptedEvents = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
const stripeId = value => typeof value === 'string' ? value : value?.id;
const validBoardId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const matchesAnnualPrice = subscription => subscription.items?.data?.some(item =>
  item.price?.unit_amount === 1200
    && item.price?.currency === 'usd'
    && item.price?.recurring?.interval === 'year'
    && item.price?.recurring?.interval_count === 1);

function nextYear(seconds) {
  const date = new Date(seconds * 1000);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return Timestamp.fromDate(date);
}

exports.createPremiumCheckout = onCall({ region: 'us-central1' }, async request => {
  const user = request.auth;
  if (!user?.uid || !user.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Sign in with a verified email first.');
  }
  const board = await boardDoc(user.uid).get();
  if (!board.exists || board.data().ownerUid !== user.uid) {
    throw new HttpsError('failed-precondition', 'Your board is not ready.');
  }
  if (board.data().premiumActive && board.data().premiumUntil?.toMillis() > Date.now()) {
    throw new HttpsError('already-exists', 'This board already has premium access.');
  }
  return { url: `${paymentLinkUrl}?client_reference_id=${encodeURIComponent(user.uid)}` };
});

async function boardForCheckout(session) {
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return null;
  let boardId = validBoardId(session.client_reference_id) ? session.client_reference_id : null;
  if (boardId) {
    const board = await boardDoc(boardId).get();
    if (board.exists && board.data().ownerUid === boardId && board.data().ownerEmail === email) return boardId;
  }
  // The public link can also be opened directly by an existing board admin.
  try {
    const user = await getAuth().getUserByEmail(email);
    if (!user.emailVerified) return null;
    boardId = user.uid;
    const board = await boardDoc(boardId).get();
    return board.exists && board.data().ownerUid === boardId ? boardId : null;
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function handleCheckout(session, event) {
  if (session.mode !== 'subscription' || session.payment_status !== 'paid'
    || session.currency !== 'usd' || session.amount_subtotal !== 1200
    || !stripeId(session.payment_link) || !stripeId(session.subscription)) return;
  const boardId = await boardForCheckout(session);
  if (!boardId) {
    console.warn('Paid checkout has no verified matching board', event.id);
    return;
  }
  const subId = stripeId(session.subscription);
  const board = boardDoc(boardId);
  const mapping = subscriptionDoc(subId);
  const paidPeriod = paidPeriodDoc(subId);
  await db.runTransaction(async tx => {
    const [boardSnap, mapSnap, paidSnap] = await Promise.all([tx.get(board), tx.get(mapping), tx.get(paidPeriod)]);
    if (!boardSnap.exists || boardSnap.data().ownerUid !== boardId) return;
    if (mapSnap.exists && mapSnap.data().boardId !== boardId) return;
    tx.set(mapping, { boardId, checkoutSessionId: session.id, customerId: stripeId(session.customer), paymentLinkId: stripeId(session.payment_link) }, { merge: true });
    const current = boardSnap.data();
    if ((current.stripeEventCreated || 0) > event.created) return;
    tx.update(board, {
      premiumActive: true,
      premiumUntil: paidSnap.exists ? paidSnap.data().paidUntil : nextYear(session.created),
      stripeCustomerId: stripeId(session.customer),
      stripeSubscriptionId: subId,
      stripeStatus: 'active',
      stripeEventCreated: event.created,
    });
  });
}

async function handleInvoicePaid(invoice, event) {
  const subId = stripeId(invoice.parent?.subscription_details?.subscription || invoice.subscription);
  if (!subId || !invoice.billing_reason?.startsWith('subscription_')) return;
  const periodEnd = Math.max(0, ...(invoice.lines?.data || []).map(line => line.period?.end || 0));
  if (!periodEnd) return;
  const mapping = await subscriptionDoc(subId).get();
  if (!mapping.exists) {
    // Stripe can deliver the first paid invoice before the completed checkout.
    await paidPeriodDoc(subId).set({ paidUntil: Timestamp.fromMillis(periodEnd * 1000), eventCreated: event.created });
    return;
  }
  const board = boardDoc(mapping.data().boardId);
  await db.runTransaction(async tx => {
    const current = (await tx.get(board)).data();
    if (!current || current.stripeSubscriptionId !== subId) return;
    if ((current.stripeEventCreated || 0) > event.created && current.stripeStatus !== 'active') return;
    const previousUntil = current.premiumUntil?.toMillis() || 0;
    if (periodEnd * 1000 + 2 * 86400000 < previousUntil) return;
    const paidUntil = periodEnd * 1000;
    tx.update(board, {
      premiumActive: paidUntil > Date.now(),
      premiumUntil: Timestamp.fromMillis(paidUntil),
      stripeStatus: 'active',
      stripeEventCreated: Math.max(current.stripeEventCreated || 0, event.created),
    });
  });
}

async function handleSubscriptionChange(subscription, event) {
  const mapping = await subscriptionDoc(subscription.id).get();
  if (!mapping.exists) return;
  const board = boardDoc(mapping.data().boardId);
  await db.runTransaction(async tx => {
    const current = (await tx.get(board)).data();
    if (!current || current.stripeSubscriptionId !== subscription.id
      || (current.stripeEventCreated || 0) > event.created) return;
    const active = event.type !== 'customer.subscription.deleted'
      && subscription.status === 'active'
      && matchesAnnualPrice(subscription)
      && current.premiumUntil?.toMillis() > Date.now();
    tx.update(board, {
      premiumActive: active,
      stripeStatus: subscription.status,
      stripeEventCreated: event.created,
    });
  });
}

exports.stripeWebhook = onRequest(
  { region: 'us-central1', secrets: [webhookKey] },
  async (request, response) => {
    if (request.method !== 'POST') { response.status(405).send('Method not allowed'); return; }
    let event;
    try {
      event = Stripe.webhooks.constructEvent(request.rawBody, request.get('stripe-signature'), webhookKey.value());
    } catch (error) {
      response.status(400).send('Invalid Stripe signature');
      return;
    }
    if (event.livemode !== true) { response.status(200).send('Ignored test event'); return; }
    if (!acceptedEvents.has(event.type)) { response.status(200).send('Ignored'); return; }
    try {
      const object = event.data.object;
      if (event.type === 'checkout.session.completed') await handleCheckout(object, event);
      else if (event.type === 'invoice.paid') await handleInvoicePaid(object, event);
      else await handleSubscriptionChange(object, event);
      response.status(200).send('OK');
    } catch (error) {
      console.error('Could not process Stripe event', event.id, error);
      response.status(500).send('Retry event');
    }
  }
);

// Firebase download tokens bypass Storage Rules. New files never keep one.
exports.removeAttachmentDownloadToken = onObjectFinalized(
  { region: 'us-central1', bucket: 'team-task-board-a1fb3.firebasestorage.app' },
  async event => {
    const name = event.data.name;
    if (!/^boards\/[^/]+\/attachments\/[^/]+\/[^/]+$/.test(name)) return;
    const file = getStorage().bucket(event.data.bucket).file(name);
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.firebaseStorageDownloadTokens) {
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
    }
  }
);
