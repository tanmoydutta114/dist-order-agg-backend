import amqp from "amqplib";
import { getSQLClient } from "../db";
import { QUEUE, MAX_RETRY } from "../types/constants";
import { ProductInfo, AllocationResult, AllocationItem } from "../types/order";

(async () => {
  const conn = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost"
  );
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });

  // Process one order at a time per worker
  ch.prefetch(1);

  console.log("Order processor started, waiting for orders...");

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const { orderId, retry = 0 } = JSON.parse(msg.content.toString());
    console.log(`Processing order ${orderId}, attempt ${retry + 1}`);

    try {
      await processOrderWithItems(orderId);
      ch.ack(msg);
      console.log(`Order ${orderId} processed successfully`);
    } catch (err) {
      console.log(err);
      console.error(`Order ${orderId} failed:`, err.message);

      if (retry + 1 >= MAX_RETRY) {
        await handleOrderFailure(orderId, err.message);
        ch.ack(msg);
      } else {
        // Exponential backoff for retries
        const delay = Math.pow(2, retry) * 1000; // 1s, 2s, 4s...
        setTimeout(() => {
          ch.sendToQueue(
            QUEUE,
            Buffer.from(JSON.stringify({ orderId, retry: retry + 1 })),
            { persistent: true }
          );
        }, delay);
        ch.ack(msg);
      }
    }
  });
})();

export async function processOrderWithItems(orderId: number) {
  await getSQLClient()
    .transaction()
    .execute(async (trx) => {
      // 1. Get and lock the order
      const order = await trx
        .selectFrom("orders as o")
        .innerJoin("order_items as oi", "oi.order_id", "o.id")
        .innerJoin("products as p", "p.id", "oi.product_id")
        .selectAll("o")
        .select([
          "oi.product_id",
          "oi.quantity",
          "oi.price",
          "p.vendor_product_id",
        ])
        .where("o.id", "=", orderId)
        .where("o.status", "=", "pending")
        .forUpdate() // Row-level lock
        .execute();

      if (!order || order.length === 0) {
        throw new Error(`Order ${orderId} not found or already processed`);
      }

      console.log(`Processing order: ${orderId}`);
      const orderProductsIds = order.map((item) => item.vendor_product_id);
      let totalAmount = 0;

      const availableProducts = await trx
        .selectFrom("products")
        .innerJoin("vendors", "vendors.id", "products.vendor_id")
        .select([
          "products.id",
          "products.vendor_id",
          "products.vendor_product_id",
          "products.stock_quantity",
          "products.price",
          "vendors.name as vendor_name",
        ])
        .where("products.vendor_product_id", "in", orderProductsIds)
        .where("products.is_active", "=", true)
        .where("products.stock_quantity", ">", 0)
        .orderBy("products.price", "asc")
        .forUpdate() // Lock all relevant product rows
        .execute();

      for (const vendorProductId of orderProductsIds) {
        const orderItem = order.find(
          (item) => item.vendor_product_id === vendorProductId
        );
        if (!orderItem) {
          throw new Error(
            `Order item for product ${vendorProductId} not found`
          );
        }

        const productsForThisItem = availableProducts
          .filter((p) => p.vendor_product_id === vendorProductId)
          .sort((a, b) => a.price - b.price); // Sort by price ascending (cheapest first)

        if (productsForThisItem.length === 0) {
          throw new Error(`No stock available for product ${vendorProductId}`);
        }

        console.log(
          `\nProcessing ${vendorProductId} (need ${orderItem.quantity} units):`
        );
        productsForThisItem.forEach((p) => {
          console.log(
            `  - Vendor ${p.vendor_id}: $${p.price} (stock: ${p.stock_quantity}, id: ${p.id})`
          );
        });

        // 3. Smart allocation across vendors for this specific product
        const allocations = await allocateStock(
          productsForThisItem,
          orderItem.quantity
        );

        if (allocations.totalAllocated < orderItem.quantity) {
          throw new Error(
            `Insufficient stock for ${vendorProductId}: need ${orderItem.quantity}, can allocate ${allocations.totalAllocated}`
          );
        }

        for (const allocation of allocations.items) {
          const stockUpdate = await trx
            .updateTable("products")
            .set((eb) => ({
              stock_quantity: eb("stock_quantity", "-", allocation.quantity),
            }))
            .where("id", "=", allocation.productId)
            .where("stock_quantity", ">=", allocation.quantity)
            .returning(["stock_quantity"])
            .execute();

          if (stockUpdate.length === 0) {
            throw new Error(
              `Failed to reserve ${allocation.quantity} units from ${allocation.vendorId} - insufficient stock`
            );
          }

          await trx
            .updateTable("order_items")
            .set({
              product_id: allocation.productId,
              reserved_quantity: allocation.quantity,
              price: allocation.price,
            })
            .where("order_id", "=", orderId)
            .where("product_id", "=", orderItem.product_id)
            .execute();

          await trx
            .insertInto("stock_reservations")
            .values({
              order_id: orderId,
              product_id: allocation.productId,
              reserved_quantity: allocation.quantity,
              status: "reserved",
              expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            })
            .execute();

          totalAmount += allocation.price * allocation.quantity;

          console.log(
            `Reserved ${allocation.quantity}x from ${allocation.vendorId} (${allocation.vendorName}) at $${allocation.price} each (product id: ${allocation.productId})`
          );
        }
      }

      await trx
        .updateTable("orders")
        .set({
          status: "processing",
          total_amount: totalAmount,
          processed_at: new Date(),
        })
        .where("id", "=", orderId)
        .execute();

      // 6. Reserve stock with actual vendors (simulate API calls)
      // await reserveWithVendors(allocations.items);
    });

  await finalizeOrder(orderId);
}

async function allocateStock(
  availableProducts: ProductInfo[],
  requestedQuantity: number
): Promise<AllocationResult> {
  for (const product of availableProducts) {
    if (product.stock_quantity >= requestedQuantity) {
      const allocation: AllocationItem = {
        productId: product.id,
        vendorId: product.vendor_id,
        vendorName: product.vendor_name,
        quantity: requestedQuantity,
        price: product.price,
      };

      const totalCost = product.price * requestedQuantity;

      console.log(
        `Plan: ${requestedQuantity}x from ${product.vendor_id} (${product.vendor_name}) at ${product.price} (product id: ${product.id}) - FULL QUANTITY`
      );

      return {
        items: [allocation],
        totalAllocated: requestedQuantity,
        totalCost,
      };
    } else {
      console.log(
        `Skipping ${product.vendor_id} (${product.vendor_name}) - only has ${product.stock_quantity}, need ${requestedQuantity} (product id: ${product.id})`
      );
    }
  }

  return {
    items: [],
    totalAllocated: 0,
    totalCost: 0,
  };
}

async function finalizeOrder(orderId: number) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await getSQLClient()
      .transaction()
      .execute(async (trx) => {
        // Confirm all reservations
        await trx
          .updateTable("stock_reservations")
          .set({ status: "confirmed" })
          .where("order_id", "=", orderId)
          .where("status", "=", "reserved")
          .execute();
        await trx
          .updateTable("orders")
          .set({ status: "success" })
          .where("id", "=", orderId)
          .execute();
      });

    console.log(`Order ${orderId} completed successfully`);
  } catch (error) {
    console.error(`Failed to finalize order ${orderId}:`, error);
    throw error;
  }
}

// NOT IN USE
async function reserveWithVendors(allocations: AllocationItem[]) {
  const vendorReservations = new Map<string, number>();

  for (const allocation of allocations) {
    const current = vendorReservations.get(allocation.vendorId) || 0;
    vendorReservations.set(allocation.vendorId, current + allocation.quantity);
  }

  const reservationPromises = Array.from(vendorReservations.entries()).map(
    async ([vendorId, quantity]) => {
      try {
        // await callVendorReserveAPI(vendorId, quantity);
        console.log(`Reserved ${quantity} units with ${vendorId}`);
      } catch (error) {
        console.error(`Failed to reserve with ${vendorId}:`, error.message);
        throw new Error(
          `Vendor ${vendorId} reservation failed: ${error.message}`
        );
      }
    }
  );

  await Promise.all(reservationPromises);
}

// async function callVendorReserveAPI(vendorId: string, quantity: number) {
//   // Simulate vendor reservation API call
//   const vendor = await getSQLClient()
//     .selectFrom("vendors")
//     .select(["stock_endpoint_url"])
//     .where("id", "=", vendorId)
//     .executeTakeFirst();

//   if (!vendor) {
//     throw new Error(`Vendor ${vendorId} not found`);
//   }

//   // Mock reservation API call
//   const reserveUrl = vendor.stock_endpoint_url.replace("/stock", "/reserve");

//   try {
//     const response = await axios.post(
//       reserveUrl,
//       {
//         quantity,
//         reservationId: `res_${Date.now()}_${Math.random()
//           .toString(36)
//           .substr(2, 9)}`,
//         expiresIn: 1800, // 30 minutes
//       },
//       {
//         timeout: 5000,
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     if (response.status !== 200) {
//       throw new Error(`Vendor API returned status ${response.status}`);
//     }

//     return response.data;
//   } catch (error) {
//     if (error.code === "ECONNREFUSED") {
//       // Fallback: assume reservation succeeded if vendor is offline
//       console.warn(
//         `⚠️  Vendor ${vendorId} offline, assuming reservation succeeded`
//       );
//       return { success: true, offline: true };
//     }
//     throw error;
//   }
// }

// ===============================
// 7. ORDER FINALIZATION
// ===============================

async function handleOrderFailure(orderId: number, errorMessage: string) {
  console.log(`Handling failure for order ${orderId}: ${errorMessage}`);

  await getSQLClient()
    .transaction()
    .execute(async (trx) => {
      const orderItems = await trx
        .selectFrom("order_items")
        .selectAll()
        .where("order_id", "=", orderId)
        .execute();

      // Release reserved stock
      for (const item of orderItems) {
        await trx
          .updateTable("products")
          .where("id", "=", item.product_id)
          .set((eb) => ({
            stock_quantity: eb("stock_quantity", "+", item.reserved_quantity),
          }))
          .execute();

        console.log(
          `Released ${item.reserved_quantity} units back to product ${item.product_id}`
        );
      }

      await trx
        .updateTable("stock_reservations")
        .set({ status: "released" })
        .where("order_id", "=", orderId)
        .execute();

      await trx
        .updateTable("orders")
        .set({
          status: "failed",
          failed_at: new Date(),
        })
        .where("id", "=", orderId)
        .execute();
    });

  console.log(`Order ${orderId} failure handled - stock released`);
}
