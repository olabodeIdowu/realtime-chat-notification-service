import { pool } from "../../config/database";
import { redisConnection } from "../../config/redis";
import { config } from "../../config";
import { TransactionEvent } from "./transaction.schema";

export class TransactionService {
  private idempotencyKey(txId: string) {
    return `idempotency:tx:${txId}`;
  }

  async process(event: TransactionEvent) {
    const key = this.idempotencyKey(event.transactionId);

    // 1. Idempotency check
    const alreadyProcessed = await redisConnection.get(key);
    if (alreadyProcessed) {
      return {
        status: "already_processed",
        transactionId: event.transactionId,
      };
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 2. Insert transaction (source of truth)
      await connection.execute(
        `INSERT INTO transactions 
          (id, merchant_id, amount, currency, type, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, NOW())`,
        [
          event.transactionId,
          event.merchantId,
          event.amount,
          event.currency,
          event.type,
          JSON.stringify(event.metadata || {}),
        ],
      );

      // 3. Mark as processed (idempotency)
      await redisConnection.set(key, "1", "EX", config.idempotencyTTL);

      await connection.commit();

      return { status: "completed", transactionId: event.transactionId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
