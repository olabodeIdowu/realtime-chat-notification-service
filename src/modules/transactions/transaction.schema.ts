import { z } from "zod";

export const TransactionEventSchema = z.object({
  transactionId: z.string().min(1),
  merchantId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default("NGN"),
  type: z.enum(["payment", "refund", "payout"]),
  metadata: z.record(z.any()).optional(),
});

export type TransactionEvent = z.infer<typeof TransactionEventSchema>;
