import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id';
import { db, users } from '@repo/db';
import { sql } from 'drizzle-orm';
import { config } from '@repo/config';
import { authConfig } from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: 'user' | 'admin';
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: config.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: config.GOOGLE_CLIENT_ID!,
      clientSecret: config.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraId({
      clientId: config.ENTRA_CLIENT_ID!,
      clientSecret: config.ENTRA_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${config.ENTRA_TENANT_ID ?? 'common'}/v2.0/`,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.email) {
        const [dbUser] = await db
          .insert(users)
          .values({
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              name: sql`excluded.name`,
              image: sql`excluded.image`,
              lastSeenAt: sql`now()`,
            },
          })
          .returning({ id: users.id, role: users.role });
        token.id = dbUser.id;
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as 'user' | 'admin';
      return session;
    },
  },
});
