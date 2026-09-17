import { SetMetadata } from '@nestjs/common';
import { AdminRoleCode } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRoleCode[]) =>
  SetMetadata(ROLES_KEY, roles);
