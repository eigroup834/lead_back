import { prisma } from '@config/prisma';
import { AppError } from '@utils/AppError';

export async function assertAssignableUser(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!user) throw AppError.badRequest('That user is deactivated and cannot be given leads');
}

export async function filterAssignableUsers(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  const active = new Set(users.map((u) => u.id));
  return userIds.filter((id) => active.has(id));
}
