import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. ใน Next.js 16 เป็นต้นไป cookies() เป็น Promise ต้องใช้ await เท่านั้น
  const cookieStore = await cookies();
  
  // 2. สั่งลบคุกกี้ทุกใบที่เกี่ยวข้องกับระบบ Login
  // ในเวอร์ชันใหม่ การลบจะมีผลทันทีเมื่อฟังก์ชันนี้ทำงานเสร็จ
  cookieStore.delete('session_user_id');
  cookieStore.delete('user_role');

  // 3. สร้าง Response และกำหนดให้ Redirect ไปหน้า Login
  const loginUrl = new URL('/login', request.url);
  
  // เพิ่ม Parameter เพื่อไปแสดงแจ้งเตือนที่หน้า Login
  loginUrl.searchParams.set('error', 'session_expired');
  
  const response = NextResponse.redirect(loginUrl);

  // 4. ปรับ Header เพื่อบังคับไม่ให้ Browser เก็บ Cache หน้าเดิมไว้
  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}