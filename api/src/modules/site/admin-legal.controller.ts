import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Request } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { SiteService } from './site.service';

class UpdateLegalPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  body?: string;
}

@ApiTags('admin-legal')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/legal')
export class AdminLegalController {
  constructor(private readonly siteService: SiteService) {}

  @Get()
  @Permissions('site.read')
  @ApiOperation({ summary: 'List editable legal pages' })
  list() {
    return this.siteService.listLegalPages();
  }

  @Get(':slug')
  @Permissions('site.read')
  @ApiOkResponse({ description: 'Legal page' })
  get(@Param('slug') slug: string) {
    return this.siteService.getLegalPage(slug);
  }

  @Put(':slug')
  @Permissions('site.update')
  @ApiOperation({ summary: 'Update legal page content' })
  update(
    @Param('slug') slug: string,
    @Body() dto: UpdateLegalPageDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.siteService.updateLegalPage(slug, dto, request.user.id);
  }
}
