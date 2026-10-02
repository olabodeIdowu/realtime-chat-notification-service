import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { config } from "../config";
import { TransactionEvent } from "../modules/transactions/transaction.schema";

export const transactionQueue = new Queue(config.queueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export async function enqueueTransaction(event: TransactionEvent) {
  const job = await transactionQueue.add("process-transaction", event, {
    jobId: event.transactionId, // helps with deduplication
  });
  return job;
}
