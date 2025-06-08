import { z } from "zod";

export const ZOrderItemRequest = z.object({
  vendorProductId: z.string(),
  quantity: z.number().int().positive(),
});

export const ZOrderSchema = z.object({
  products: ZOrderItemRequest.array(),
  customerId: z.string().optional(),
});

export type OrderRequest = z.infer<typeof ZOrderSchema>;
export type OrderItemRequest = z.infer<typeof ZOrderItemRequest>;
