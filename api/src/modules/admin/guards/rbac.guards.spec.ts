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
    it('allows SUPER_ADMIN when PRODUCT_MANAGER is required', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.PRODUCT_MANAGER]),
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

    it('allows SUPER_ADMIN when ORDER_MANAGER is required', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.ORDER_MANAGER]),
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

    it('allows SUPER_ADMIN when ACCOUNTING is required', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.ACCOUNTING]),
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

    it('allows PRODUCT_MANAGER when PRODUCT_MANAGER is required', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.PRODUCT_MANAGER]),
      };
      const guard = new RolesGuard(reflector as unknown as Reflector);

      expect(
        guard.canActivate(
          createContext({
            roles: [AdminRoleCode.PRODUCT_MANAGER],
            permissions: [],
          }),
        ),
      ).toBe(true);
    });

    it('forbids ACCOUNTING when PRODUCT_MANAGER is required', () => {
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

    it('allows when no roles are required', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(undefined),
      };
      const guard = new RolesGuard(reflector as unknown as Reflector);

      expect(guard.canActivate(createContext())).toBe(true);
    });

    it('forbids when user is missing and a role is required', () => {
      const reflector = {
        getAllAndOverride: jest
          .fn()
          .mockReturnValue([AdminRoleCode.SUPER_ADMIN]),
      };
      const guard = new RolesGuard(reflector as unknown as Reflector);

      expect(() => guard.canActivate(createContext())).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('PermissionsGuard', () => {
    it('allows SUPER_ADMIN even without permission codes', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['product.read']),
      };
      const guard = new PermissionsGuard(reflector as unknown as Reflector);

      expect(
        guard.canActivate(
          createContext({
            roles: [AdminRoleCode.SUPER_ADMIN],
            permissions: [],
          }),
        ),
      ).toBe(true);
    });

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
