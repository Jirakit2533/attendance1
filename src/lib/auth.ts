// src/lib/auth.ts
import { cookies } from "next/headers";
import { db } from "@/db/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  const userRole = cookieStore.get("user_role")?.value; // ดึง role มาตรวจสอบความสอดคล้อง

  // ถ้าไม่มี userId หรือไม่มี userRole (Zombie Cookie) ให้ถือว่าไม่ได้ Login
  if (!userId || !userRole) return null;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) return null;

    // ตรวจสอบว่า Role ใน Cookie ตรงกับใน Database หรือไม่ (ป้องกัน Session ค้างจากสิทธิ์เก่า)
    // ใช้ .toLowerCase() เพื่อให้ยืดหยุ่นตาม Middleware ที่แก้ไขไปก่อนหน้า
    if (user.role.toLowerCase() !== userRole.toLowerCase()) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}