import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { BankAccountsService } from './bank-accounts.service';
import { BankTransferService } from './bank-transfer.service';
import {
  AdminBankTransferListQueryDto,
  AdminPaymentListQueryDto,
  AdminUpsertBankAccountDto,
  ApproveBankTransferDto,
  BankTransferResponseDto,
  PaymentResponseDto,
  RejectBankTransferDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('admin-payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin')
export class AdminPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly bankTransferService: BankTransferService,
    private readonly bankAccountsService: BankAccountsService,
  ) {}

  @Get('payments')
  @Permissions('payment.read')
  @ApiOperation({ summary: 'Admin list payments' })
  listPayments(
    @Query() query: AdminPaymentListQueryDto,
  ): Promise<PaginatedResponseDto<PaymentResponseDto>> {
    return this.paymentsService.listAdmin(query);
  }

  @Get('payments/:id')
  @Permissions('payment.read')
  @ApiOperation({ summary: 'Admin get payment' })
  @ApiOkResponse({ type: PaymentResponseDto })
  getPayment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getById(id);
  }

  @Post('payments/:id/refund')
  @Permissions('payment.refund')
  @ApiOperation({ summary: 'Admin refund a PAID payment' })
  @ApiOkResponse({ type: PaymentResponseDto })
  refund(@Param('id', ParseUUIDPipe) id: string): Promise<PaymentResponseDto> {
    return this.paymentsService.refundPayment(id);
  }

  @Get('bank-accounts')
  @Permissions('payment.read')
  @ApiOperation({ summary: 'Admin list company bank accounts' })
  listBankAccounts() {
    return this.bankAccountsService.listAdmin();
  }

  @Post('bank-accounts')
  @Permissions('payment.update')
  @ApiOperation({ summary: 'Create company bank account' })
  createBankAccount(@Body() dto: AdminUpsertBankAccountDto) {
    return this.bankAccountsService.upsertAdmin(null, dto);
  }

  @Post('bank-accounts/:id')
  @Permissions('payment.update')
  @ApiOperation({ summary: 'Update company bank account' })
  updateBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpsertBankAccountDto,
  ) {
    return this.bankAccountsService.upsertAdmin(id, dto);
  }

  @Get('bank-transfers')
  @Permissions('bank_transfer.read')
  @ApiOperation({ summary: 'Admin list bank transfer notifications' })
  listBankTransfers(
    @Query() query: AdminBankTransferListQueryDto,
  ): Promise<PaginatedResponseDto<BankTransferResponseDto>> {
    return this.bankTransferService.listAdmin(query);
  }

  @Get('bank-transfers/:id')
  @Permissions('bank_transfer.read')
  @ApiOperation({ summary: 'Admin get bank transfer notification' })
  getBankTransfer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BankTransferResponseDto> {
    return this.bankTransferService.getAdminById(id);
  }

  @Post('bank-transfers/:id/approve')
  @Permissions('bank_transfer.approve')
  @ApiOperation({ summary: 'Approve bank transfer and mark payment PAID' })
  approve(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBankTransferDto,
  ): Promise<BankTransferResponseDto> {
    return this.bankTransferService.approve(id, request.user.id, dto.adminNote);
  }

  @Post('bank-transfers/:id/reject')
  @Permissions('bank_transfer.reject')
  @ApiOperation({
    summary: 'Reject bank transfer; payment stays PENDING; order stays PENDING',
  })
  reject(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBankTransferDto,
  ): Promise<BankTransferResponseDto> {
    return this.bankTransferService.reject(
      id,
      request.user.id,
      dto.rejectionReason,
      dto.adminNote,
    );
  }
}
