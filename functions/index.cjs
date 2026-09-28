const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const Stripe = require('stripe');

initializeApp();
const db = getFirestore();
const webhookKey = defineSecret('STRIPE_WEBHOOK_SECRET');
const platformAdminEmail = 'titanbusinesspros@gmail.com';
const annualPaymentLinkUrl = 'https://buy.stripe.com/bJe14o8Jz5ok85Q0oT7AI10';
const trialPaymentLinkUrl = 'https://buy.stripe.com/4gMfZi8Jz9EA0DodbF7AI11';
const boardDoc = uid => db.collection('boards').doc(uid);
const premiumGrantDoc = email => db.collection('premium_grants').doc(email);
const subscriptionDoc = id => db.collection('stripe_subscriptions').doc(id);
const paidPeriodDoc = id => db.collection('stripe_paid_periods').doc(id);
const trialCheckoutDoc = id => db.collection('stripe_trial_checkouts').doc(id);
const acceptedEvents = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);
const stripeId = value => typeof value === 'string' ? value : value?.id || null;
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

async function requirePlatformAdmin(request) {
  if (!request.auth?.uid || request.auth.token.email_verified !== true
    || request.auth.token.email?.toLowerCase() !== platformAdminEmail) {
    throw new HttpsError('permission-denied', 'Only the Titan Business Pros admin can manage premium grants.');
  }
  const user = await getAuth().getUser(request.auth.uid);
  if (!user.emailVerified || user.email?.toLowerCase() !== platformAdminEmail) {
    throw new HttpsError('permission-denied', 'Only the Titan Business Pros admin can manage premium grants.');
  }
}

function grantEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('/')) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return email;
}

exports.listPremiumGrants = onCall({ region: 'us-central1' }, async request => {
  await requirePlatformAdmin(request);
  const snapshot = await db.collection('premium_grants').orderBy('email').get();
  return { grants: snapshot.docs.map(doc => ({
    email: doc.id,
    expiresAt: doc.data().expiresAt.toDate().toISOString(),
  })) };
});

exports.grantPremiumYear = onCall({ region: 'us-central1' }, async request => {
  await requirePlatformAdmin(request);
  const email = grantEmail(request.data?.email);
  const now = Timestamp.now();
  const expiresAt = nextYear(Math.floor(now.toMillis() / 1000));
  let uid = null;
  try {
    uid = (await getAuth().getUserByEmail(email)).uid;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  const grant = premiumGrantDoc(email);
  const board = uid ? boardDoc(uid) : null;
  await db.runTransaction(async tx => {
    const boardSnapshot = board ? await tx.get(board) : null;
    const boardId = boardSnapshot?.exists && boardSnapshot.data().ownerUid === uid
      && boardSnapshot.data().ownerEmail === email ? uid : null;
    tx.set(grant, { email, grantedAt: now, expiresAt, grantedByUid: request.auth.uid,
      boardId: boardId || uid || null });
    if (boardId) tx.update(board, { premiumGrantUntil: expiresAt });
  });
  return { email, expiresAt: expiresAt.toDate().toISOString() };
});

exports.revokePremiumGrant = onCall({ region: 'us-central1' }, async request => {
  await requirePlatformAdmin(request);
  const email = grantEmail(request.data?.email);
  const grant = premiumGrantDoc(email);
  await db.runTransaction(async tx => {
    const grantSnapshot = await tx.get(grant);
    if (!grantSnapshot.exists) return;
    const uid = grantSnapshot.data().boardId;
    const board = typeof uid === 'string' ? boardDoc(uid) : null;
    const boardSnapshot = board ? await tx.get(board) : null;
    tx.delete(grant);
    if (boardSnapshot?.exists && boardSnapshot.data().ownerEmail === email) {
      tx.update(board, { premiumGrantUntil: FieldValue.delete() });
    }
  });
  return { email };
});

exports.activatePendingPremiumGrant = onDocumentCreated(
  { document: 'boards/{boardId}', region: 'us-central1' }, async event => {
    const boardId = event.params.boardId;
    const email = event.data?.data()?.ownerEmail;
    if (typeof email !== 'string' || !email || event.data.data().ownerUid !== boardId) return;
    const board = boardDoc(boardId);
    const grant = premiumGrantDoc(email);
    await db.runTransaction(async tx => {
      const [boardSnapshot, grantSnapshot] = await Promise.all([tx.get(board), tx.get(grant)]);
      if (!boardSnapshot.exists || boardSnapshot.data().ownerEmail !== email
        || !grantSnapshot.exists || grantSnapshot.data().expiresAt?.toMillis() <= Date.now()) return;
      tx.update(board, { premiumGrantUntil: grantSnapshot.data().expiresAt });
      tx.update(grant, { boardId });
    });
  }
);

exports.createPremiumCheckout = onCall({ region: 'us-central1' }, async request => {
  const user = request.auth;
  if (!user?.uid || !user.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Sign in with a verified email first.');
  }
  const board = await boardDoc(user.uid).get();
  if (!board.exists || board.data().ownerUid !== user.uid) {
    throw new HttpsError('failed-precondition', 'Your board is not ready.');
  }
  const plan = request.data?.plan || 'annual';
  if (plan !== 'annual' && plan !== 'trial') {
    throw new HttpsError('invalid-argument', 'Choose a valid premium option.');
  }
  if ((board.data().premiumActive && board.data().premiumUntil?.toMillis() > Date.now())
    || board.data().premiumGrantUntil?.toMillis() > Date.now()) {
    throw new HttpsError('already-exists', 'This board already has premium access.');
  }
  const link = plan === 'trial' ? trialPaymentLinkUrl : annualPaymentLinkUrl;
  const reference = plan === 'trial' ? `trial_${user.uid}` : user.uid;
  return { url: `${link}?client_reference_id=${encodeURIComponent(reference)}` };
});

async function boardForCheckout(session, plan = 'annual') {
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return null;
  const reference = plan === 'trial'
    ? (typeof session.client_reference_id === 'string' && session.client_reference_id.startsWith('trial_')
      ? session.client_reference_id.slice(6) : null)
    : session.client_reference_id;
  if (plan === 'trial' && !validBoardId(reference)) return null;
  let boardId = validBoardId(reference) ? reference : null;
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
  if (session.mode === 'payment') {
    await handleTrialCheckout(session, event);
    return;
  }
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

async function handleTrialCheckout(session, event) {
  if (session.payment_status !== 'paid' || session.currency !== 'usd'
    || session.amount_subtotal !== 100 || session.amount_total < 100
    || !stripeId(session.payment_link) || !stripeId(session.payment_intent)
    || typeof session.id !== 'string' || !session.id.startsWith('cs_live_')) return;
  const boardId = await boardForCheckout(session, 'trial');
  if (!boardId) {
    console.warn('Paid $1 checkout has no verified matching board', event.id);
    return;
  }
  const checkout = trialCheckoutDoc(session.id);
  const board = boardDoc(boardId);
  await db.runTransaction(async tx => {
    const [boardSnapshot, checkoutSnapshot] = await Promise.all([tx.get(board), tx.get(checkout)]);
    if (!boardSnapshot.exists || boardSnapshot.data().ownerUid !== boardId || checkoutSnapshot.exists) return;
    const paidAt = event.created * 1000;
    const currentTrialUntil = boardSnapshot.data().premiumTrialUntil?.toMillis() || 0;
    const expiresAt = Timestamp.fromMillis(Math.max(paidAt, currentTrialUntil) + 30 * 86400000);
    tx.create(checkout, {
      boardId, paymentLinkId: stripeId(session.payment_link),
      paymentIntentId: stripeId(session.payment_intent),
      paidAt: Timestamp.fromMillis(paidAt), expiresAt,
    });
    tx.update(board, { premiumTrialUntil: expiresAt });
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
      if (event.type === 'checkout.session.completed'
        || event.type === 'checkout.session.async_payment_succeeded') await handleCheckout(object, event);
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
