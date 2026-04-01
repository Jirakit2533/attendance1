import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('session_user_id')?.value;
  const userRole = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // รายการ Path ที่ต้องมีการ Login ก่อนเข้าถึง
  const protectedPaths = ['/employee', '/leader', '/administrator', '/superAdmin'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  // --- LOGIC 0: ปล่อยให้ API Cleanup ทำงานได้เสมอ (สำคัญมาก) ---
  if (pathname.startsWith('/api/auth/logout-cleanup')) {
    return NextResponse.next();
  }

  // --- LOGIC 1: ถ้ายังไม่ได้ Login แต่อยากเข้าหน้า Protected ---
  if (isProtected && !userId) {
    // แก้ไข: ถ้าไม่มี userId แต่ยังมี userRole ค้าง (Zombie Cookie) ให้สั่งลบทิ้งทันทีแทนการวน Loop
    if (userRole) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session_user_id');
      response.cookies.delete('user_role');
      return response;
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // --- LOGIC 2: ถ้า Login อยู่แล้ว แต่พยายามจะเข้าหน้า /login ---
  if (userId && pathname === '/login') {
    if (!userRole) {
      return NextResponse.redirect(new URL('/api/auth/logout-cleanup', request.url));
    }

    // แก้ไข: เพิ่ม key ให้ครอบคลุมทุก format ที่อาจเกิดขึ้นจากฐานข้อมูลเก่า/ใหม่
    const roleRedirects: Record<string, string> = {
      superAdmin: '/superAdmin',
      superadmin: '/superAdmin',
      super_Admin: '/superAdmin',
      super_admin: '/superAdmin',
      admin: '/administrator',
      administrator: '/administrator',
      leader: '/leader',
      employee: '/employee',
    };

    // ป้องกันกรณี userRole เป็นตัวพิมพ์ใหญ่/เล็กไม่ตรงกัน
    const targetPath = roleRedirects[userRole] || roleRedirects[userRole.toLowerCase()] || '/employee';
    return NextResponse.redirect(new URL(targetPath, request.url));
  }

  // --- LOGIC 3: ป้องกันการเข้าหน้าผิดสิทธิ์ (Cross-Role Protection) ---
  let response = NextResponse.next();

  if (userId && userRole) {
    const role = userRole.toLowerCase(); // ใช้ตัวแปรช่วยเช็คเพื่อลดความผิดพลาด

    // 1. ถ้าเป็น Leader แต่หลงมาหน้า Employee
    if (pathname.startsWith('/employee') && role === 'leader') {
      return NextResponse.redirect(new URL('/leader', request.url));
    }

    // 2. ป้องกันระดับสิทธิ์เด็ดขาด
    if (pathname.startsWith('/leader') && role !== 'leader') {
      const fallback = role === 'employee' ? '/employee' : '/login';
      return NextResponse.redirect(new URL(fallback, request.url));
    }

    if (pathname.startsWith('/administrator')) {
      // เช็คได้ทั้ง 'admin' และ 'administrator'
      if (!(role === 'admin' || role === 'administrator')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    if (pathname.startsWith('/superAdmin')) {
      // เช็คทุกความเป็นไปได้ของ Super Admin
      if (!['superadmin', 'superadmin', 'super_admin', 'super_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  // --- LOGIC 4: ป้องกัน Browser Cache ---
  if (isProtected || pathname === '/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export default middleware;

export const config = {
  matcher: [
    '/employee/:path*',
    '/leader/:path*',
    '/administrator/:path*',
    '/superAdmin/:path*',
    '/login',
    '/api/auth/logout-cleanup'
  ],
};