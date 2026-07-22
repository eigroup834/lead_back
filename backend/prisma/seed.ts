import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PERMISSIONS, ROLES, resolveMatrix } from '../src/modules/roles/permissions.catalog';
import { encryptSecret } from '../src/utils/crypto';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RBAC + bootstrap admin...');

  // 1) Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, description: p.description },
      create: { key: p.key, module: p.module, description: p.description },
    });
  }

  // 2) Roles + matrix
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { label: r.label, level: r.level, isSystem: true },
      create: { name: r.name, label: r.label, level: r.level, isSystem: true },
    });

    const keys = resolveMatrix(r.name);
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });

    // reset + re-apply matrix
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((perm) => ({ roleId: role.id, permissionId: perm.id })),
      skipDuplicates: true,
    });
    console.log(`  • ${r.name}: ${perms.length} permissions`);
  }

  // 3) Department + bootstrap super admin
  const dept = await prisma.department.upsert({
    where: { name: 'Headquarters' },
    update: {},
    create: { name: 'Headquarters', description: 'Default department' },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@exhibitor.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });

  const adminHash = await bcrypt.hash(adminPassword, Number(process.env.BCRYPT_ROUNDS ?? 12));
  const adminEnc = encryptSecret(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordEnc: adminEnc },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      passwordEnc: adminEnc,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      departmentId: dept.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });

  // 4) Sync cursor row
  await prisma.syncState.upsert({
    where: { source: 'exhi_reg' },
    update: {},
    create: { source: 'exhi_reg', lastSyncedId: 0 },
  });

  console.log(`✅ Seed complete. Login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
