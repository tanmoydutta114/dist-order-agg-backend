import { getSQLClient } from "../db";

export async function getAllProducts() {
  const product = await getSQLClient()
    .selectFrom("products")
    .selectAll()
    .execute();
  return { isSuccess: true, data: product };
}
