import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { BannersService } from './banners.service';
import {
  BannerResponseDto,
  CreateBannerDto,
  UpdateBannerDto,
} from './dto/banner.dto';

@ApiTags('admin-banners')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @Permissions('banner.read')
  list(): Promise<BannerResponseDto[]> {
    return this.bannersService.listAdmin();
  }

  @Get(':id')
  @Permissions('banner.read')
  @ApiOkResponse({ type: BannerResponseDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<BannerResponseDto> {
    return this.bannersService.getAdminById(id);
  }

  @Post()
  @Permissions('banner.create')
  create(@Body() dto: CreateBannerDto): Promise<BannerResponseDto> {
    return this.bannersService.create(dto);
  }

  @Patch(':id')
  @Permissions('banner.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
  ): Promise<BannerResponseDto> {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('banner.delete')
  @ApiOperation({ summary: 'Soft-deactivate a banner' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    return this.bannersService.remove(id);
  }
}
