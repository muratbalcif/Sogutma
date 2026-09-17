import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminLegalController } from './admin-legal.controller';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  imports: [PrismaModule, AuthModule, AdminModule],
  controllers: [SiteController, AdminLegalController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
