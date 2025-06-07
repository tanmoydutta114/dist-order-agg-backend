// import request from "supertest";
// import { describe, it, expect } from "vitest";
// import app from "../src/index"; // export app without `.listen()`

// describe("Order API", () => {
//   it("should reject invalid payload", async () => {
//     const res = await request(app).post("/order").send({ quantity: 1 });
//     expect(res.status).toBe(400);
//   });

//   it("should place valid order", async () => {
//     const res = await request(app).post("/order").send({
//       productId: "product-1",
//       quantity: 1,
//     });
//     expect(res.status).toBe(200);
//     expect(res.body.orderId).toBeDefined();
//   });
// });
