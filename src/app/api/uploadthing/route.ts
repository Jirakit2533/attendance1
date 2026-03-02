import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

// ไฟล์นี้ทำหน้าที่เป็น "ทางผ่าน" (Route Handler) เท่านั้น
// โดยจะไปดึงการตั้งค่าทั้งหมด (Router) มาจากไฟล์ core.ts 
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});