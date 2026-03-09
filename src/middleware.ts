import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('session_user_id')?.value;
  const userRole = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // รายการ Path ที่ต้องมีการ Login ก่อนเข้าถึง
  const protectedPaths = ['/employee', '/leader', '/administrator', '/superAdmin'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  // --- LOGIC 0: ปล่อยให้ API และ Internal Path ทำงานได้เสมอ ---
  if (
    pathname.startsWith('/api/auth/logout-cleanup') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // --- LOGIC 1: ถ้ายังไม่ได้ Login แต่อยากเข้าหน้า Protected ---
  if (isProtected && !userId) {
    // ถ้ามี Role ค้างแต่ไม่มี ID ให้ไปล้างค่าก่อน
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
  if (userId && userRole) {
    // 1. ถ้าเป็น Leader แต่หลงมาหน้า Employee (ให้ไปหน้า Leader แทน)
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

  // --- LOGIC 4: จัดการ Response และป้องกัน Browser Cache ---
  const response = NextResponse.next();

  if (isProtected || pathname === '/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

// --- CONFIG: ปรับ Matcher ให้รองรับ Server Actions (แก้ 404 บน Vercel) ---
export const config = {
  matcher: [
    /*
     * ตรวจสอบทุกเส้นทางยกเว้นไฟล์ Static และ API ที่ไม่เกี่ยวข้อง
     * วิธีนี้จะช่วยให้ Server Actions (POST) วิ่งผ่าน Middleware ไปหา Page ได้ถูกต้อง
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};