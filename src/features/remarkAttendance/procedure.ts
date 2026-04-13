// @/features/remarkAttendance/procedure.ts
"use server"

import { db } from "@/db/db"; 
import { revalidatePath } from "next/cache";

/**
 * [DATABASE LAYER]
 * ฟังก์ชันภายในสำหรับจัดการข้อมูลในฐานข้อมูล
 */
async function updateRemarkInDb(attendanceId: string, remark: string) {
  return await db.attendance.update({
    where: { id: attendanceId },
    data: { 
      remark: remark,
      updatedAt: new Date(),
    },
  });
}

/**
 * [ACTION LAYER]
 * Server Action สำหรับรับข้อมูลจาก Form (หน้าบ้าน)
 */
export async function remarkAttendanceAction(formData: FormData) {
  try {
    const attendanceId = formData.get("attendanceId") as string;
    const remark = formData.get("remark") as string;

    if (!attendanceId) {
      throw new Error("Missing Attendance ID");
    }

    // เรียกฟังก์ชันจัดการ DB ภายในไฟล์เดียวกัน
    await updateRemarkInDb(attendanceId, remark);

    // Refresh ข้อมูลให้เป็นปัจจุบันในทุกหน้าที่เกี่ยวข้อง
    revalidatePath("/attendance-report"); 
    revalidatePath("/employee/attendance");
    revalidatePath("/leader/attendance");

    return { success: true };
  } catch (error) {
    console.error("Remark Error:", error);
    return { success: false, error: "ไม่สามารถบันทึกหมายเหตุได้" };
  }
}


export async function getInitialRemarkProcedure(attendanceId: string) {
    try {
      // ป้องกันกรณีไม่มี ID ส่งมา
      if (!attendanceId) return "";
  
      const data = await db.attendance.findUnique({
        where: { id: attendanceId },
        select: { remark: true }
      });
  
      return data?.remark || ""; // ถ้าไม่มีข้อมูลให้ส่ง string ว่างกลับไป
    } catch (error) {
      console.error("Get Remark Error:", error);
      return ""; // กรณี Error ให้ส่งค่าว่างเพื่อไม่ให้หน้าจอพัง
    }
  }