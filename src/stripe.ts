import type express from 'express';
import Stripe from 'stripe';
import {
  sendNFT,
  getTransactionHash,
  getTransactionTokenId,
  claimContract,
  updateNftMetadata,
  getTokenMetadata
} from './syndicate';
import { queue } from './queue';

if (!process.env.STRIPE_API_KEY) throw new Error('STRIPE_API_KEY is not defined in your environment');
if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not defined in your environment');

export const stripe = new Stripe(process.env.STRIPE_API_KEY);

export const constructEvent = (req: express.Request) => {
  if (!req.headers['stripe-signature']) throw new Error('Missing stripe signature header');
  return stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET!);
};

export const createCheckoutSession = async (walletAddress: string, productLookupKey: string) => {
  const customer = await stripe.customers.create({
    metadata: { walletAddress: walletAddress }
  });

  const prices = await stripe.prices.list({
    lookup_keys: [productLookupKey],
    expand: ['data.product']
  });

  if (!prices.data.length) throw new Error('No price found for lookup key');

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    billing_address_collection: 'auto',
    line_items: [
      {
        price: prices.data[0].id,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.YOUR_DOMAIN}/subscribed.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.YOUR_DOMAIN}/subscribe.html`
  });

  return session.url;
};

export const deleteSubscription = async (sessionId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (typeof session.subscription !== 'string') throw new Error('Session subscription is not a string');
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const deletedSubscription = await stripe.subscriptions.cancel(subscription.id);
  if (!deletedSubscription) throw new Error('Error deleting subscription');
  return deletedSubscription;
};

const _getWalletAddress = async (customer: Stripe.Customer | Stripe.DeletedCustomer | string) => {
  const customerData = typeof customer === 'string' ? await stripe.customers.retrieve(customer) : customer;

  if (customerData.deleted) throw new Error('Customer has been deleted.');
  if (!customerData.metadata?.walletAddress) throw new Error('No wallet address found in customer metadata.');

  return customerData.metadata.walletAddress;
};

type StripeSubscriptionMetadata = {
  tokenId: number;
};

const _updateSubscriptionMetadata = async (subscriptionId: string, metadata: StripeSubscriptionMetadata) => {
  await stripe.subscriptions.update(subscriptionId, { metadata });
};

export const handleMintTransactionCreated = async (data: {
  transactionId: string;
  stripeSubscriptionId: string;
  createdAt: string;
}) => {
  const transactionHash = await getTransactionHash(data.transactionId);
  const tokenId = await getTransactionTokenId(transactionHash);
  await _updateSubscriptionMetadata(data.stripeSubscriptionId, { tokenId });
  await claimContract();
  await updateNftMetadata(tokenId, {
    image: 'https://i.ibb.co/tXf5vQz/cb46557190851a8f9518d18724b7be1d.webp',
    joined_date: data.createdAt,
    tier: 'pro',
    status: 'active',
    level: 1,
    stamina: 0,
    creator: 0,
    collaborator: 0,
    advisor: 0,
    builder: 0,
    evangelist: 0
  });
};

export const handleSubscriptionCreated = async (event: Stripe.CustomerSubscriptionCreatedEvent) => {
  const walletAddress = await _getWalletAddress(event.data.object.customer);
  const response = await sendNFT(walletAddress);
  await queue.add('mint.transaction.created', {
    transactionId: response.transactionId,
    stripeSubscriptionId: event.data.object.id,
    createdAt: new Date().toISOString()
  });
};

export const handleSubscriptionDeleted = async (event: Stripe.CustomerSubscriptionDeletedEvent) => {
  const subscription = event.data.object;
  const tokenId = parseInt(subscription.metadata.tokenId, 10);
  if (isNaN(tokenId)) throw new Error('Token ID is not a valid number');
  const metadata = await getTokenMetadata(tokenId);
  if (metadata.status !== 'cancelled') {
    await updateNftMetadata(tokenId, { ...metadata, status: 'cancelled' });
  }
};

export const getNftMetadata = async (sessionId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (typeof session.subscription !== 'string') throw new Error('Session subscription is not a string');

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const tokenId = parseInt(subscription.metadata.tokenId, 10);
  if (isNaN(tokenId))
    return null;

  const metadata = await getTokenMetadata(tokenId);
  return metadata;
};

export const handleInvoicePaid = async (event: Stripe.InvoicePaidEvent) => {
  const invoice = event.data.object;
  const subscription = invoice.subscription;
  if (!subscription) return;
  const subscriptionData = typeof subscription === 'string'
    ? await stripe.subscriptions.retrieve(subscription)
    : subscription;
  const tokenId = parseInt(subscriptionData.metadata.tokenId, 10);
  if (isNaN(tokenId)) throw new Error('Token ID is not a valid number');
  const metadata = await getTokenMetadata(tokenId);
  await updateNftMetadata(tokenId, { ...metadata, stamina: metadata.stamina + 1 });
}
