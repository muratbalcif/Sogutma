import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUploadsController } from './admin-uploads.controller';
import { R2StorageService } from './r2-storage.service';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [AdminUploadsController],
  providers: [R2StorageService],
  exports: [R2StorageService],
})
export class StorageModule {}
