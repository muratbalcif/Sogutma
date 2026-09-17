import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { BankTransferService } from './bank-transfer.service';
import {
  BankTransferResponseDto,
  CreateBankTransferDto,
  CreatePaymentDto,
  PaymentResponseDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly bankTransferService: BankTransferService,
  ) {}

  @Post('orders/:orderId/payment')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Prevents duplicate payment attempts',
  })
  @ApiOperation({
    summary: 'Create a payment attempt for an order',
    description:
      'Amount/currency always taken from the order. Never send amount from the client.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  createPayment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createForOrder(
      request.user.id,
      orderId,
      dto,
      idempotencyKey,
    );
  }

  @Get('orders/:orderId/payment')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get latest payment for an order' })
  @ApiOkResponse({ type: PaymentResponseDto })
  getPayment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getLatestForOrder(request.user.id, orderId);
  }

  @Post('orders/:orderId/bank-transfer')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit bank transfer notification',
    description:
      'Amount always equals order.totalAmount. Payment stays PENDING until admin approval.',
  })
  @ApiOkResponse({ type: BankTransferResponseDto })
  createBankTransfer(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateBankTransferDto,
  ): Promise<BankTransferResponseDto> {
    return this.bankTransferService.createNotification(
      request.user.id,
      orderId,
      dto,
    );
  }

  @Get('orders/:orderId/bank-transfer')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get latest bank transfer notification' })
  @ApiOkResponse({ type: BankTransferResponseDto })
  getBankTransfer(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<BankTransferResponseDto> {
    return this.bankTransferService.getForOrder(request.user.id, orderId);
  }

  @Get('bank-transfers')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List bank transfer notifications for the user' })
  listBankTransfers(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<BankTransferResponseDto>> {
    return this.bankTransferService.listForUser(request.user.id, query);
  }

  @Post('payments/webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Provider webhook callback foundation',
    description:
      'Requires provider-specific verification. Development provider uses x-dev-webhook-secret.',
  })
  handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ processed: boolean; paymentId?: string }> {
    return this.paymentsService.handleWebhook(provider, headers, body);
  }
}
