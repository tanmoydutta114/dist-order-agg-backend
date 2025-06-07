import { z } from "zod";

export const OrderSchema = z.object({
  vendorProductId: z.string(), // Need to add a max length validation if necessary
  quantity: z.number().int().positive(),
  customerId: z.string().optional(),
});

export type OrderRequest = z.infer<typeof OrderSchema>;                                                                                                                                         
