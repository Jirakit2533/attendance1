"use server";

import { db } from "@/db/db";
import { leaveTable } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getLeaveHistory(userId: string) {
  return await db.query.leaveTable.findMany({
    where: eq(leaveTable.user_id, userId),
    orderBy: [desc(leaveTable.startDate)],
  });
}

export async function createLeaveRequest(data: {
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  try {
    await db.insert(leaveTable).values({
      user_id: data.userId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: "pending", // ค่าเริ่มต้นจาก Enum
    });

    revalidatePath("/employee");
    return { success: true };
  } catch (error) {
    return { success: false, message: "ส่งใบลาไม่สำเร็จ" };
  }
}