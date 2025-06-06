import axios from "axios";
import { db } from "../src/db";

async function syncVendorAStock() {
  const vendorEndpoints = [
    { id: "vendor-a", url: "http://localhost:3000/vendorA/stock" },
    { id: "vendor-b", url: "http://localhost:3000/vendorB/stock" },
  ];
  for (const vendor of vendorEndpoints) {
    const { data } = await axios.get(vendor.url);
    for (const item of data) {
      await db
        .insertInto("products")
        .values({
          id: item.id,
          name: item.name,
          total_stock: item.quantity,
          vendor_id: vendor.id,
          last_synced_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            total_stock: item.quantity,
            last_synced_at: new Date(),
          })
        )
        .execute();
    }
    console.log("VendorA stock synced!");
  }
}

syncVendorAStock().catch((err) => {
  console.error("Failed syncing stock", err);
});
