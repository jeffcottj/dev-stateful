export function requireRole(
  session: { user: { role: 'user' | 'admin' } } | null,
  role: 'user' | 'admin'
) {
  if (!session) throw new Error('Unauthenticated');
  if (role === 'admin' && session.user.role !== 'admin') throw new Error('Forbidden');
}
