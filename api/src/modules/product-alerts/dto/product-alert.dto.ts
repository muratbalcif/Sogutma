import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductAlertResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional({ nullable: true })
  triggeredAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
  };
}

export class TriggerAlertResultDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  triggeredCount!: number;

  @ApiProperty({ type: [String] })
  userIds!: string[];
}
