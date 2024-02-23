import './env';
import { Worker } from 'bullmq';
import {
  handleMintTransactionCreated,
  handleSubscriptionCreated,
  handleSubscriptionDeleted,
  handleInvoicePaid
} from './stripe';
import { connection } from './queue';

const worker = new Worker('stripe-minter', async (job)=>{
  if (job.name === 'stripe.subscription.created') {
    await handleSubscriptionCreated(job.data);
  } else if (job.name === 'stripe.subscription.deleted') {
    await handleSubscriptionDeleted(job.data);
  } else if (job.name === 'mint.transaction.created') {
    await handleMintTransactionCreated(job.data);
  } else if (job.name === 'stripe.invoice.paid') {
    await handleInvoicePaid(job.data);
  }
}, { connection });

worker.on('completed', job => {
  console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`${job!.id} has failed with ${err.message}`);
});