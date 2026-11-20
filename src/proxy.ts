
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type UserRole = 'employee' | 'leader' | 'admin' | 'superadmin';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('session_user_id')?.value;
  const userRole = request.cookies.get('user_role')?.value;
  const { pathname } = request.nextUrl;

  // รายการ Path ที่ต้องมีการ Login ก่อนเข้าถึง
  const protectedPaths = [
    '/employee',
    '/leader',
    '/administrator',
    '/superAdmin',
  ];

  const isProtected = protectedPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );

  // ============================================================
  // ROLE HELPERS
  // ============================================================

  function normalizeRole(value: string): UserRole | null {
    const role = value.trim().toLowerCase();

    const roles: Record<string, UserRole> = {
      employee: 'employee',
      leader: 'leader',
      admin: 'admin',
      administrator: 'admin',
      superadmin: 'superadmin',
      super_admin: 'superadmin',
    };

    return roles[role] ?? null;
  }

  function getRoleHome(role: UserRole): string {
    const roleRedirects: Record<UserRole, string> = {
      employee: '/employee',
      leader: '/leader',
      admin: '/administrator',
      superadmin: '/superAdmin',
    };

    return roleRedirects[role];
  }

  // ============================================================
  // LOGIC 0: ปล่อยให้ API Cleanup ทำงานได้เสมอ
  // ============================================================

  if (pathname.startsWith('/api/auth/logout-cleanup')) {
    return NextResponse.next();
  }

  // ============================================================
  // LOGIC 1: ยังไม่ได้ Login แต่ต้องการเข้าหน้า Protected
  // ============================================================

  if (isProtected && !userId) {
    if (userRole) {
      const response = NextResponse.redirect(
        new URL('/login?error=session_expired', request.url)
      );

      response.cookies.delete('session_user_id');
      response.cookies.delete('user_role');

      return response;
    }

    return NextResponse.redirect(
      new URL('/login', request.url)
    );
  }

  // ============================================================
  // LOGIC 2: Login แล้ว แต่พยายามเข้าหน้า Login
  // ============================================================

  if (userId && pathname === '/login') {
    if (!userRole) {
      return NextResponse.redirect(
        new URL('/api/auth/logout-cleanup', request.url)
      );
    }

    const role = normalizeRole(userRole);

    if (!role) {
      const response = NextResponse.redirect(
        new URL('/login?error=invalid_role', request.url)
      );

      response.cookies.delete('session_user_id');
      response.cookies.delete('user_role');

      return response;
    }

    return NextResponse.redirect(
      new URL(getRoleHome(role), request.url)
    );
  }

  // ============================================================
  // LOGIC 3: Cross-Role Protection
  // ============================================================

  let response = NextResponse.next();

  if (userId && userRole && isProtected) {
    const role = normalizeRole(userRole);

    // Role ไม่ถูกต้อง ห้ามเข้าทุก Protected Route
    if (!role) {
      const redirectResponse = NextResponse.redirect(
        new URL('/login?error=invalid_role', request.url)
      );

      redirectResponse.cookies.delete('session_user_id');
      redirectResponse.cookies.delete('user_role');

      return redirectResponse;
    }

    // ตรวจสอบสิทธิ์ของแต่ละหน้า
    const routeRoles: Record<string, UserRole> = {
      '/employee': 'employee',
      '/leader': 'leader',
      '/administrator': 'admin',
      '/superAdmin': 'superadmin',
    };

    const requiredRole = protectedPaths.find(
      path => pathname === path || pathname.startsWith(`${path}/`)
    );

    const expectedRole = requiredRole
      ? routeRoles[requiredRole]
      : null;

    // เข้าได้เฉพาะหน้าที่ตรงกับ Role
    if (expectedRole && role !== expectedRole) {
      return NextResponse.redirect(
        new URL(getRoleHome(role), request.url)
      );
    }
  }

  // ============================================================
  // LOGIC 4: ป้องกัน Browser Cache
  // ============================================================

  if (isProtected || pathname === '/login') {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );

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
    '/api/auth/logout-cleanup',
  ],
};
