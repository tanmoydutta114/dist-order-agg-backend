import express, { Request, Response } from "express";
import { syncVendorStock } from "../services/vendorSync";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    await syncVendorStock();
    res.status(200).json({ message: "Vendor products synced successfully" });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ error: "Failed to sync vendor products", details: err });
  }
});

export default router;
