import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { BannerResponseDto } from './dto/banner.dto';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'List active banners' })
  @ApiOkResponse({ type: [BannerResponseDto] })
  list(): Promise<BannerResponseDto[]> {
    return this.bannersService.listPublic();
  }
}
