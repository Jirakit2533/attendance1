import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // สมมติว่าคุณตั้งค่า Prisma ไว้ที่นี่

// GET: ดึงประวัติการเข้างาน
export async function GET() {
  try {
    const records = await prisma.attendance.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20, // ดึงมาแค่ 20 รายการล่าสุด
    });
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST: บันทึก Check-in หรือ Check-out
export async function POST(req: Request) {
  try {
    const { image, location, type } = await req.json();
    const now = new Date();

    if (type === "CHECK_IN") {
      const newRecord = await prisma.attendance.create({
        data: {
          date: now.toLocaleDateString('th-TH'),
          checkIn: now.toLocaleTimeString('th-TH'),
          checkOut: "-",
          location: location,
          imageUrl: image,
          position: "ฝ่ายไอที / พัฒนาซอฟต์แวร์",
        },
      });
      return NextResponse.json(newRecord);
    } 
    
    if (type === "CHECK_OUT") {
      // หา Record ล่าสุดของวันนี้ที่ยังไม่ได้ Check-out
      const lastRecord = await prisma.attendance.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (lastRecord) {
        const updated = await prisma.attendance.update({
          where: { id: lastRecord.id },
          data: {
            checkOut: now.toLocaleTimeString('th-TH'),
            checkOutImageUrl: image,
          },
        });
        return NextResponse.json(updated);
      }
    }
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}