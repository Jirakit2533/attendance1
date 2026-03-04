import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // นำเข้าจากไฟล์ db.ts ที่เราสร้างไว้
import { attendance } from "@/lib/schema"; // นำเข้า table attendance จาก schema.ts
import { desc, eq, and, isNull } from "drizzle-orm"; // นำเข้า helper สำหรับคำสั่ง SQL

// GET: ดึงประวัติการเข้างาน
export async function GET() {
  try {
    const records = await db
      .select()
      .from(attendance)
      .orderBy(desc(attendance.createdAt))
      .limit(20); // ดึงมาแค่ 20 รายการล่าสุด

    return NextResponse.json(records);
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST: บันทึก Check-in หรือ Check-out
export async function POST(req: Request) {
  try {
    const { image, location, type, userId } = await req.json();
    const now = new Date();

    if (type === "CHECK_IN") {
      const newRecord = await db.insert(attendance).values({
        // userId: userId, // หากใน schema มี userId ให้ใส่เพิ่มตรงนี้
        date: now.toLocaleDateString('th-TH'),
        checkIn: now.toLocaleTimeString('th-TH'),
        checkOut: "-",
        location: location,
        imageUrl: image,
        position: "ฝ่ายไอที / พัฒนาซอฟต์แวร์",
        createdAt: now,
      }).returning(); // คืนค่าข้อมูลที่ถูก insert กลับมา

      return NextResponse.json(newRecord[0]);
    } 

    if (type === "CHECK_OUT") {
      // หา Record ล่าสุดที่ยังไม่ได้ Check-out (หรือใช้ id จากหน้าบ้านส่งมา)
      const lastRecord = await db
        .select()
        .from(attendance)
        .orderBy(desc(attendance.createdAt))
        .limit(1);

      if (lastRecord.length > 0) {
        const updated = await db
          .update(attendance)
          .set({
            checkOut: now.toLocaleTimeString('th-TH'),
            checkOutImageUrl: image,
          })
          .where(eq(attendance.id, lastRecord[0].id))
          .returning();

        return NextResponse.json(updated[0]);
      }
      
      return NextResponse.json({ error: "No check-in record found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}