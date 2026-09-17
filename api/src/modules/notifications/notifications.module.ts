import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmPushProvider } from './providers/fcm-push.provider';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [FcmPushProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
