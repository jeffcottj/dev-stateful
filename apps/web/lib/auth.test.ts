import { describe, it, expect } from 'vitest';
import { requireRole } from './auth';

describe('requireRole', () => {
  it('passes for matching role (user)', () => {
    expect(() => requireRole({ user: { role: 'user' } }, 'user')).not.toThrow();
  });

  it('passes for admin accessing admin route', () => {
    expect(() => requireRole({ user: { role: 'admin' } }, 'admin')).not.toThrow();
  });

  it('passes for admin accessing user route', () => {
    expect(() => requireRole({ user: { role: 'admin' } }, 'user')).not.toThrow();
  });

  it('throws Forbidden for insufficient role', () => {
    expect(() => requireRole({ user: { role: 'user' } }, 'admin')).toThrow('Forbidden');
  });

  it('throws Unauthenticated for null session', () => {
    expect(() => requireRole(null, 'user')).toThrow('Unauthenticated');
  });

  it('throws Unauthenticated for null session on admin route', () => {
    expect(() => requireRole(null, 'admin')).toThrow('Unauthenticated');
  });
});
