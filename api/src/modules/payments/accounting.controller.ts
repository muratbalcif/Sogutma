import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AccountingService } from './accounting.service';
import { CurrentAccountResponseDto } from './dto/payment.dto';

class AdminTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

class ManualAccountTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] })
  @IsEnum(['DEBIT', 'CREDIT'] as const)
  direction!: 'DEBIT' | 'CREDIT';

  @ApiProperty({ example: '1000.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceNote?: string;
}

class AdjustmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] })
  @IsEnum(['DEBIT', 'CREDIT'] as const)
  direction!: 'DEBIT' | 'CREDIT';

  @ApiProperty({ example: '50.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ description: 'Required admin note' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  note!: string;
}

class ReversalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsString()
  originalReference!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  note!: string;
}

class CollectionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maxAmount?: string;
}

class ReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Return CSV when true' })
  @IsOptional()
  @IsString()
  format?: string;
}

@ApiTags('accounting')
@Controller()
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('account/current')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Customer current account summary',
    description:
      'balance = totalDebit - totalCredit. SALE/REFUND/ADJUSTMENT debit, PAYMENT credit.',
  })
  @ApiOkResponse({ type: CurrentAccountResponseDto })
  current(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<CurrentAccountResponseDto> {
    return this.accountingService.getCurrentAccount(request.user.id);
  }

  @Get('account/transactions')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Customer own account transactions' })
  myTransactions(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: PaginationQueryDto,
  ) {
    return this.accountingService.listTransactions({
      ...query,
      userId: request.user.id,
    });
  }

  @Get('account/statement')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Customer account statement' })
  myStatement(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.exportOrJsonStatement(request.user.id, from, to, format, res);
  }

  @Get('admin/accounting/customers/:customerId')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin current account for a customer' })
  @ApiOkResponse({ type: CurrentAccountResponseDto })
  adminCustomerAccount(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<CurrentAccountResponseDto> {
    return this.accountingService.getCurrentAccount(customerId);
  }

  @Get('admin/accounting/customers/:customerId/statement')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  async adminStatement(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    return this.exportOrJsonStatement(customerId, from, to, format, res);
  }

  @Get('admin/accounting/transactions')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin list accounting transactions' })
  adminTransactions(@Query() query: AdminTransactionsQueryDto) {
    return this.accountingService.listTransactions(query);
  }

  @Post('admin/accounting/manual')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.create')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create manual debit/credit (immutable ledger)' })
  manual(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: ManualAccountTransactionDto,
  ) {
    return this.accountingService.createManualTransaction({
      customerId: dto.customerId,
      direction: dto.direction,
      amount: dto.amount,
      description: dto.description,
      referenceNote: dto.referenceNote,
      adminUserId: request.user.id,
    });
  }

  @Post('admin/accounting/adjustment')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.create')
  @ApiBearerAuth('access-token')
  adjustment(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: AdjustmentDto,
  ) {
    return this.accountingService.createAdjustment({
      ...dto,
      adminUserId: request.user.id,
    });
  }

  @Post('admin/accounting/reversal')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.create')
  @ApiBearerAuth('access-token')
  reversal(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: ReversalDto,
  ) {
    return this.accountingService.createReversal({
      ...dto,
      adminUserId: request.user.id,
    });
  }

  @Get('admin/collections')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approved bank-transfer collections' })
  collections(@Query() query: CollectionsQueryDto) {
    return this.accountingService.listCollections(query);
  }

  @Get('admin/collections/summary')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  collectionsSummary() {
    return this.accountingService.collectionsSummary('Europe/Istanbul');
  }

  @Get('admin/finance/reports/:report')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  async financeReport(
    @Param('report') report: string,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const allowed = [
      'sales',
      'collections',
      'current-account',
      'debtors',
      'overdue',
      'top-customers',
    ] as const;
    if (!allowed.includes(report as (typeof allowed)[number])) {
      return { error: 'Unknown report' };
    }
    const payload = await this.accountingService.financialReport(
      report as (typeof allowed)[number],
      query,
    );
    if (query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report}.csv"`,
      );
      return this.accountingService.reportToCsv(payload);
    }
    return payload;
  }

  private async exportOrJsonStatement(
    userId: string,
    from?: string,
    to?: string,
    format?: string,
    res?: Response,
  ) {
    const statement = await this.accountingService.getStatement(
      userId,
      from,
      to,
    );
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="account-statement.csv"',
      );
      return this.accountingService.statementToCsv(statement);
    }
    return statement;
  }
}
