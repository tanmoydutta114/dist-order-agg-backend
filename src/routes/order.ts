import express, { Response, Request } from "express";
import { placeOrder } from "../services/order";
import { orderRequestValidator } from "../utils/orderRequestValidator";
import { ZOrderSchema } from "../validations/order";

const router = express.Router();

router.post(
  "/",
  orderRequestValidator(ZOrderSchema),
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
