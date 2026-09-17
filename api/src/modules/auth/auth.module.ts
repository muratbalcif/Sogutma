import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EnvironmentVariables } from '../../config/env.validation';
import { AdminModule } from '../admin/admin.module';
import { CustomersModule } from '../customers/customers.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { OptionalJwtAccessGuard } from './guards/optional-jwt-access.guard';
import { PasswordService } from './password/password.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { TokenService } from './token/token.service';

@Module({
  imports: [
    UsersModule,
    AdminModule,
    CustomersModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAccessStrategy,
    JwtAccessGuard,
    OptionalJwtAccessGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAccessGuard,
    OptionalJwtAccessGuard,
  ],
})
export class AuthModule {}
