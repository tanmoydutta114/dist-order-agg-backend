import amqp from "amqplib";

const QUEUE = "orders";

export async function sendOrderToQueue(data: { orderId: string }) {
  const conn = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(data)), {
    persistent: true,
  });
  setTimeout(() => {
    conn.close();
  }, 500);
}
