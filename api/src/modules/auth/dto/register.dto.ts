import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'Murat' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName!: string;

  @ApiProperty({ example: 'Balci' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName!: string;

  @ApiPropertyOptional({ example: '+905551112233' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ enum: UserType, example: 'INDIVIDUAL' })
  @IsEnum(UserType)
  userType!: UserType;

  @ApiPropertyOptional({ description: 'Required when userType is CORPORATE' })
  @ValidateIf((o: RegisterDto) => o.userType === UserType.CORPORATE)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Required when userType is CORPORATE' })
  @ValidateIf((o: RegisterDto) => o.userType === UserType.CORPORATE)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'Required when userType is CORPORATE' })
  @ValidateIf((o: RegisterDto) => o.userType === UserType.CORPORATE)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  taxOffice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  identityNumber?: string;
}
