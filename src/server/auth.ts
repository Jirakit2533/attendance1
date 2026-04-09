"use server";

import { db } from "@/db/db";
import { superAdminTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    const cookieStore = await cookies();

    // เคลียร์คุกกี้เก่าออกก่อนเพื่อป้องกัน Session ค้าง (เพิ่มความชัวร์ด้วย maxAge: 0)
    cookieStore.set("session_user_id", "", { path: "/", maxAge: 0 });
    cookieStore.set("user_role", "", { path: "/", maxAge: 0 });

    // --- 1. ตรวจสอบในตาราง Super Admin ---
    const [superAdmin] = await db
      .select()
      .from(superAdminTable)
      .where(eq(superAdminTable.userName, username))
      .limit(1);

    if (superAdmin && (await bcrypt.compare(password, superAdmin.passwordHash))) {
      // ปรับเป็นตัวพิมพ์เล็กเพื่อให้สอดคล้องกับ Middleware และระบบตรวจสอบใหม่
      const role = superAdmin.role.toLowerCase(); 

      cookieStore.set("session_user_id", superAdmin.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
        sameSite: "lax", // เพิ่มความปลอดภัยในการส่ง Cookie
      });
      cookieStore.set("user_role", role, {
        httpOnly: false, 
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
        sameSite: "lax",
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
      // บังคับเป็นตัวพิมพ์เล็กเสมอเพื่อป้องกันความผิดพลาดจากข้อมูลเก่าใน DB
      const role = user.role.toLowerCase(); 
      
      cookieStore.set("session_user_id", user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
        sameSite: "lax",
      });

      cookieStore.set("user_role", role, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
        sameSite: "lax",
      });

      // Mapping เส้นทางตามบทบาท (รองรับทั้งชื่อเก่าและชื่อใหม่)
      const redirectMap: Record<string, string> = {
        superadmin: "/superAdmin",
        super_admin: "/superAdmin",
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
    return { success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรูณาตรวจสอบอินเตอร์เน็ต" };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    
    // เคลียร์ค่าด้วย maxAge: 0 และระบุ Path ให้ชัดเจนเพื่อลบ Cookie ทุกระดับ
    cookieStore.set("session_user_id", "", { path: "/", maxAge: 0 });
    cookieStore.set("user_role", "", { path: "/", maxAge: 0 });

    return { success: true };
  } catch (err) {
    return { success: false };
  }
}