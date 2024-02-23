import express, { Request, Response } from 'express';
import { constructEvent, createCheckoutSession, deleteSubscription, getNftMetadata } from './stripe';
import { queue } from './queue';

const router = express.Router();

router.post('/create-checkout-session', async (req: Request, res: Response) => {
  const { walletAddress, lookup_key } = req.body;
  if (!walletAddress || !lookup_key)
    return res
      .status(400)
      .send({ error: { message: 'Missing required parameters. Wallet address and lookup key are required.' } });

  const checkout = await createCheckoutSession(walletAddress, lookup_key);
  if (!checkout) return res.status(400).send({ error: { message: 'Error creating checkout session' } });
  res.redirect(303, checkout);
});

router.post('/cancel-subscription', async (req: Request, res: Response) => {
  const { session_id } = req.body;
  if (!session_id)
    return res.status(400).send({ error: { message: 'Missing required parameters. Session ID is required.' } });
  const deletedSubscription = await deleteSubscription(session_id);
  if (!deletedSubscription) return res.status(400).send({ error: { message: 'Error deleting subscription' } });
  res.sendStatus(200);
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const event = constructEvent(req);
  if (event.type === 'customer.subscription.created') {
    await queue.add('stripe.subscription.created', event);
    res.sendStatus(200);
  } else if (event.type === 'customer.subscription.deleted') {
    await queue.add('stripe.subscription.deleted', event);
    res.sendStatus(200);
  } else if (event.type === 'invoice.paid') {
    await queue.add('stripe.invoice.paid', event);
    res.sendStatus(200);
  } else return res.status(400).send(`Unhandled event type: ${event.type}`);
});

router.get('/nft-metadata', async (req: Request, res: Response) => {
  const { session_id } = req.query;
  if (typeof session_id !== 'string' || !session_id)
    return res.status(400).send({ error: { message: 'Missing or invalid session ID' } });

  const metadata = await getNftMetadata(session_id);
  if (!metadata) return res.status(400).send({ error: { message: 'Error getting metadata' } });
  res.status(200).send(metadata);
});

router.get('/', async (req: Request, res: Response) => {
  res.redirect(`${process.env.YOUR_DOMAIN}/subscribe.html`);
});

export default router;
