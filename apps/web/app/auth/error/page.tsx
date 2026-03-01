import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification: 'The verification token has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  };

  const message = error ? (errorMessages[error] ?? errorMessages.Default) : errorMessages.Default;

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
          {error && <p className="mt-2 text-xs text-muted-foreground font-mono">Code: {error}</p>}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/auth/signin">Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
