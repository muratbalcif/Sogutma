import { ApiProperty } from '@nestjs/swagger';
import { AdminRoleCode } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class AssignRoleDto {
  @ApiProperty({ enum: AdminRoleCode })
  @IsEnum(AdminRoleCode)
  roleCode!: AdminRoleCode;
}

export class AssignRoleByEmailDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: AdminRoleCode })
  @IsEnum(AdminRoleCode)
  roleCode!: AdminRoleCode;
}
