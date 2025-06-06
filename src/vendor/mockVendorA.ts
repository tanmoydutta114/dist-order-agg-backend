import express from "express";

const router = express.Router();

router.get("/stock", (req, res) => {
  res.json([
    {
      id: "product-1",
      name: "Product One",
      quantity: Math.floor(Math.random() * 100),
    },
    {
      id: "product-2",
      name: "Product Two",
      quantity: Math.floor(Math.random() * 100),
    },
  ]);
});

export default router;
