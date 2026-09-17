import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AccountingService } from './accounting.service';
import { CurrentAccountResponseDto } from './dto/payment.dto';

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
      'balance = totalDebit - totalCredit. SALE/REFUND debit, PAYMENT credit.',
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

  @Get('admin/accounting/transactions')
  @UseGuards(JwtAccessGuard, PermissionsGuard)
  @Permissions('accounting.read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin list accounting transactions' })
  adminTransactions(@Query() query: PaginationQueryDto) {
    return this.accountingService.listTransactions(query);
  }
}
