import {
  Body,
  Controller,
  Delete,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AddressesService } from './addresses.service';
import {
  AddressResponseDto,
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/address.dto';

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shipping/billing address' })
  @ApiCreatedResponse({ type: AddressResponseDto })
  create(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.create(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List addresses for the authenticated user' })
  @ApiOkResponse({ type: [AddressResponseDto] })
  list(
    @Req() request: Request & { user: AuthenticatedUser },
  ): Promise<AddressResponseDto[]> {
    return this.addressesService.list(request.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address' })
  @ApiOkResponse({ type: AddressResponseDto })
  update(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.update(request.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  remove(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true }> {
    return this.addressesService.remove(request.user.id, id);
  }
}
