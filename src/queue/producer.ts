import amqp from "amqplib";

export async function sendOrderToQueue(data: { orderId: number }) {
  const conn = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const ch = await conn.createChannel();

  const QUEUE = "orders";
  await ch.assertQueue(QUEUE, { durable: true });

  const message = JSON.stringify({ orderId: data.orderId, retry: 0 });
  ch.sendToQueue(QUEUE, Buffer.from(message), { persistent: true });

  await ch.close();
  await conn.close();
}
