import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRoleCode } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminService } from './admin.service';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { AssignRoleByEmailDto, AssignRoleDto } from './dto/assign-role.dto';

class LookupQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;
}

@ApiTags('admin-rbac')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(AdminRoleCode.SUPER_ADMIN)
@Controller('admin/rbac')
export class AdminRbacController {
  constructor(private readonly adminService: AdminService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List admin role codes (SUPER_ADMIN)' })
  @ApiOkResponse({ description: 'Role catalog' })
  listRoles() {
    return this.adminService.listRoles();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users with admin roles (SUPER_ADMIN)' })
  listUsers() {
    return this.adminService.listAdminUsers();
  }

  @Get('users/lookup')
  @ApiOperation({ summary: 'Lookup any user by email for role assignment' })
  async lookup(@Query() query: LookupQueryDto) {
    if (!query.email) {
      throw new NotFoundException('User not found');
    }
    const user = await this.adminService.lookupUserByEmail(query.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post('users/:userId/roles')
  @ApiOperation({ summary: 'Assign an admin role to a user' })
  async assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    const existing = await this.adminService.getUserSummary(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.adminService.assignRoleToUser(userId, dto.roleCode);
    return this.adminService.getUserSummary(userId);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign an admin role by email' })
  async assignByEmail(@Body() dto: AssignRoleByEmailDto) {
    const user = await this.adminService.lookupUserByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.adminService.assignRoleToUser(user.userId, dto.roleCode);
    return this.adminService.getUserSummary(user.userId);
  }

  @Delete('users/:userId/roles/:roleCode')
  @ApiOperation({ summary: 'Remove an admin role from a user' })
  async removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleCode') roleCode: string,
  ) {
    if (!Object.values(AdminRoleCode).includes(roleCode as AdminRoleCode)) {
      throw new NotFoundException('Role not found');
    }
    await this.adminService.removeRoleFromUser(
      userId,
      roleCode as AdminRoleCode,
    );
    return (
      (await this.adminService.getUserSummary(userId)) ?? {
        userId,
        email: '',
        firstName: '',
        lastName: '',
        roles: [] as string[],
      }
    );
  }
}
