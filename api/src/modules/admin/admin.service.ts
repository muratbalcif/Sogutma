import { ConflictException, Injectable } from '@nestjs/common';
import { AdminRoleCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_PERMISSION_CODES,
  ACCOUNTING_PERMISSION_CODES,
  CUSTOMER_MANAGER_PERMISSION_CODES,
  ORDER_MANAGER_PERMISSION_CODES,
  PRODUCT_MANAGER_PERMISSION_CODES,
  STOCK_MANAGER_PERMISSION_CODES,
} from './constants/permissions';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessForUser(userId: string): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!adminUser) {
      return { roles: [], permissions: [] };
    }

    const roles = adminUser.roles.map((item) => item.role.code);

    // SUPER_ADMIN always receives the full permission catalog so admin UI
    // menus work even when admin_role_permissions rows were never seeded.
    if (roles.includes(AdminRoleCode.SUPER_ADMIN)) {
      return {
        roles,
        permissions: [...ADMIN_PERMISSION_CODES],
      };
    }

    const permissions = [
      ...new Set(
        adminUser.roles.flatMap((item) =>
          item.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    return { roles, permissions };
  }

  async ensureRbacCatalog(): Promise<void> {
    for (const code of ADMIN_PERMISSION_CODES) {
      await this.prisma.adminPermission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    for (const code of Object.values(AdminRoleCode)) {
      await this.prisma.adminRole.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
    }

    const permissions = await this.prisma.adminPermission.findMany();
    const permissionByCode = new Map(
      permissions.map((permission) => [permission.code, permission]),
    );

    const superAdmin = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.SUPER_ADMIN },
    });

    for (const permission of permissions) {
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdmin.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      });
    }

    const productManager = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.PRODUCT_MANAGER },
    });

    for (const code of PRODUCT_MANAGER_PERMISSION_CODES) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        continue;
      }
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: productManager.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: productManager.id,
          permissionId: permission.id,
        },
      });
    }

    const orderManager = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.ORDER_MANAGER },
    });

    for (const code of ORDER_MANAGER_PERMISSION_CODES) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        continue;
      }
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: orderManager.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: orderManager.id,
          permissionId: permission.id,
        },
      });
    }

    const accounting = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.ACCOUNTING },
    });

    for (const code of ACCOUNTING_PERMISSION_CODES) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        continue;
      }
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: accounting.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: accounting.id,
          permissionId: permission.id,
        },
      });
    }

    const customerManager = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.CUSTOMER_MANAGER },
    });

    for (const code of CUSTOMER_MANAGER_PERMISSION_CODES) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        continue;
      }
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: customerManager.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: customerManager.id,
          permissionId: permission.id,
        },
      });
    }

    const stockManager = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: AdminRoleCode.STOCK_MANAGER },
    });

    for (const code of STOCK_MANAGER_PERMISSION_CODES) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        continue;
      }
      await this.prisma.adminRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: stockManager.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: stockManager.id,
          permissionId: permission.id,
        },
      });
    }
  }

  async assignRoleToUser(
    userId: string,
    roleCode: AdminRoleCode,
  ): Promise<void> {
    const role = await this.prisma.adminRole.findUniqueOrThrow({
      where: { code: roleCode },
    });

    const adminUser = await this.prisma.adminUser.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await this.prisma.adminUserRole.upsert({
      where: {
        adminUserId_roleId: {
          adminUserId: adminUser.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        adminUserId: adminUser.id,
        roleId: role.id,
      },
    });
  }

  async removeRoleFromUser(
    userId: string,
    roleCode: AdminRoleCode,
  ): Promise<void> {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId },
    });
    if (!adminUser) {
      return;
    }

    const role = await this.prisma.adminRole.findUnique({
      where: { code: roleCode },
    });
    if (!role) {
      return;
    }

    if (roleCode === AdminRoleCode.SUPER_ADMIN) {
      const assignment = await this.prisma.adminUserRole.findFirst({
        where: { adminUserId: adminUser.id, roleId: role.id },
      });
      if (assignment) {
        const superAdminCount = await this.prisma.adminUserRole.count({
          where: { roleId: role.id },
        });
        if (superAdminCount <= 1) {
          throw new ConflictException(
            'Cannot remove or demote the last SUPER_ADMIN',
          );
        }
      }
    }

    await this.prisma.adminUserRole.deleteMany({
      where: {
        adminUserId: adminUser.id,
        roleId: role.id,
      },
    });
  }

  async listRoles(): Promise<Array<{ code: AdminRoleCode; id: string }>> {
    const roles = await this.prisma.adminRole.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true },
    });
    return roles;
  }

  async listAdminUsers(): Promise<
    Array<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: AdminRoleCode[];
    }>
  > {
    const rows = await this.prisma.adminUser.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      userId: row.user.id,
      email: row.user.email,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      roles: row.roles.map((r) => r.role.code),
    }));
  }

  async lookupUserByEmail(email: string): Promise<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) {
      return null;
    }
    return this.toUserSummary(user);
  }

  async getUserSummary(userId: string): Promise<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) {
      return null;
    }
    return this.toUserSummary(user);
  }

  private async toUserSummary(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  }> {
    const access = await this.getAccessForUser(user.id);
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: access.roles,
    };
  }
}
