import { getSQLClient } from "../db";
import { OrderItemRequest, OrderRequest } from "../validations/order";
import { sendOrderToQueue } from "../queue/producer";
import { OrderItem } from "../types/db";

interface ProductValidation {
  vendorProductId: string;
  requestedQty: number;
  availableQty: number;
  canFulfill: boolean;
  cheapestPrice: number;
  vendorCount: number;
  bestVendorId: string;
}

export async function placeOrder(orderRequest: OrderRequest) {
  const { products, customerId } = orderRequest;

  // Step 1: Validate all products and check availability
  const validation = await validateOrderProducts(products);

  if (!validation.isValid) {
    throw new Error(
      `Order validation failed: ${JSON.stringify(validation.errors)}`
    );
  }

  // Step 2: Create order in database
  const orderId = await createOrderInDatabase(
    customerId,
    products,
    validation.validatedProducts
  );

  // Step 3: Queue for processing
  await sendOrderToQueue({ orderId });

  return orderId;
}

async function validateOrderProducts(products: OrderItemRequest[]) {
  const requestedVendorProductIds = products.map((p) => p.vendorProductId);

  // Get all products with their stock and pricing info in one query
  const availableProducts = await getSQLClient()
    .selectFrom("products")
    .innerJoin("vendors", "vendors.id", "products.vendor_id")
    .select([
      "products.id",
      "products.vendor_id",
      "products.vendor_product_id",
      "products.stock_quantity",
      "products.price",
      "products.is_active",
      "vendors.name as vendor_name",
    ])
    .where("products.vendor_product_id", "in", requestedVendorProductIds)
    .where("products.is_active", "=", true)
    .where("products.stock_quantity", ">", 0)
    .orderBy("products.vendor_product_id")
    .orderBy("products.price", "asc") // Cheapest first for each product
    .execute();

  const validatedProducts: ProductValidation[] = [];
  const errors: Array<{ error: string; productId: string; details?: any }> = [];

  // Group products by vendor_product_id
  const productGroups = new Map<string, typeof availableProducts>();
  for (const product of availableProducts) {
    if (!productGroups.has(product.vendor_product_id)) {
      productGroups.set(product.vendor_product_id, []);
    }
    productGroups.get(product.vendor_product_id)!.push(product);
  }

  // Validate each requested product
  for (const requestedProduct of products) {
    const { vendorProductId, quantity } = requestedProduct;
    const availableOptions = productGroups.get(vendorProductId) || [];

    if (availableOptions.length === 0) {
      errors.push({
        error: "Product not found or out of stock",
        productId: vendorProductId,
      });
      continue;
    }

    // Check if ANY vendor can fulfill the entire quantity (whole-order logic)
    const canFulfillVendor = availableOptions.find(
      (option) => option.stock_quantity >= quantity
    );

    if (!canFulfillVendor) {
      const totalAvailable = availableOptions.reduce(
        (sum, option) => sum + option.stock_quantity,
        0
      );
      errors.push({
        error: "No single vendor can fulfill entire quantity",
        productId: vendorProductId,
        details: {
          requested: quantity,
          totalAvailableAcrossVendors: totalAvailable,
          maxSingleVendor: Math.max(
            ...availableOptions.map((o) => o.stock_quantity)
          ),
          availableVendors: availableOptions.map((o) => ({
            vendorId: o.vendor_id,
            vendorName: o.vendor_name,
            stock: o.stock_quantity,
            price: o.price,
          })),
        },
      });
      continue;
    }

    // Product can be fulfilled - record the validation info
    const totalAvailable = availableOptions.reduce(
      (sum, option) => sum + option.stock_quantity,
      0
    );
    const cheapestOption = availableOptions[0]; // Already sorted by price ASC

    validatedProducts.push({
      vendorProductId,
      requestedQty: quantity,
      availableQty: totalAvailable,
      canFulfill: true,
      cheapestPrice: cheapestOption.price,
      vendorCount: availableOptions.length,
      bestVendorId: canFulfillVendor.vendor_id, // Vendor that can fulfill entire quantity
    });

    console.log(
      `✅ ${vendorProductId}: Can fulfill ${quantity} units. Best option: ${canFulfillVendor.vendor_name} ($${canFulfillVendor.price}, stock: ${canFulfillVendor.stock_quantity})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedProducts,
  };
}

async function createOrderInDatabase(
  customerId: string,
  products: OrderItemRequest[],
  validatedProducts: ProductValidation[]
) {
  return await getSQLClient()
    .transaction()
    .execute(async (trx) => {
      // Create main order record
      const [order] = await trx
        .insertInto("orders")
        .values({
          customer_id: customerId,
          status: "pending",
          created_at: new Date(),
        })
        .returning(["id"])
        .execute();

      // Get one product ID for each vendor_product_id (we'll let the processor choose the best one)
      // This is just a placeholder - the actual product selection happens in the processor
      const productLookup = await trx
        .selectFrom("products")
        .select(["id", "vendor_product_id"])
        .where(
          "vendor_product_id",
          "in",
          products.map((p) => p.vendorProductId)
        )
        .where("is_active", "=", true)
        .distinctOn("vendor_product_id") // Get one product per vendor_product_id
        .execute();

      const orderItems: OrderItem[] = products.map((product) => {
        const productRecord = productLookup.find(
          (p) => p.vendor_product_id === product.vendorProductId
        );

        if (!productRecord) {
          throw new Error(
            `Product ${product.vendorProductId} not found during order creation`
          );
        }

        return {
          order_id: order.id,
          product_id: productRecord.id, // This is just a placeholder
          quantity: product.quantity,
          reserved_quantity: 0,
          price: 0, // Will be set by processor
        };
      });

      await trx.insertInto("order_items").values(orderItems).execute();

      console.log(
        `📝 Created order ${order.id} with ${orderItems.length} items`
      );
      return order.id;
    });
}

// Optional: Add a function to get real-time stock info for frontend
export async function getProductAvailability(vendorProductIds: string[]) {
  const products = await getSQLClient()
    .selectFrom("products")
    .innerJoin("vendors", "vendors.id", "products.vendor_id")
    .select([
      "products.vendor_product_id",
      "products.vendor_id",
      "products.stock_quantity",
      "products.price",
      "vendors.name as vendor_name",
    ])
    .where("products.vendor_product_id", "in", vendorProductIds)
    .where("products.is_active", "=", true)
    .where("products.stock_quantity", ">", 0)
    .orderBy("products.vendor_product_id")
    .orderBy("products.price", "asc")
    .execute();

  const availability = new Map<
    string,
    Array<{
      vendorId: string;
      vendorName: string;
      stock: number;
      price: number;
      maxOrderQty: number;
    }>
  >();

  for (const product of products) {
    if (!availability.has(product.vendor_product_id)) {
      availability.set(product.vendor_product_id, []);
    }

    availability.get(product.vendor_product_id)!.push({
      vendorId: product.vendor_id,
      vendorName: product.vendor_name,
      stock: product.stock_quantity,
      price: product.price,
      maxOrderQty: product.stock_quantity, // Max quantity you can order from this vendor
    });
  }

  return Object.fromEntries(availability);
}
