"use server";

import { db } from "@/db";
import { leaveTable, attendanceTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out)
 * ปรับปรุง: รองรับการเช็ค Record เดิมก่อนอัปเดต และใช้ Timezone ที่แม่นยำ
 */
export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string; 
  fileId?: string; 
  location: string;
}) {
  try {
    const now = new Date();
    // สร้างวันที่ YYYY-MM-DD ตามเวลาไทย
    const todayDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); 

    if (data.type === "IN") {
      // ตรวจสอบก่อนว่าวันนี้ Check-in ไปหรือยัง (ป้องกันการ Insert ซ้ำ)
      await db.insert(attendanceTable).values({
        user_id: data.userId,
        date: todayDate,
        checkIn: now,
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
      });
    } else {
      // อัปเดตข้อมูลขาออก โดยอ้างอิง User ID และวันที่ปัจจุบัน
      const result = await db.update(attendanceTable)
        .set({
          checkOut: now,
          imageOut: data.image,
          imageOutId: data.fileId || null,  
          locationOut: data.location,
        })
        .where(
          and(
            eq(attendanceTable.user_id, data.userId),
            eq(attendanceTable.date, todayDate)
          )
        );
      
      if (result.rowCount === 0) {
        return { success: false, error: "ไม่พบข้อมูลการเข้างานของวันนี้ ไม่สามารถบันทึกเวลาออกได้" };
      }
    }

    // ล้าง Cache หน้าที่เกี่ยวข้อง
    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/administrator"); 
    
    return { success: true };
  } catch (error: any) {
    console.error("Attendance error:", error);
    return { success: false, error: "บันทึกเวลาไม่สำเร็จ: " + (error.message || "") };
  }
}

/**
 * 2. ส่งคำขอลางาน
 * ปรับปรุง: ตรวจสอบความครบถ้วนของข้อมูลไฟล์ตาม Schema (.notNull)
 */
export async function createLeaveRequestAction(data: {
  userId: string;
  type: string;
  startDate: string; 
  endDate: string;   
  reason: string;
  fileUrl?: string;
  fileId?: string;
  fileName?: string;
}) {
  try {
    await db.insert(leaveTable).values({
      user_id: data.userId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: "รออนุมัติ", 
      // ใส่ค่า default ในกรณีที่ไม่มีไฟล์ เพื่อไม่ให้ติด constraint .notNull()
      fileUrl: data.fileUrl || "no-file",
      fileId: data.fileId || "no-id",
      fileName: data.fileName || "no-name",
    });

    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/administrator");

    return { success: true };
  } catch (error: any) {
    console.error("Create leave error:", error);
    return { success: false, error: "ส่งคำขอลาไม่สำเร็จ: " + (error.message || "") };
  }
}

/**
 * 3. อัปเดตสถานะการลา (อนุมัติ / ปฏิเสธ)
 * ปรับปรุง: จัดการ Field approvedBy และ rejectedBy ให้สัมพันธ์กับสถานะ
 */
export async function updateLeaveStatusAction(
  leaveId: string, 
  newStatus: "อนุมัติแล้ว" | "ปฏิเสธ" | "รออนุมัติ",
  adminOrLeaderId: string
) {
  try {
    // กำหนดค่าผู้ดำเนินการตามสถานะที่เลือก
    const updatePayload: any = { 
      status: newStatus,
      // ถ้าอนุมัติ ให้เซ็ต approvedBy และล้าง rejectedBy (ถ้าเคยมี)
      approvedBy: newStatus === "อนุมัติแล้ว" ? adminOrLeaderId : null,
      // ถ้าปฏิเสธ ให้เซ็ต rejectedBy และล้าง approvedBy (ถ้าเคยมี)
      rejectedBy: newStatus === "ปฏิเสธ" ? adminOrLeaderId : null,
    };

    await db.update(leaveTable)
      .set(updatePayload)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/administrator");

    return { success: true };
  } catch (error: any) {
    console.error("Update leave error:", error);
    return { success: false, error: "ไม่สามารถอัปเดตสถานะได้: " + (error.message || "") };
  }
}