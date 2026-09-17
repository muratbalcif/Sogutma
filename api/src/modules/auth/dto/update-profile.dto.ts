import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Murat' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName?: string;

  @ApiPropertyOptional({ example: 'Balci' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName?: string;

  @ApiPropertyOptional({ example: '+905551112233', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return value;
  })
  phone?: string | null;
}
