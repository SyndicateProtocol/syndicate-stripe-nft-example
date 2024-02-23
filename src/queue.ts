import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const connection = new Redis({ maxRetriesPerRequest: null });

export const queue = new Queue('stripe-minter', { 
  connection,
  defaultJobOptions: {
    attempts: 100,
    backoff: { type: 'exponential', delay: 2000 }
  }
});