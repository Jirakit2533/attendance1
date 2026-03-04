import { NextResponse } from "next/server";
import { db } from "@/db/db"; 
import { attendanceTable } from "@/db/schema"; 
import { desc, eq } from "drizzle-orm";

// GET: ดึงประวัติการเข้างาน
export async function GET() {
  try {
    const records = await db
      .select()
      .from(attendanceTable)
      .orderBy(desc(attendanceTable.createdAt))
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
    const { image, location, type } = await req.json();
    const now = new Date();

    if (type === "CHECK_IN") {
      const newRecord = await db.insert(attendanceTable).values({
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
      // หา Record ล่าสุดของวันนี้ที่ยังไม่ได้ Check-out
      const lastRecord = await db
        .select()
        .from(attendanceTable)
        .orderBy(desc(attendanceTable.createdAt))
        .limit(1);

      if (lastRecord.length > 0) {
        const updated = await db
          .update(attendanceTable)
          .set({
            checkOut: now.toLocaleTimeString('th-TH'),
            checkOutImageUrl: image,
          })
          .where(eq(attendanceTable.id, lastRecord[0].id))
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