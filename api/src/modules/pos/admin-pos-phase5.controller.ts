import {
  Body,
  Controller,
  Get,
  Headers,
  Header,
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
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdminPosReportQueryDto,
  AdminPosReportSummaryDto,
  AdminPosXReportQueryDto,
  CreatePosReturnDto,
  PosReturnResponseDto,
} from './dto/pos-phase5.dto';
import { PosReturnService } from './pos-return.service';
import { PosReportsService } from './pos-reports.service';

@ApiTags('admin-pos-reports-returns')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/pos')
export class AdminPosPhase5Controller {
  constructor(
    private readonly reports: PosReportsService,
    private readonly returns: PosReturnService,
  ) {}

  @Get('reports/summary')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'POS satış özeti (gross / returns / net + breakdowns)',
  })
  @ApiOkResponse({ type: AdminPosReportSummaryDto })
  summary(
    @Query() query: AdminPosReportQueryDto,
  ): Promise<AdminPosReportSummaryDto> {
    return this.reports.summary(query);
  }

  @Get('reports/x')
  @Permissions('pos.read')
  @ApiOperation({
    summary: 'X raporu — bugünün anlık özeti (state değiştirmez)',
  })
  @ApiOkResponse({ type: AdminPosReportSummaryDto })
  xReport(@Query() query: AdminPosXReportQueryDto) {
    return this.reports.xReport(query);
  }

  @Get('reports/export.csv')
  @Permissions('pos.read')
  @ApiOperation({ summary: 'POS satış CSV export' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() query: AdminPosReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.reports.exportCsv(query);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pos-report-${query.from}_${query.to}.csv"`,
    );
    res.send(csv);
  }

  @Post('sales/:id/returns')
  @Permissions('pos.refund')
  @ApiOperation({ summary: 'POS satış iadesi (partial/full)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Retry güvenliği',
  })
  @ApiOkResponse({ type: PosReturnResponseDto })
  createReturn(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePosReturnDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PosReturnResponseDto> {
    return this.returns.createReturn(
      id,
      dto,
      request.user,
      idempotencyKey ?? null,
    );
  }
}
