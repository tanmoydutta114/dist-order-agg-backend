import { z } from "zod";

export const OrderSchema = z.object({
  productId: z.string().uuid(), // Need to add a max length validation if necessary
  quantity: z.number().int().positive(),
});

export type OrderRequest = z.infer<typeof OrderSchema>;
