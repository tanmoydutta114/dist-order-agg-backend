import { getSQLClient } from "../db";
import { OrderRequest } from "../validations/order";
import { v4 as uuid } from "uuid";
import { sendOrderToQueue } from "../queue/producer";

export async function placeOrder(orderRequest: OrderRequest) {
  const { vendorProductId, quantity, customerId } = orderRequest;

  // Check if we have enough total stock across all vendors
  const aggregatedStock = await getSQLClient()
    .selectFrom("aggregated_products")
    .select(["total_stock", "vendor_count", "available_vendors"])
    .where("product_id", "=", vendorProductId)
    .executeTakeFirst();

  if (!aggregatedStock || aggregatedStock.total_stock < quantity) {
    return {
      error: "Insufficient stock",
      available: aggregatedStock?.total_stock || 0,
      requested: quantity,
    };
  }

  const orderId = await getSQLClient()
    .transaction()
    .execute(async (trx) => {
      // Create main order record
      const [order] = await trx
        .insertInto("orders")
        .values({
          vendor_product_id: vendorProductId,
          quantity: quantity,
          customer_id: customerId,
          status: "pending",
          created_at: new Date(),
        })
        .returning(["id"])
        .execute();

      // Queue order for processing
      await sendOrderToQueue({ orderId:order.id });

      return order.id;
    });
}
