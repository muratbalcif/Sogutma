import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  providers: [AdminService, RolesGuard, PermissionsGuard],
  exports: [AdminService, RolesGuard, PermissionsGuard],
})
export class AdminModule {}
