import { Nav } from '@/components/nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <>
      <Nav />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin area</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is the admin area. Only users with the admin role can access this page.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
