import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ImportJobType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ImportsService } from './imports.service';
import { spreadsheetFileFilter } from './spreadsheet-guard';

class ImportListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ImportJobType })
  @IsOptional()
  @IsEnum(ImportJobType)
  type?: ImportJobType;
}

@ApiTags('admin-imports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/imports')
export class AdminImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @Permissions('import.read')
  @ApiOperation({ summary: 'List import jobs' })
  async list(@Query() query: ImportListQueryDto) {
    const result = await this.importsService.listJobs(query);
    return buildPaginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @Permissions('import.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.importsService.getJob(id);
  }

  @Get(':id/errors.csv')
  @Permissions('import.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="import-errors.csv"')
  async errorsCsv(@Param('id', ParseUUIDPipe) id: string): Promise<string> {
    const job = await this.importsService.getJob(id);
    return this.importsService.exportErrorsCsv(job);
  }

  @Post('products/preview')
  @Permissions('import.create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: spreadsheetFileFilter,
    }),
  )
  @ApiOperation({
    summary: 'Upload product CSV/XLSX and get validation preview',
  })
  previewProducts(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File required');
    }
    return this.importsService.createProductImportPreview({
      adminUserId: request.user.id,
      filename: file.originalname,
      buffer: file.buffer,
    });
  }

  @Post('products/:id/confirm')
  @Permissions('import.create')
  @ApiOkResponse({ description: 'Run product upsert import' })
  confirmProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.importsService.confirmProductImport(id, request.user.id);
  }

  @Post('prices/preview')
  @Permissions('import.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: spreadsheetFileFilter,
    }),
  )
  previewPrices(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File required');
    }
    return this.importsService.createPriceImportPreview({
      adminUserId: request.user.id,
      filename: file.originalname,
      buffer: file.buffer,
    });
  }

  @Post('prices/:id/confirm')
  @Permissions('import.create')
  confirmPrices(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.importsService.confirmPriceImport(id, request.user.id);
  }

  @Post('stock/preview')
  @Permissions('import.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: spreadsheetFileFilter,
    }),
  )
  previewStock(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File required');
    }
    return this.importsService.createStockImportPreview({
      adminUserId: request.user.id,
      filename: file.originalname,
      buffer: file.buffer,
    });
  }

  @Post('stock/:id/confirm')
  @Permissions('import.create')
  confirmStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.importsService.confirmStockImport(id, request.user.id);
  }
}
