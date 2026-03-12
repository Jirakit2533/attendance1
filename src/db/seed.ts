import { db } from "../db/db"; // ปรับ path ให้ตรงกับไฟล์ db connection ของคุณ
import { superAdminTable } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 เริ่มต้นการ Seed ข้อมูล Super Admin...");

  // 1. กำหนดข้อมูลที่ต้องการ
  const username = "jirakit2533";
  const password = "Jirakitnice2533"; // 👈 เปลี่ยนรหัสผ่านตรงนี้ตามต้องการ
  const name = "จิรกฤต นุชส่งศิลป์";

  // 2. Hash รหัสผ่าน
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // 3. บันทึกลง Database
    await db.insert(superAdminTable).values({
      userName: username,
      passwordHash: hashedPassword,
      name: name,
    });

    console.log("✅ สร้าง Super Admin สำเร็จ!");
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error("❌ Seed ไม่สำเร็จ:", error);
  }
}

seed();


// คำสั่ง seed = bun --env-file=.env tsx src/db/seed.ts