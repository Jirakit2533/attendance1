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
    // แก้ไข: เพิ่ม parameter error เพื่อให้ UI แสดงแจ้งเตือน และลบคุกกี้ที่ค้างอยู่ทิ้งทันที
    if (userRole) {
      const response = NextResponse.redirect(new URL('/login?error=session_expired', request.url));
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

    // ใช้ .trim() เพื่อป้องกันกรณีมี Space หลุดมาจาก DB เก่า
    const roleKey = userRole.trim();
    const targetPath = roleRedirects[roleKey] || roleRedirects[roleKey.toLowerCase()] || '/employee';
    return NextResponse.redirect(new URL(targetPath, request.url));
  }

  // --- LOGIC 3: ป้องกันการเข้าหน้าผิดสิทธิ์ (Cross-Role Protection) ---
  let response = NextResponse.next();

  if (userId && userRole) {
    // ใช้ .trim() และ .toLowerCase() เพื่อให้ข้อมูลเก่า-ใหม่เช็คได้ตรงกันเสมอ
    const role = userRole.trim().toLowerCase();

    // 1. ถ้าเป็น Leader แต่หลงมาหน้า Employee
    if (pathname.startsWith('/employee') && role === 'leader') {
      return NextResponse.redirect(new URL('/leader', request.url));
    }

    // 2. ป้องกันระดับสิทธิ์เด็ดขาด
    if (pathname.startsWith('/leader') && role !== 'leader') {
      const fallback = role === 'employee' ? '/employee' : '/login?error=session_expired';
      return NextResponse.redirect(new URL(fallback, request.url));
    }

    if (pathname.startsWith('/administrator')) {
      if (!(role === 'admin' || role === 'admin')) {
        return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
      }
    }

    if (pathname.startsWith('/superAdmin')) {
      if (!['superadmin', 'super_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
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