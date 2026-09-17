import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { BrandsService } from './brands.service';
import {
  BrandResponseDto,
  CreateBrandDto,
  UpdateBrandDto,
} from './dto/brand.dto';

@ApiTags('admin-brands')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Permissions('brand.read')
  @ApiOperation({ summary: 'Admin list brands' })
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<BrandResponseDto>> {
    return this.brandsService.findAllAdmin(query);
  }

  @Post()
  @Permissions('brand.create')
  @ApiCreatedResponse({ type: BrandResponseDto })
  create(@Body() dto: CreateBrandDto): Promise<BrandResponseDto> {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  @Permissions('brand.update')
  @ApiOkResponse({ type: BrandResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('brand.delete')
  @ApiOkResponse({ type: BrandResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<BrandResponseDto> {
    return this.brandsService.softDelete(id);
  }
}
