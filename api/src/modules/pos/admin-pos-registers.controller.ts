import {
  Body,
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdminPosRegisterDto,
  CreatePosRegisterDto,
  UpdatePosRegisterDto,
} from './dto/pos-admin.dto';
import { PosAdminService } from './pos-admin.service';

@ApiTags('admin-pos-registers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/pos/registers')
export class AdminPosRegistersController {
  constructor(private readonly posAdmin: PosAdminService) {}

  @Get()
  @Permissions('pos.read')
  @ApiOperation({ summary: 'Tüm POS kasaları (aktif + pasif)' })
  @ApiOkResponse({ type: [AdminPosRegisterDto] })
  list(): Promise<AdminPosRegisterDto[]> {
    return this.posAdmin.listRegistersAdmin();
  }

  @Post()
  @Permissions('pos.register')
  @ApiOperation({ summary: 'Yeni POS kasası' })
  @ApiOkResponse({ type: AdminPosRegisterDto })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreatePosRegisterDto,
  ): Promise<AdminPosRegisterDto> {
    return this.posAdmin.createRegister(dto, request.user.id);
  }

  @Patch(':id')
  @Permissions('pos.register')
  @ApiOperation({ summary: 'POS kasası güncelle (ad/kod/aktif)' })
  @ApiOkResponse({ type: AdminPosRegisterDto })
  update(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePosRegisterDto,
  ): Promise<AdminPosRegisterDto> {
    return this.posAdmin.updateRegister(id, dto, request.user.id);
  }
}
