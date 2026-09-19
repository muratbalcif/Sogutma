import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import {
  NotificationListQueryDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('admin-notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('summary')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'In-app / push outbox summary' })
  summary() {
    return this.notificationsService.adminSummary();
  }

  @Get()
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Admin list notifications' })
  list(
    @Query() query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    return this.notificationsService.listAdmin(query);
  }

  @Get(':id')
  @Permissions('notification.read')
  @ApiOkResponse({ type: NotificationResponseDto })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.getAdminById(id);
  }
}
