import { db } from "../db";
import { OrderRequest } from "../validations/order";
import { v4 as uuid } from "uuid";
import { sendOrderToQueue } from "../queue/producer";

export async function placeOrder({ productId, quantity }: OrderRequest) {
  const trx = await db.transaction().execute(async (trx) => {
    const product = await trx
      .selectFrom("products")
      .selectAll()
      .where("id", "=", productId)
      .forUpdate()
      .executeTakeFirst();

    if (!product || product.total_stock < quantity) {
      throw new Error("Insufficient stock or product not found.");
    }

    const orderId = uuid();

    await trx
      .insertInto("orders")
      .values({
        id: orderId,
        product_id: productId,
        quantity,
        status: "pending",
        created_at: new Date(),
      })
      .execute();

    await trx
      .updateTable("products")
      .set({ total_stock: product.total_stock - quantity })
      .where("id", "=", productId)
      .execute();

    await sendOrderToQueue({ orderId });

    return { orderId };
  });

  return trx;
}
