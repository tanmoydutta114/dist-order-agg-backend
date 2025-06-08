import express, { Request, Response } from "express";
import { de } from "zod/v4/locales";

const router = express.Router();

router.get("/stock", (req: Request, res: Response) => {
  res.json([
    {
      id: "product-1",
      name: "Premium Laptop",
      quantity: Math.floor(Math.random() * 50) + 10,
      price: 1299.99,
    },
    {
      id: "product-2",
      name: "Wireless Mouse",
      quantity: Math.floor(Math.random() * 200) + 50,
      price: 29.99,
    },
    {
      id: "product-3",
      name: "USB-C Hub",
      quantity: Math.floor(Math.random() * 100) + 20,
      price: 79.99,
    },
    {
      id: "product-5",
      name: "4K Monitor",
      quantity: Math.floor(Math.random() * 25) + 5,
      price: 199.99,
    },
  ]);
});

export default router;
