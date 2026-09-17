import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminModule } from './admin.module';

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [AdminRbacController],
})
export class AdminRbacModule {}
