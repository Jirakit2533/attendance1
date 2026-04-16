// @/features/remarkAttendance/procedure.ts
"use server"

import { db } from "@/db/db"; 
import { attendanceTable } from "@/db/schema"; 
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * [DATABASE LAYER]
 */
async function updateRemarkInDb(attendanceId: string, remark: string) {
  const safeRemark = remark?.trim() ?? ""; 

  const result = await db
    .update(attendanceTable)
    .set({ 
      remark: safeRemark,
      // updatedAt: new Date(), // 🚩 ถ้าใน Schema ไม่มีฟิลด์นี้ ให้คอมเมนต์ออกก่อนเพื่อกัน Error
    })
    .where(eq(attendanceTable.id, attendanceId))
    .returning({ updatedId: attendanceTable.id, updatedRemark: attendanceTable.remark });

  return result;
}

/**
 * [ACTION LAYER]
 */
export async function remarkAttendanceAction(arg1: string | FormData, arg2?: string) {
  try {
    let attendanceId: string | null = null;
    let remark: string | null = "";

    if (arg1 instanceof FormData) {
      attendanceId = arg1.get("attendanceId")?.toString() || null;
      remark = arg1.get("remark")?.toString() || "";
    } else {
      attendanceId = arg1;
      remark = arg2 ?? "";
    }

    // 🔍 SERVER LOG: Knight เช็คใน Terminal ดูว่า ID มาไหม
    console.log("--- ATTEMPT UPDATE REMARK ---");
    console.log("Target ID:", attendanceId);
    console.log("Target Remark:", remark);

    if (!attendanceId || attendanceId === "null" || attendanceId === "undefined" || attendanceId === "") {
      throw new Error("ระบบไม่ได้รับรหัสการลงเวลา (Attendance ID Is Missing)");
    }

    const updateResult = await updateRemarkInDb(attendanceId, remark);

    if (!updateResult || updateResult.length === 0) {
      throw new Error(`ไม่พบรายการลงเวลารหัส ${attendanceId} ในฐานข้อมูล`);
    }

    console.log("✅ UPDATE SUCCESS:", updateResult[0]);

    // 🚩 เปลี่ยนการ Revalidate: 
    // บางครั้งการใช้ "layout" อาจทำให้ Next.js พยายามดึงข้อมูลหนักเกินไปจน Fetch Failed
    // ลองใช้แบบระบุ Path ตรงๆ หรือลดขอบเขตลงครับ
    revalidatePath("/employee", "page"); 
    revalidatePath("/leader", "page");

    return { 
        success: true, 
        id: updateResult[0].updatedId,
        remark: updateResult[0].updatedRemark 
    };
  } catch (error: any) {
    console.error("❌ Remark Action Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * [QUERY LAYER]
 */
export async function getInitialRemarkProcedure(attendanceId: string) {
    // ... โค้ดเดิมดีอยู่แล้วครับ ...
    if (!attendanceId || typeof attendanceId !== "string") return "";
    try {
      const [data] = await db
        .select({ remark: attendanceTable.remark })
        .from(attendanceTable)
        .where(eq(attendanceTable.id, attendanceId))
        .limit(1);
      return data?.remark || ""; 
    } catch (error) {
      return ""; 
    }
}