import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, UserType } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({
    type: [String],
    description: 'Admin role codes (empty for customers)',
  })
  roles!: string[];

  @ApiProperty({
    type: [String],
    description: 'Admin permission codes (empty for customers)',
  })
  permissions!: string[];
}
