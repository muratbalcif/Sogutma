import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CheckoutService } from './checkout.service';
import {
  CheckoutValidateDto,
  CheckoutValidationResponseDto,
} from './dto/order.dto';

@ApiTags('checkout')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate checkout against the authenticated user cart',
    description:
      'Prices are tax-inclusive (KDV dahil). Client must not send prices or quantities.',
  })
  @ApiOkResponse({ type: CheckoutValidationResponseDto })
  validate(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CheckoutValidateDto,
  ): Promise<CheckoutValidationResponseDto> {
    return this.checkoutService.validate(
      request.user.id,
      request.user.userType,
      dto,
    );
  }
}
