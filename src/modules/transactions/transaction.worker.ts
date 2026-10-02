import { Worker, Job } from "bullmq";
import { redisConnection } from "../../config/redis";
import { config } from "../../config";
import { TransactionService } from "./transaction.service";
import { TransactionEventSchema } from "./transaction.schema";

const transactionService = new TransactionService();

const worker = new Worker(
  config.queueName,
  async (job: Job) => {
    console.log(`Processing job ${job.id} – tx: ${job.data.transactionId}`);

    // Validate payload
    const event = TransactionEventSchema.parse(job.data);

    const result = await transactionService.process(event);
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 10, // tune based on load
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log("Transaction worker started");
