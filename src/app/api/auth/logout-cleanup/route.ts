import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies();
  
  // 1. สั่งลบคุกกี้ทุกใบที่เกี่ยวข้องกับระบบ Login
  // ระบุชื่อคุกกี้ให้ตรงกับที่ใช้ใน Middleware (session_user_id และ user_role)
  cookieStore.delete('session_user_id');
  cookieStore.delete('user_role');

  // 2. สร้าง Response และกำหนดให้ Redirect ไปหน้า Login
  const loginUrl = new URL('/login', request.url);
  
  // เพิ่ม Parameter เพื่อไปแสดงแจ้งเตือนที่หน้า Login (ถ้าต้องการ)
  loginUrl.searchParams.set('error', 'session_expired');
  
  const response = NextResponse.redirect(loginUrl);

  // 3. ปรับ Header เพื่อบังคับให้ Browser ล้างคุกกี้ทันที (เน้นย้ำความชัวร์สำหรับมือถือ)
  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}