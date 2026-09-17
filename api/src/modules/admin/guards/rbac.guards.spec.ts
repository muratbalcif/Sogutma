import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRoleCode } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

function createContext(user?: {
  roles: string[];
  permissions: string[];
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RBAC guards', () => {
  describe('RolesGuard', () => {
    it('allows matching roles', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.SUPER_ADMIN]),
      };
      const guard = new RolesGuard(reflector as unknown as Reflector);

      expect(
        guard.canActivate(
          createContext({
            roles: [AdminRoleCode.SUPER_ADMIN],
            permissions: [],
          }),
        ),
      ).toBe(true);
    });

    it('forbids missing roles', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.PRODUCT_MANAGER]),
      };
      const guard = new RolesGuard(reflector as unknown as Reflector);

      expect(() =>
        guard.canActivate(
          createContext({
            roles: [AdminRoleCode.ACCOUNTING],
            permissions: [],
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('PermissionsGuard', () => {
    it('allows when all permissions are present', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue(['product.read', 'product.update']),
      };
      const guard = new PermissionsGuard(reflector as unknown as Reflector);

      expect(
        guard.canActivate(
          createContext({
            roles: [],
            permissions: ['product.read', 'product.update', 'order.read'],
          }),
        ),
      ).toBe(true);
    });

    it('forbids missing permissions', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['product.delete']),
      };
      const guard = new PermissionsGuard(reflector as unknown as Reflector);

      expect(() =>
        guard.canActivate(
          createContext({
            roles: [],
            permissions: ['product.read'],
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
