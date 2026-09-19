import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { OutboxStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { EmailOutboxService } from './email-outbox.service';

class EmailOutboxListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: OutboxStatus })
  @IsOptional()
  @IsEnum(OutboxStatus)
  status?: OutboxStatus;

  @ApiPropertyOptional({ description: 'Filter by event / eventKey substring' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('admin-email-outbox')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/email-outbox')
export class AdminEmailOutboxController {
  constructor(private readonly emailOutbox: EmailOutboxService) {}

  @Get('summary')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Email outbox delivery summary' })
  summary() {
    return this.emailOutbox.summary();
  }

  @Get()
  @Permissions('notification.read')
  @ApiOperation({ summary: 'List email outbox rows' })
  list(@Query() query: EmailOutboxListQueryDto) {
    return this.emailOutbox.listAdmin(query);
  }

  @Get(':id')
  @Permissions('notification.read')
  @ApiOkResponse({ description: 'Email outbox detail (no HTML body)' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailOutbox.getAdminById(id);
  }

  @Post(':id/retry')
  @Permissions('notification.read')
  @ApiOperation({
    summary: 'Retry a failed email (idempotent)',
  })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailOutbox.retry(id);
  }
}
