import { auth } from '@/auth';
import { UserMenu } from '@/components/user-menu';
import Link from 'next/link';

export async function Nav() {
  const session = await auth();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-semibold text-foreground hover:text-muted-foreground transition-colors"
        >
          dev-stateful
        </Link>
        {session ? (
          <UserMenu
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
              role: session.user.role,
            }}
          />
        ) : (
          <Link
            href="/auth/signin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
