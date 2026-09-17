import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  FavoriteCheckResponseDto,
  FavoriteResponseDto,
} from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List favorites for the authenticated user' })
  @ApiOkResponse({ type: [FavoriteResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<FavoriteResponseDto[]> {
    return this.favoritesService.list(request.user.id);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Check whether a product is favorited' })
  @ApiOkResponse({ type: FavoriteCheckResponseDto })
  check(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<FavoriteCheckResponseDto> {
    return this.favoritesService.check(request.user.id, productId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add a product to favorites' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  add(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.add(request.user.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a product from favorites (idempotent)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  remove(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ success: true }> {
    return this.favoritesService.remove(request.user.id, productId);
  }
}
