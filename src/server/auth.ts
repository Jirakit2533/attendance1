"use server";

import { db } from "@/db/db";
import { superAdminTable, usersTable } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    const cookieStore = await cookies();

    // เคลียร์คุกกี้เก่าออกก่อนเพื่อป้องกัน Session ค้าง
    cookieStore.delete("session_user_id");
    cookieStore.delete("user_role");

    // --- 1. ตรวจสอบในตาราง Super Admin ---
    const [superAdmin] = await db
      .select()
      .from(superAdminTable)
      .where(eq(superAdminTable.userName, username))
      .limit(1);

    if (superAdmin && (await bcrypt.compare(password, superAdmin.passwordHash))) {
      // ✅ ดึงค่า role จาก DB (ที่คุณเพิ่งเพิ่มเข้าไป เช่น 'superAdmin')
      const role = superAdmin.role; 

      cookieStore.set("session_user_id", superAdmin.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
      cookieStore.set("user_role", role, {
        httpOnly: false, 
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      return { 
        success: true, 
        role: role, 
        redirect: "/superAdmin",
        userId: superAdmin.id 
      };
    }

    // --- 2. ตรวจสอบในตาราง Users ทั่วไป ---
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.userName, username))
      .limit(1);

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // ปรับเป็นตัวพิมพ์เล็กเพื่อให้เปรียบเทียบกับ redirectMap ง่ายขึ้น
      const role = user.role.toLowerCase(); 
      
      cookieStore.set("session_user_id", user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
      });

      cookieStore.set("user_role", role, {
        httpOnly: false,
        maxAge: 60 * 60 * 24,
        path: "/",
      });

      // Mapping เส้นทางตามบทบาท
      const redirectMap: Record<string, string> = {
        superadmin: "/superAdmin",
        admin: "/administrator",
        administrator: "/administrator",
        leader: "/leader",
        employee: "/employee",
      };

      return { 
        success: true, 
        role: role, 
        redirect: redirectMap[role] || "/employee",
        userId: user.id
      };
    }

    return { success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  } catch (err) {
    console.error("Login Error:", err);
    return { success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ" };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session_user_id");
    cookieStore.delete("user_role");
    
    // เคลียร์ค่าว่างซ้ำอีกครั้งเพื่อความชัวร์ในบาง Browser
    cookieStore.set("session_user_id", "", { path: "/", maxAge: 0 });
    cookieStore.set("user_role", "", { path: "/", maxAge: 0 });

    return { success: true };
  } catch (err) {
    return { success: false };
  }
}