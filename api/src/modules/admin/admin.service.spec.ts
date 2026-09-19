import { ConflictException } from '@nestjs/common';
import { AdminRoleCode } from '@prisma/client';
import { AdminService } from './admin.service';
import { ADMIN_PERMISSION_CODES } from './constants/permissions';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
    },
    adminRole: {
      findUnique: jest.fn(),
    },
    adminUserRole: {
      findFirst: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const service = new AdminService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccessForUser', () => {
    it('returns full permission catalog for SUPER_ADMIN', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        roles: [
          {
            role: {
              code: AdminRoleCode.SUPER_ADMIN,
              permissions: [],
            },
          },
        ],
      });

      const access = await service.getAccessForUser('user-1');

      expect(access.roles).toEqual([AdminRoleCode.SUPER_ADMIN]);
      expect(access.permissions).toEqual([...ADMIN_PERMISSION_CODES]);
      expect(access.permissions).toContain('product.read');
      expect(access.permissions).toContain('order.read');
    });

    it('returns only linked permissions for non-super roles', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        roles: [
          {
            role: {
              code: AdminRoleCode.PRODUCT_MANAGER,
              permissions: [
                { permission: { code: 'product.read' } },
                { permission: { code: 'product.update' } },
              ],
            },
          },
        ],
      });

      const access = await service.getAccessForUser('user-2');

      expect(access.roles).toEqual([AdminRoleCode.PRODUCT_MANAGER]);
      expect(access.permissions).toEqual(['product.read', 'product.update']);
    });
  });

  describe('removeRoleFromUser', () => {
    it('blocks demoting the last SUPER_ADMIN', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({ id: 'au1' });
      prisma.adminRole.findUnique.mockResolvedValue({
        id: 'role-sa',
        code: AdminRoleCode.SUPER_ADMIN,
      });
      prisma.adminUserRole.findFirst.mockResolvedValue({ id: 'link1' });
      prisma.adminUserRole.count.mockResolvedValue(1);

      await expect(
        service.removeRoleFromUser('user-1', AdminRoleCode.SUPER_ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.adminUserRole.deleteMany).not.toHaveBeenCalled();
    });

    it('allows demoting SUPER_ADMIN when another remains', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({ id: 'au1' });
      prisma.adminRole.findUnique.mockResolvedValue({
        id: 'role-sa',
        code: AdminRoleCode.SUPER_ADMIN,
      });
      prisma.adminUserRole.findFirst.mockResolvedValue({ id: 'link1' });
      prisma.adminUserRole.count.mockResolvedValue(2);
      prisma.adminUserRole.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeRoleFromUser('user-1', AdminRoleCode.SUPER_ADMIN);

      expect(prisma.adminUserRole.deleteMany).toHaveBeenCalledWith({
        where: { adminUserId: 'au1', roleId: 'role-sa' },
      });
    });
  });
});
