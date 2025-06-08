import express, { Request, Response } from "express";
import { getAllProducts } from "../services/products";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await getAllProducts();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products", details: err });
  }
});

export default router;
