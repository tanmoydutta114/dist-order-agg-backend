import { Request, Response, NextFunction } from "express";

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { method, url, body } = req;
  const timestamp = new Date().toISOString();

  const logParts = [`[${timestamp}]`, method, url];

  if (
    ["POST", "PUT", "PATCH"].includes(method.toUpperCase()) &&
    Object.keys(body).length
  ) {
    logParts.push(`Body: ${JSON.stringify(body)}`);
  }

  console.log(logParts.join(" | "));
  next();
};
