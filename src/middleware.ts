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
    if (userRole) {
      return NextResponse.redirect(new URL('/api/auth/logout-cleanup', request.url));
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
      admin: '/administrator',
      administrator: '/administrator',
      leader: '/leader',
      employee: '/employee',
    };

    const targetPath = roleRedirects[userRole] || '/employee';
    return NextResponse.redirect(new URL(targetPath, request.url));
  }

  // --- LOGIC 3: ป้องกันการเข้าหน้าผิดสิทธิ์ (Cross-Role Protection) ---
  let response = NextResponse.next();

  if (userId && userRole) {
    // 1. ถ้าเป็น Leader แต่หลงมาหน้า Employee
    if (pathname.startsWith('/employee') && userRole === 'leader') {
      return NextResponse.redirect(new URL('/leader', request.url));
    }

    // 2. ป้องกันระดับสิทธิ์เด็ดขาด
    if (pathname.startsWith('/leader') && userRole !== 'leader') {
      const fallback = userRole === 'employee' ? '/employee' : '/login';
      return NextResponse.redirect(new URL(fallback, request.url));
    }
    
    if (pathname.startsWith('/administrator')) {
      if (!(userRole === 'admin' || userRole === 'administrator')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    if (pathname.startsWith('/superAdmin') && userRole !== 'superAdmin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // --- LOGIC 4: ป้องกัน Browser Cache (แก้ปัญหาหน้าเก่าค้างตอนกด Back) ---
  // บังคับให้หน้าที่มีข้อมูลสำคัญไม่ถูกเก็บไว้ใน Cache ของ Browser
  if (isProtected || pathname === '/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

// กำหนดขอบเขตของ Middleware
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