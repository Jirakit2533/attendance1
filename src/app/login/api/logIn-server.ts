"use server";

import { cookies } from "next/headers";
import { loginAction } from "@/server/auth";

/**
 * ล้าง Session และ Cookies เก่าออกผ่าน Server (ปลอดภัยกว่า Client)
 */
export async function clearSessionAction() {
  const cookieStore = await cookies();
  const cookiesToClear = ["session_user_id", "user_role", "role", "session"];
  
  cookiesToClear.forEach(name => {
    cookieStore.set(name, "", { 
      expires: new Date(0), 
      path: "/",
      httpOnly: true, // ป้องกันการเข้าถึงจาก Script ภายนอก
      secure: process.env.NODE_ENV === "production"
    });
  });
}

/**
 * จัดการ Login และส่งผลลัพธ์กลับไปยัง Client
 */
export async function handleLoginServer(formData: FormData) {
  try {
    const result = await loginAction(formData);
    
    if (result.success) {
      return { success: true, redirect: result.redirect };
    }
    
    return { success: false, message: result.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ" };
  }
}