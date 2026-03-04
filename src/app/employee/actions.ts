"use server";

import { db } from "@/db/db"; // ปรับ path ตามโปรเจกต์ของคุณ
import { attendanceTable, leaveTable } from "@/lib/schema"; // ปรับ path ตามที่เก็บ schema
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/* -------------------------------------------------------------------------- */
/* ATTENDANCE ACTIONS (เข้า/ออกงาน)                   */
/* -------------------------------------------------------------------------- */

export async function checkInAction(userId: string, image: string, location: string) {
  try {
    const now = new Date();
    // แปลงวันที่ให้เป็น Format YYYY-MM-DD สำหรับ Column date
    const dateStr = now.toISOString().split('T')[0];

    await db.insert(attendanceTable).values({
      user_id: userId,
      date: dateStr,
      checkIn: now,
      imageIn: image, // เก็บ base64
      locationIn: location,
      // imageInId: "", // ถ้ามีระบบ Cloudinary ค่อยมาใส่ ID ที่นี่
    });

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    console.error("Check-in error:", error);
    return { success: false, error: "บันทึกเข้างานล้มเหลว" };
  }
}

export async function checkOutAction(userId: string, image: string, location: string) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // หา record ของวันนี้ที่ยังไม่ได้ check-out
    await db
      .update(attendanceTable)
      .set({
        checkOut: now,
        imageOut: image,
        locationOut: location,
      })
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          eq(attendanceTable.date, dateStr)
        )
      );

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    console.error("Check-out error:", error);
    return { success: false, error: "บันทึกเลิกงานล้มเหลว" };
  }
}

/* -------------------------------------------------------------------------- */
/* LEAVE ACTIONS (การลางาน)                         */
/* -------------------------------------------------------------------------- */

export async function createLeaveRequest(data: {
  userId: string;
  type: string;
  start: string;
  end: string;
  reason: string;
}) {
  try {
    await db.insert(leaveTable).values({
      user_id: data.userId,
      type: data.type,
      startDate: data.start, // รับมาเป็น YYYY-MM-DD อยู่แล้ว
      endDate: data.end,
      reason: data.reason,
      status: "pending",
      // เนื่องจากใน Schema ตั้งเป็น .notNull() ทั้งหมด จึงต้องใส่ค่าเริ่มต้นไว้ก่อน
      fileUrl: "no-file",
      fileId: "no-id",
      fileName: "no-name",
    });

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    console.error("Leave error:", error);
    return { success: false, error: "ส่งคำขอลางานล้มเหลว" };
  }
}