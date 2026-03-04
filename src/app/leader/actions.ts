"use server";

import { db } from "@/lib/db";
import { leaveTable, attendanceTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * ฟังก์ชันช่วยแปลง Date เป็นสตริงเวลา HH:mm:ss (เวลาไทย)
 */
const getTimeString = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', { //ใช้ en-GB เพื่อให้ได้ฟอร์แมต 24 ชม. ที่แน่นอน
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
};

/**
 * ฟังก์ชันช่วยแปลง Date เป็น ISO String แบบไทย (YYYY-MM-DD HH:mm:ss)
 */
const getFullDateTimeString = (date: Date) => {
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const timePart = getTimeString(date);
  return `${datePart} ${timePart}`;
};

/**
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out)
 */
export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string; 
  fileId?: string; 
  location: string;
  departmentId: string;
  siteId: string | null;
}) {
  try {
    const now = new Date();
    
    // สร้างวันที่ YYYY-MM-DD
    const todayDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); 

    const timeStr = getTimeString(now);

    if (data.type === "IN") {
      await db.insert(attendanceTable).values({
        user_id: data.userId,
        department_id: data.departmentId,
        site_id: data.siteId,
        date: todayDate,
        checkIn: timeStr,
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
      });
    } else {
      const result = await db.update(attendanceTable)
        .set({
          checkOut: new Date(), // Drizzle จะจัดการเรียก .toISOString() ให้เองโดยไม่ error
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
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินของวันนี้" };
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Attendance error:", error);
    return { success: false, error: "บันทึกเวลาไม่สำเร็จ: " + (error.message || "Unknown Error") };
  }
}

/**
 * 2. ส่งคำขอลางาน
 */
export async function createLeaveRequestAction(data: {
  userId: string;
  departmentId: string;
  siteId: string | null;
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
      department_id: data.departmentId,
      site_id: data.siteId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: "pending", 
      fileUrl: data.fileUrl || "no-file",
      fileId: data.fileId || "no-id",
      fileName: data.fileName || "no-name",
    });

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Create leave error:", error);
    return { success: false, error: "ส่งคำขอลาไม่สำเร็จ" };
  }
}

/**
 * 3. อัปเดตสถานะการลา (อนุมัติ / ปฏิเสธ)
 * แก้ไข: ใช้ String แทน Date Object เพื่อป้องกัน Error .toISOString()
 */
export async function updateLeaveStatusAction(
  leaveId: string, 
  newStatus: "approved" | "rejected" | "pending",
  adminOrLeaderId: string
) {
  try {
    const now = new Date();
    const timeStampStr = getFullDateTimeString(now);

    const updatePayload: any = { 
      status: newStatus,
      // บันทึกเป็น String แทนการส่ง Date Object เข้าไปตรงๆ
      approvedBy: newStatus === "approved" ? adminOrLeaderId : null,
      approvedAt: newStatus === "approved" ? timeStampStr : null,
      rejectedBy: newStatus === "rejected" ? adminOrLeaderId : null,
      rejectedAt: newStatus === "rejected" ? timeStampStr : null,
    };

    await db.update(leaveTable)
      .set(updatePayload)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Update leave error:", error);
    return { success: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}