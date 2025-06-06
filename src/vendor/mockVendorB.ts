import express from "express";

const router = express.Router();

router.get("/stock", (req, res) => {
  res.json([
    {
      id: "product-3",
      name: "Product Three",
      quantity: Math.floor(Math.random() * 100),
    },
    {
      id: "product-4",
      name: "Product Four",
      quantity: Math.floor(Math.random() * 100),
    },
  ]);
});
