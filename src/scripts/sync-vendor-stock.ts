import axios from "axios";
import { getSQLClient } from "../db";
import { Vendor } from "../types/db";

interface VendorStockItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
}

export async function syncVendorStock() {
  console.log("Starting vendor stock synchronization...");

  // Get active vendors from database
  const vendors = await getSQLClient()
    .selectFrom("vendors")
    .selectAll()
    .where("is_active", "=", true)
    .execute();

  const failedVendors: Vendor[] = [];

  for (const vendor of vendors) {
    try {
      console.log(`Syncing stock for ${vendor.id}...`);
      await syncSingleVendor(vendor);
      console.log(`${vendor.id} stock synced successfully!`);
    } catch (error: any) {
      console.error(`Failed to sync ${vendor.id}:`, error.message);
      failedVendors.push(vendor);
    }
  }

  // Retry failed vendors after delay
  if (failedVendors.length > 0) {
    console.log(
      `\nRetrying ${failedVendors.length} failed vendors after 3s...\n`
    );
    await new Promise((res) => setTimeout(res, 3000));

    for (const vendor of failedVendors) {
      try {
        console.log(`Retrying ${vendor.id}...`);
        await syncSingleVendor(vendor);
        console.log(`Retry succeeded for ${vendor.id}`);
      } catch (error: any) {
        console.error(`Retry failed for ${vendor.id}:`, error.message);
      }
    }
  }

  console.log("Stock synchronization completed!");
}

async function syncSingleVendor(vendor: Vendor) {
  try {
    console.log("-".repeat(40));
    // Simulate random failure for testing (30% chance)
    console.log(Math.random());
    if (Math.random() < 0.1) {
      console.log(`Simulating failure for vendor ${vendor.id}`);
      throw new Error(`Simulated failure for vendor ${vendor.id}`);
    }

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

    await getSQLClient()
      .transaction()
      .execute(async (trx) => {
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
            `${vendor.id}:${item.id} - ${item.name} (${item.quantity})`
          );

          await trx
            .insertInto("products")
            .values({
              vendor_id: vendor.id,
              vendor_product_id: item.id,
              name: item.name,
              stock_quantity: Math.max(0, item.quantity),
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

        // Remove inactive products
        const deletedCount = await trx
          .deleteFrom("products")
          .where("vendor_id", "=", vendor.id)
          .where("is_active", "=", false)
          .executeTakeFirst();

        if (deletedCount.numDeletedRows > 0) {
          console.log(
            `Removed ${deletedCount.numDeletedRows} discontinued products from ${vendor.id}`
          );
        }
      });
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      throw new Error(`Vendor ${vendor.id} API is unreachable`);
    }
    throw error;
  }
}
  