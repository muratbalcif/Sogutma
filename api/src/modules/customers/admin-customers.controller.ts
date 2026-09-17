import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Request, Response } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdminCustomersService } from './admin-customers.service';
import type { CustomerListFilter } from './admin-customers.service';

class CustomerListQueryDto {
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
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'INDIVIDUAL',
      'CORPORATE',
      'ACTIVE',
      'INACTIVE',
      'DEBTOR',
      'CREDITOR',
    ],
  })
  @IsOptional()
  @IsEnum([
    'INDIVIDUAL',
    'CORPORATE',
    'ACTIVE',
    'INACTIVE',
    'DEBTOR',
    'CREDITOR',
  ] as const)
  filter?: CustomerListFilter;
}

class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowCredit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  creditLimit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermDays?: number;
}

class UpdateCustomerStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

class InviteCustomerDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  companyName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  taxNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  taxOffice!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowCredit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditLimit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  paymentTermDays?: number;
}

class CustomerImportRowDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxOffice?: string;
}

class CustomerImportDto {
  @ApiProperty({ type: [CustomerImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerImportRowDto)
  rows!: CustomerImportRowDto[];
}

@ApiTags('admin-customers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @Permissions('customer.read')
  @ApiOperation({ summary: 'List customers with server-side search/filter' })
  list(@Query() query: CustomerListQueryDto) {
    return this.customers.list(query);
  }

  @Get('export')
  @Permissions('customer.read')
  async export(@Query() query: CustomerListQueryDto, @Res() res: Response) {
    const csv = await this.customers.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="customers.csv"',
    );
    res.send(csv);
  }

  @Post('invite')
  @Permissions('customer.update')
  invite(
    @Body() dto: InviteCustomerDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.customers.inviteCorporate(dto, request.user.id);
  }

  @Post('import')
  @Permissions('customer.update')
  @ApiOperation({
    summary: 'Import customers (no passwords — invite/activation flow)',
  })
  import(
    @Body() dto: CustomerImportDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.customers.importCustomers(dto.rows, request.user.id);
  }

  @Get(':id')
  @Permissions('customer.read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.getDetail(id);
  }

  @Get(':id/orders')
  @Permissions('customer.read')
  orders(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customers.listOrders(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch(':id')
  @Permissions('customer.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.customers.updateProfile(id, dto, request.user.id);
  }

  @Patch(':id/status')
  @Permissions('customer.update')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @Req() request: Request & { user: AuthenticatedUser },
  ) {
    return this.customers.updateStatus(id, dto.status, request.user.id);
  }
}
