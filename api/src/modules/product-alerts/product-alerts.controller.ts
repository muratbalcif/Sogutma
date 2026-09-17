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
import { ProductAlertResponseDto } from './dto/product-alert.dto';
import { ProductAlertService } from './product-alert.service';

@ApiTags('product-alerts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller()
export class ProductAlertsController {
  constructor(private readonly productAlertService: ProductAlertService) {}

  @Post('products/:productId/alerts')
  @ApiOperation({
    summary: 'Create a stock availability alert for a product',
    description:
      'Inactive products are eligible. No push notification is sent yet.',
  })
  @ApiOkResponse({ type: ProductAlertResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductAlertResponseDto> {
    return this.productAlertService.createAlert(request.user.id, productId);
  }

  @Delete('products/:productId/alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a product alert (idempotent)' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  remove(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ success: true }> {
    return this.productAlertService.removeAlert(request.user.id, productId);
  }

  @Get('product-alerts')
  @ApiOperation({ summary: 'List product alerts for the authenticated user' })
  @ApiOkResponse({ type: [ProductAlertResponseDto] })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<ProductAlertResponseDto[]> {
    return this.productAlertService.getUserAlerts(request.user.id);
  }
}
