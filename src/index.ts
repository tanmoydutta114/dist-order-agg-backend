import express from "express";
import dotenv from "dotenv";
import orderRouter from "./routes/order";
import vendorARouter from "./vendor/mockVendorA";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/order", orderRouter);
app.use("/vendorA", vendorARouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Order Aggregator API running on port ${PORT}`);
});
