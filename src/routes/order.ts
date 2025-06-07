import express, { Response, Request } from "express";
import { placeOrder } from "../services/order";
import { orderRequestValidator } from "../utils/orderRequestValidator";
import { OrderSchema } from "../validations/order";

const router = express.Router();

router.post(
  "/",
  orderRequestValidator(OrderSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await placeOrder(req.body);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: "Order failed", details: err?.message });
    }
  }
);

export default router;

// import { db } from "../db";

// router.post("/order", async (req, res) => {
//   const { vendorProductId, quantity, customerId } = req.body;

//   if (!vendorProductId || !quantity || quantity <= 0) {
//     res.status(400).json({ error: "Invalid product ID or quantity" });
//   }

//   try {
//     // Check if we have enough total stock across all vendors
//     const aggregatedStock = await db
//       .selectFrom("aggregated_products")
//       .select(["total_stock", "vendor_count", "available_vendors"])
//       .where("product_id", "=", vendorProductId)
//       .executeTakeFirst();

//     if (!aggregatedStock || aggregatedStock.total_stock < quantity) {
//       res.status(400).json({
//         // Need to fix returns
//         error: "Insufficient stock",
//         available: aggregatedStock?.total_stock || 0,
//         requested: quantity,
//       });
//     }

//     const orderId = await db.transaction().execute(async (trx) => {
//       // Create main order record
//       const [order] = await trx
//         .insertInto("orders")
//         .values({
//           vendor_product_id: vendorProductId,
//           quantity: quantity,
//           customer_id: customerId,
//           status: "pending",
//           created_at: new Date(),
//         })
//         .returning(["id"])
//         .execute();

//       // Queue order for processing
//       await queueOrder(order.id);

//       return order.id;
//     });

//     res.json({
//       orderId,
//       status: "pending",
//       message: "Order queued for processing",
//     });
//   } catch (error) {
//     console.error("Order creation failed:", error);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });

// export default router;
