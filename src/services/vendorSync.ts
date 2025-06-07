import axios from "axios";
import { getSQLClient } from "../db";
import { Vendor } from "../types/db";
import { MAX_RETRY, RETRY_DELAY_MS } from "../types/constants";
import { VendorStockItem } from "../types/vendorSync";

export async function syncVendorStock() {
  console.log("Starting vendor stock synchronization...");

  const vendors = await getSQLClient()
    .selectFrom("vendors")
    .selectAll()
    .where("is_active", "=", true)
    .execute();

  for (const vendor of vendors) {
    let attempt = 0;
    let success = false;

    while (attempt < MAX_RETRY && !success) {
      try {
        attempt++;
        console.log(
          `🔄 Attempt ${attempt}/${MAX_RETRY} - Syncing stock for ${vendor.id}...`
        );
        await syncSingleVendor(vendor);
        console.log(`${vendor.id} stock synced successfully!`);
        success = true;
      } catch (error: any) {
        console.error(
          `Attempt ${attempt} failed for ${vendor.id}:`,
          error.message
        );

        if (attempt < MAX_RETRY) {
          console.log(
            `Retrying ${vendor.id} in ${RETRY_DELAY_MS / 1000}s...\n`
          );
          await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        } else {
          console.log(`Max retries reached for ${vendor.id}. Skipping...\n`);
        }
      }
    }
  }

  console.log("Stock synchronization completed!");
}

async function syncSingleVendor(vendor: Vendor) {
  try {
    // Simulate random failure (30% chance)
    if (Math.random() < 0.5) {
      throw new Error(`Simulated failure for vendor ${vendor.id}`);
    }

    const { data } = await axios.get<VendorStockItem[]>(
      vendor.stock_endpoint_url,
      {
        timeout: 10000,
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
        await trx
          .updateTable("products")
          .set({ is_active: false })
          .where("vendor_id", "=", vendor.id)
          .execute();

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
