import { useAppSelector } from '@/store';

// Permission helper bound to the authenticated user's permission set.
export function usePermissions() {
  const user = useAppSelector((s) => s.auth.user);
  const set = new Set(user?.permissions ?? []);
  return {
    user,
    has: (perm?: string) => !perm || set.has(perm),
    hasAny: (...perms: string[]) => perms.some((p) => set.has(p)),
    level: user?.level ?? 99,
  };
}
