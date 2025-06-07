import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const orderRequestValidator =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.safeParse(req.body);
    if (error) {
      res.status(400).json({ error: error.flatten() });
      return;
    }
    next();
  };
