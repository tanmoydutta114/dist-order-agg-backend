import express from "express";

const router = express.Router();

router.get("/stock", (req, res) => {
  // Simulate different stock levels and overlapping products
  res.json([
    {
      id: "product-1", // Same product as Vendor A
      name: "Premium Laptop",
      quantity: Math.floor(Math.random() * 30) + 5,
      price: 1249.99, // Different price
    },
    {
      id: "product-4",
      name: "Mechanical Keyboard",
      quantity: Math.floor(Math.random() * 75) + 25,
      price: 149.99,
    },
    {
      id: "product-5",
      name: "4K Monitor",
      quantity: Math.floor(Math.random() * 25) + 5,
      price: 399.99,
    },
    {
      id: "product-2",
      name: "Wireless Mouse",
      quantity: Math.floor(Math.random() * 200) + 50,
      price: 19.99,
    },
    {
      id: "product-3",
      name: "USB-C Hub",
      quantity: Math.floor(Math.random() * 100) + 20,
      price: 89.99,
    },
  ]);
});

export default router;
