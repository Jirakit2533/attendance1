import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('session_user_id')?.value;
  const userRole = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // รายการ Path ที่ต้องมีการ Login ก่อนเข้าถึง
  const protectedPaths = ['/employee', '/leader', '/administrator', '/superAdmin'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  // --- LOGIC 1: ถ้ายังไม่ได้ Login แต่อยากเข้าหน้า Protected ---
  if (isProtected && !userId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // --- LOGIC 2: ถ้า Login อยู่แล้ว แต่พยายามจะเข้าหน้า /login ---
  if (userId && pathname === '/login') {
    // กรณี Session ค้างแต่ไม่มี Role (ผิดปกติ) ให้ล้างคุกกี้แล้วปล่อยไปหน้า Login
    if (!userRole) {
      const response = NextResponse.next();
      response.cookies.delete('session_user_id');
      return response;
    }
    
    // Redirect ไปยังหน้าหลักของแต่ละ Role
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
    
    // 1. ถ้าเป็น Leader แต่หลงมาหน้า Employee (ให้เด้งกลับไปหน้า Leader)
    if (pathname.startsWith('/employee') && userRole === 'leader') {
      return NextResponse.redirect(new URL('/leader', request.url));
    }

    // 2. ป้องกันระดับสิทธิ์เด็ดขาด
    // ป้องกันหน้า Leader: เฉพาะ Leader เท่านั้นที่เข้าได้
    if (pathname.startsWith('/leader') && userRole !== 'leader') {
      const fallback = userRole === 'employee' ? '/employee' : '/login';
      return NextResponse.redirect(new URL(fallback, request.url));
    }
    
    // ป้องกันหน้า Administrator: ต้องเป็น admin หรือ administrator เท่านั้น
    if (pathname.startsWith('/administrator')) {
      if (!(userRole === 'admin' || userRole === 'administrator')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // ป้องกันหน้า SuperAdmin: ต้องเป็น superAdmin เท่านั้น
    if (pathname.startsWith('/superAdmin') && userRole !== 'superAdmin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

// กำหนดขอบเขตของ Middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png, images, etc.
     */
    '/employee/:path*',
    '/leader/:path*',
    '/administrator/:path*',
    '/superAdmin/:path*',
    '/login'
  ],
};