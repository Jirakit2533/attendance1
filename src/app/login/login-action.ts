"use server";

import { cookies } from "next/headers";
import { loginAction } from "@/server/auth";

/**
 * 🔒 ล้าง Session และ Cookies เก่าออกผ่าน Server Side
 * ฟังก์ชันนี้จะถูกเรียกจาก useEffect ในหน้า LoginPage
 */
export async function clearSessionAction() {
  try {
    const cookieStore = await cookies();
    const cookiesToClear = ["session_user_id", "user_role", "role", "session"];
    
    cookiesToClear.forEach(name => {
      cookieStore.set(name, "", { 
        expires: new Date(0), 
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      });
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to clear sessions:", error);
    return { success: false };
  }
}

/**
 * 🔑 จัดการการ Login โดยเรียกผ่าน Server Action
 * รับค่าจาก FormData และส่งผลลัพธ์กลับไปที่ Client
 */
export async function handleLoginServer(formData: FormData) {
  try {
    // เรียกใช้ logic การเช็ค username/password จากไฟล์ auth หลักของคุณ
    const result = await loginAction(formData);
    
    if (result.success) {
      return { 
        success: true, 
        redirect: result.redirect 
      };
    }
    
    return { 
      success: false, 
      message: result.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" 
    };
  } catch (error) {
    console.error("Login server error:", error);
    return { 
      success: false, 
      message: "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์" 
    };
  }
}