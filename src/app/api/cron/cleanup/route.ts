// app/api/cron/cleanup/route.ts

import { cleanupExpiredOvertime } from "@/lib/over-time/overtime-status-actions";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. 🔒 เพิ่มการเช็ค Authorization (ถ้าเป็นไปได้)
    // เช่น เช็ค CRON_SECRET จาก Environment Variable ที่ตั้งไว้ใน Vercel
    const authHeader = request.headers.get('authorization');
    
    // ถ้าคุณตั้ง Cron Secret ไว้ ให้เช็คตรงนี้ (กันคนแอบรัน)
    // หมายเหตุ: มึงเปิดคอมเมนต์ตรงนี้ได้ถ้ามึงตั้งค่าใน Vercel Dashboard แล้ว
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return new Response('Unauthorized', { status: 401 });
    }

    // 2. สั่งให้ Logic หลักทำงาน
    // (มันจะวิ่งไปทำทั้ง คิดเงินรายวัน และ ล้างขยะ 7 วัน ในฟังก์ชันเดียวที่มึงเขียนไว้)
    const result = await cleanupExpiredOvertime();
    
    return NextResponse.json({ 
      success: true, 
      message: "ระบบทำความสะอาดและประมวลผล OT อัตโนมัติเสร็จสิ้น",
      timestamp: new Date().toISOString(),
      details: result // จะบอกว่าเคลียร์ Ghost ไปกี่ใบ, Execute ไปกี่รายการ
    });

  } catch (error: any) {
    // 3. บันทึก Error ให้ละเอียดขึ้นเพื่อการ Debug
    console.error("🚨 Cron Job Critical Error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: error.message 
    }, { status: 500 });
  }
}