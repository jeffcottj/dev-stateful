import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signIn } from '@/auth';

export default function SignInPage() {
  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Choose a provider to sign in with.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              'use server';
              await signIn('google');
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
          <form
            action={async () => {
              'use server';
              await signIn('microsoft-entra-id');
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Continue with Microsoft
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
