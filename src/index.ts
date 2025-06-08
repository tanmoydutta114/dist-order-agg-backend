import express from "express";
import dotenv from "dotenv";
import orderRouter from "./routes/order";
import productRouter from "./routes/products";
import vendorSync from "./routes/vendorsSync";
import vendorAStock from "./vendor/mockVendorA";
import vendorBStock from "./vendor/mockVendorB";

import { requestLogger } from "./utils/requestLogger";
dotenv.config();

const app = express();
app.use(express.json());
app.use(requestLogger);

app.use("/order", orderRouter);
app.use("/products", productRouter);
app.use("/vendorSync", vendorSync);
app.use("/vendorA", vendorAStock);
app.use("/vendorB", vendorBStock);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Order Aggregator API running on port ${PORT}`);
});
