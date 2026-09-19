import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Permissions } from '../admin/decorators/permissions.decorator';
import { PermissionsGuard } from '../admin/guards/permissions.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { R2StorageService } from './r2-storage.service';

class PresignUploadDto {
  @ApiProperty({ example: 'klima.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;

  @ApiPropertyOptional({ example: 'products/uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;

  @ApiProperty({ example: 102400 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentLength!: number;
}

class PresignUploadResponseDto {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  objectKey!: string;

  @ApiProperty()
  publicUrl!: string;

  @ApiProperty()
  maxBytes!: number;

  @ApiProperty({ description: 'Presigned URL TTL in seconds' })
  expiresIn!: number;
}

@ApiTags('admin-uploads')
@ApiBearerAuth('access-token')
@UseGuards(JwtAccessGuard, PermissionsGuard)
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly storage: R2StorageService) {}

  @Post('presign')
  @Permissions('product.update')
  @ApiOperation({
    summary: 'Create short-lived R2 presigned upload URL',
    description:
      'Secrets never leave the server. Client PUTs file to uploadUrl, then registers ProductImage with publicUrl/objectKey.',
  })
  @ApiOkResponse({ type: PresignUploadResponseDto })
  async presign(
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponseDto> {
    const result = await this.storage.createPresignedUpload({
      filename: dto.filename,
      contentType: dto.contentType,
      folder: dto.folder ?? 'products',
      contentLength: dto.contentLength,
    });
    return {
      ...result,
      maxBytes: this.storage.getMaxUploadBytes(),
      expiresIn: this.storage.getPresignTtlSeconds(),
    };
  }
}
