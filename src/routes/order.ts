import express, { Request, Response } from "express";
import { OrderSchema } from "../validations/order";
import { placeOrder } from "../services/order";
import { orderRequestValidator } from "../utils/orderRequestValidator";

const router = express.Router();

router.post(
  "/",
  orderRequestValidator(OrderSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await placeOrder(req.body);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: "Order failed", details: err });
    }
  }
);

export default router;
