import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  DeviceTokenResponseDto,
  NotificationListQueryDto,
  NotificationPreferenceResponseDto,
  NotificationResponseDto,
  RegisterDeviceDto,
  UnreadCountResponseDto,
  UpdateNotificationPreferenceDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register device token for push' })
  @ApiOkResponse({ type: DeviceTokenResponseDto })
  registerDevice(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceTokenResponseDto> {
    return this.notificationsService.registerDevice(request.user.id, dto);
  }

  @Get('devices')
  @ApiOkResponse({ type: [DeviceTokenResponseDto] })
  listDevices(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<DeviceTokenResponseDto[]> {
    return this.notificationsService.listDevices(request.user.id);
  }

  @Delete('devices/:token')
  deactivateDevice(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('token') token: string,
  ): Promise<{ success: true }> {
    return this.notificationsService.deactivateDevice(request.user.id, token);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get own notification preferences' })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  getPreferences(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationsService.getPreferences(request.user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update own notification preferences' })
  @ApiOkResponse({ type: NotificationPreferenceResponseDto })
  updatePreferences(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    return this.notificationsService.updatePreferences(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for authenticated user' })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    return this.notificationsService.listForUser(request.user.id, query);
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountResponseDto })
  unreadCount(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(request.user.id);
  }

  @Patch('read-all')
  markAllRead(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllAsRead(request.user.id);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(request.user.id, id);
  }
}
