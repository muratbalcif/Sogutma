import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  CartResponseDto,
  CartValidationResponseDto,
  UpdateCartItemDto,
} from './dto/cart.dto';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated user cart' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getCart(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartResponseDto> {
    return this.cartService.getCart(request.user.id, request.user.userType);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart' })
  @ApiOkResponse({ type: CartResponseDto })
  addItem(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(
      request.user.id,
      dto.productId,
      dto.quantity,
      request.user.userType,
    );
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiOkResponse({ type: CartResponseDto })
  updateItem(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(
      request.user.id,
      productId,
      dto.quantity,
      request.user.userType,
    );
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiOkResponse({ type: CartResponseDto })
  removeItem(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(
      request.user.id,
      productId,
      request.user.userType,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all items from the cart' })
  @ApiOkResponse({ type: CartResponseDto })
  clearCart(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartResponseDto> {
    return this.cartService.clearCart(request.user.id, request.user.userType);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate cart items without checkout' })
  @ApiOkResponse({ type: CartValidationResponseDto })
  validateCart(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CartValidationResponseDto> {
    return this.cartService.validateCart(
      request.user.id,
      request.user.userType,
    );
  }
}
