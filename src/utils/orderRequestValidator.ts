import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { getSQLClient } from "../db";

export const orderRequestValidator =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.safeParse(req.body);
    if (error) {
      res.status(400).json({ error: error.flatten() });
      return;
    }
    next();
  };

// Helper function to get aggregated stock for a product
export async function getAggregatedStock(vendorProductId: string) {
  const result = await getSQLClient()
    .selectFrom("aggregated_products")
    .selectAll()
    .where("product_id", "=", vendorProductId)
    .executeTakeFirst();

  return result;
}

// Helper function to get available stock from specific vendors
export async function getVendorStock(vendorProductId: string) {
  const results = await getSQLClient()
    .selectFrom("products")
    .innerJoin("vendors", "vendors.id", "products.vendor_id")
    .select([
      "products.id",
      "products.vendor_id",
      "vendors.name as vendor_name",
      "products.stock_quantity",
      "products.price",
      "products.last_synced_at",
    ])
    .where("products.vendor_product_id", "=", vendorProductId)
    .where("products.is_active", "=", true)
    .where("products.stock_quantity", ">", 0)
    .orderBy("products.price", "asc") // Order by price for smart allocation
    .execute();

  return results;
}
