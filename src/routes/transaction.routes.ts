import { Router } from "express";
import { enqueueTransaction } from "../producers/transaction.producer";
import { TransactionEventSchema } from "../modules/transactions/transaction.schema";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const event = TransactionEventSchema.parse(req.body);
    const job = await enqueueTransaction(event);

    res.status(202).json({
      message: "Transaction accepted for processing",
      jobId: job.id,
      transactionId: event.transactionId,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
