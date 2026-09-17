import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import {
  CampaignProductResponseDto,
  CampaignResponseDto,
} from './dto/campaign.dto';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List active current campaigns' })
  @ApiOkResponse({ type: [CampaignResponseDto] })
  list(): Promise<CampaignResponseDto[]> {
    return this.campaignsService.listPublic();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get active campaign by slug' })
  @ApiOkResponse({ type: CampaignResponseDto })
  getBySlug(@Param('slug') slug: string): Promise<CampaignResponseDto> {
    return this.campaignsService.getPublicBySlug(slug);
  }

  @Get(':slug/products')
  @ApiOperation({ summary: 'List products in an active campaign' })
  @ApiOkResponse({ type: [CampaignProductResponseDto] })
  listProducts(
    @Param('slug') slug: string,
  ): Promise<CampaignProductResponseDto[]> {
    return this.campaignsService.listPublicProducts(slug);
  }
}
