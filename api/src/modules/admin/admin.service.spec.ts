import { ConflictException } from '@nestjs/common';
import { AdminRoleCode } from '@prisma/client';
import { AdminService } from './admin.service';
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
