import amqp from "amqplib";
import { db } from "../src/db";

const QUEUE = "orders";
const MAX_RETRY = 3;

(async () => {
  const conn = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });

  console.log("Waiting for order jobs...");

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const { orderId, retry = 0 } = JSON.parse(msg.content.toString());

    try {
      // Simulate processing success/failure
      const isSuccess = Math.random() > 0.2;
      if (!isSuccess) throw new Error("Simulated failure");

      await db
        .updateTable("orders")
        .set({ status: "success" })
        .where("id", "=", orderId)
        .execute();
      ch.ack(msg);
    } catch (err) {
      if (retry + 1 >= MAX_RETRY) {
        // Mark order as failed and release stock
        const order = await db
          .selectFrom("orders")
          .selectAll()
          .where("id", "=", orderId)
          .executeTakeFirst();
        if (order) {
          await db.transaction().execute(async (trx) => {
            await trx
              .updateTable("orders")
              .set({ status: "failed" })
              .where("id", "=", orderId)
              .execute();

            await trx
              .updateTable("products")
              .where("id", "=", order.product_id)
              .set((eb) => ({
                total_stock: eb("total_stock", "+", order.quantity),
              }))
              .execute();
          });
        }
        ch.ack(msg);
      } else {
        ch.sendToQueue(
          QUEUE,
          Buffer.from(JSON.stringify({ orderId, retry: retry + 1 })),
          { persistent: true }
        );
        ch.ack(msg);
      }
    }
  });
})();
