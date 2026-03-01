import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const session = auth;
      const { pathname } = nextUrl;

      if (pathname.startsWith('/admin')) {
        if (!session) return Response.redirect(new URL('/auth/signin', nextUrl));
        if (session.user.role !== 'admin') return Response.redirect(new URL('/', nextUrl));
      }
      if (pathname.startsWith('/app')) {
        if (!session) return Response.redirect(new URL('/auth/signin', nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
