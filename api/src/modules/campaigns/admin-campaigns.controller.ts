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
import { CampaignsService } from './campaigns.service';
import {
  AddCampaignProductDto,
  CampaignProductResponseDto,
  CampaignResponseDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  UpdateCampaignProductDto,
} from './dto/campaign.dto';

@ApiTags('admin-campaigns')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @Permissions('campaign.read')
  @ApiOperation({ summary: 'Admin list campaigns' })
  list(): Promise<CampaignResponseDto[]> {
    return this.campaignsService.listAdmin();
  }

  @Get(':id')
  @Permissions('campaign.read')
  @ApiOkResponse({ type: CampaignResponseDto })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampaignResponseDto> {
    return this.campaignsService.getAdminById(id);
  }

  @Post()
  @Permissions('campaign.create')
  @ApiOkResponse({ type: CampaignResponseDto })
  create(@Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  @Permissions('campaign.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('campaign.delete')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    return this.campaignsService.remove(id);
  }

  @Post(':id/products')
  @Permissions('campaign.update')
  addProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCampaignProductDto,
  ): Promise<CampaignProductResponseDto> {
    return this.campaignsService.addProduct(id, dto);
  }

  @Patch(':id/products/:productId')
  @Permissions('campaign.update')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCampaignProductDto,
  ): Promise<CampaignProductResponseDto> {
    return this.campaignsService.updateProduct(id, productId, dto);
  }

  @Delete(':id/products/:productId')
  @Permissions('campaign.update')
  removeProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ success: true }> {
    return this.campaignsService.removeProduct(id, productId);
  }

  @Post(':id/notify')
  @Permissions('campaign.notify')
  @ApiOperation({
    summary: 'Queue a controlled campaign notification (no mass sync send)',
  })
  notify(@Param('id', ParseUUIDPipe) id: string): Promise<{ queued: true }> {
    return this.campaignsService.queueNotify(id);
  }
}
