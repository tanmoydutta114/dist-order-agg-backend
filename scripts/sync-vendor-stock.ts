import axios from "axios";
import { db } from "../src/db";
import { Vendor } from "../src/types/db";

interface VendorStockItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
}

export async function syncVendorStock() {
  console.log("Starting vendor stock synchronization...");

  // Get active vendors from database
  const vendors = await db
    .selectFrom("vendors")
    .selectAll()
    .where("is_active", "=", true)
    .execute();

  for (const vendor of vendors) {
    try {
      console.log(`Syncing stock for ${vendor.id}...`);
      await syncSingleVendor(vendor);
      console.log(`✅ ${vendor.id} stock synced successfully!`);
    } catch (error) {
      console.error(`❌ Failed to sync ${vendor.id}:`, error.message);
      // Continue with other vendors even if one fails
    }
  }

  console.log("Stock synchronization completed!");
}

async function syncSingleVendor(vendor: Vendor) {
  try {
    // Fetch stock data from vendor API
    const { data } = await axios.get<VendorStockItem[]>(
      vendor.stock_endpoint_url,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          "User-Agent": "OrderAggregator/1.0",
        },
      }
    );

    if (!Array.isArray(data)) {
      throw new Error(`Invalid response format from ${vendor.id}`);
    }

    await db.transaction().execute(async (trx) => {
      // Mark all products from this vendor as potentially stale
      await trx
        .updateTable("products")
        .set({ is_active: false })
        .where("vendor_id", "=", vendor.id)
        .execute();

      // Process each stock item
      for (const item of data) {
        if (!item.id || !item.name || typeof item.quantity !== "number") {
          console.warn(`Skipping invalid item from ${vendor.id}:`, item);
          continue;
        }

        console.log(
          `  📦 ${vendor.id}:${item.id} - ${item.name} (${item.quantity})`
        );

        await trx
          .insertInto("products")
          .values({
            vendor_id: vendor.id,
            vendor_product_id: item.id,
            name: item.name,
            stock_quantity: Math.max(0, item.quantity), // Ensure non-negative
            price: item.price || 0,
            is_active: true,
            last_synced_at: new Date(),
            updated_at: new Date(),
          })
          .onConflict((oc) =>
            oc.columns(["vendor_id", "vendor_product_id"]).doUpdateSet({
              name: item.name,
              stock_quantity: Math.max(0, item.quantity),
              price: item.price || 0,
              is_active: true,
              last_synced_at: new Date(),
              updated_at: new Date(),
            })
          )
          .execute();
      }

      // Optional: Remove products that are no longer available
      // (Alternatively, you might want to keep them as inactive)
      const deletedCount = await trx
        .deleteFrom("products")
        .where("vendor_id", "=", vendor.id)
        .where("is_active", "=", false)
        .executeTakeFirst();

      if (deletedCount.numDeletedRows > 0) {
        console.log(
          `  🗑️  Removed ${deletedCount.numDeletedRows} discontinued products from ${vendor.id}`
        );
      }
    });
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      throw new Error(`Vendor ${vendor.id} API is unreachable`);
    }
    throw error;
  }
}
