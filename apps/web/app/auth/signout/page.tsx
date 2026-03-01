import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';
import Link from 'next/link';

export default function SignOutPage() {
  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Are you sure you want to sign out?</p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <Button type="submit">Sign out</Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/">Cancel</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
