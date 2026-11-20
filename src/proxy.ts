
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// ============================================================
// CONFIGURATION
// ============================================================

const SESSION_COOKIE = 'session_token';

const SESSION_ISSUER =
  process.env.SESSION_ISSUER ?? 'attendance-app';

const SESSION_AUDIENCE =
  process.env.SESSION_AUDIENCE ?? 'attendance-web';

const SESSION_MAX_AGE = '12h';

const PROTECTED_ROUTES = [
  '/employee',
  '/leader',
  '/administrator',
  '/superAdmin',
] as const;

type UserRole =
  | 'employee'
  | 'leader'
  | 'admin'
  | 'superadmin';

interface AuthSession {
  userId: string;
  role: UserRole;
}

// ============================================================
// ROLE NORMALIZATION
// ============================================================

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') {
    return null;
  }

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

// ============================================================
// ROUTE HELPERS
// ============================================================

function matchesPath(pathname: string, basePath: string): boolean {
  return (
    pathname === basePath ||
    pathname.startsWith(`${basePath}/`)
  );
}

function getProtectedRoute(pathname: string): string | null {
  return (
    PROTECTED_ROUTES.find((path) =>
      matchesPath(pathname, path)
    ) ?? null
  );
}

function getRoleHome(role: UserRole): string {
  const destinations: Record<UserRole, string> = {
    employee: '/employee',
    leader: '/leader',
    admin: '/administrator',
    superadmin: '/superAdmin',
  };

  return destinations[role];
}

// ============================================================
// JWT SESSION VALIDATION
// ============================================================

async function verifySession(
  token: string | undefined
): Promise<AuthSession | null> {
  if (!token) {
    return null;
  }

  try {
    const secretValue = process.env.SESSION_SECRET;

    if (!secretValue || new TextEncoder().encode(secretValue).length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 bytes');
    }

    const secret = new TextEncoder().encode(secretValue);

    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      maxTokenAge: SESSION_MAX_AGE,
      clockTolerance: 5,
      requiredClaims: ['sub', 'exp', 'iat', 'role'],
    });

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      return null;
    }

    const role = normalizeRole(payload.role);

    if (!role) {
      return null;
    }

    return {
      userId: payload.sub,
      role,
    };
  } catch {
    // Token invalid, expired, tampered or configuration invalid.
    return null;
  }
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function applyNoStore(response: NextResponse): NextResponse {
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate, max-age=0'
  );

  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

function clearAuthCookies(response: NextResponse): NextResponse {
  // New authentication cookie
  response.cookies.delete(SESSION_COOKIE);

  // Remove legacy cookies
  response.cookies.delete('session_user_id');
  response.cookies.delete('user_role');

  return response;
}

function redirect(
  request: NextRequest,
  destination: string,
  clearCookies = false
): NextResponse {
  const response = NextResponse.redirect(
    new URL(destination, request.url)
  );

  if (clearCookies) {
    clearAuthCookies(response);
  }

  return applyNoStore(response);
}

// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedRoute = getProtectedRoute(pathname);

  const isLoginPage = pathname === '/login';

  // Only routes in this middleware's scope are processed.
  if (!protectedRoute && !isLoginPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Verify the signed session.
  const session = await verifySession(token);

  // ----------------------------------------------------------
  // 1. Protected route without a valid session
  // ----------------------------------------------------------

  if (protectedRoute && !session) {
    const response = redirect(
      request,
      '/login?error=session_expired',
      true
    );

    return response;
  }

  // ----------------------------------------------------------
  // 2. Login page
  // ----------------------------------------------------------

  if (isLoginPage) {
    // Invalid or expired token: clear it and allow login.
    if (!session) {
      const response = applyNoStore(NextResponse.next());

      clearAuthCookies(response);

      return response;
    }

    // Valid session: redirect to the user's own dashboard.
    return redirect(
      request,
      getRoleHome(session.role)
    );
  }

  // ----------------------------------------------------------
  // 3. Cross-role authorization
  // ----------------------------------------------------------

  if (session && protectedRoute) {
    const expectedRole = protectedRoute;

    const roleMatches: Record<string, UserRole> = {
      '/employee': 'employee',
      '/leader': 'leader',
      '/administrator': 'admin',
      '/superAdmin': 'superadmin',
    };

    const requiredRole = roleMatches[expectedRole];

    // Unknown protected route configuration: deny access.
    if (!requiredRole) {
      return redirect(
        request,
        '/login?error=invalid_route',
        true
      );
    }

    // User has a valid session but insufficient role.
    if (session.role !== requiredRole) {
      return redirect(
        request,
        getRoleHome(session.role)
      );
    }
  }

  // ----------------------------------------------------------
  // 4. Disable browser caching for protected pages
  // ----------------------------------------------------------

  return applyNoStore(NextResponse.next());
}

// ============================================================
// MATCHER
// ============================================================

export const config = {
  matcher: [
    '/employee/:path*',
    '/leader/:path*',
    '/administrator/:path*',
    '/superAdmin/:path*',
    '/login',
  ],
};
