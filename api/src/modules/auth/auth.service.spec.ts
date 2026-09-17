import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserStatus, UserType } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    toResponse: jest.fn(),
    findById: jest.fn(),
    findByIdOrThrow: jest.fn(),
    updateProfile: jest.fn(),
  };

  const passwordService = {
    hash: jest.fn(),
    verify: jest.fn(),
  };

  const tokenService = {
    issueTokenPair: jest.fn(),
    findActiveRefreshToken: jest.fn(),
    findRefreshTokenByRaw: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllRefreshTokensForUser: jest.fn(),
    hashToken: jest.fn(),
  };

  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('secret'),
  };

  const adminService = {
    getAccessForUser: jest.fn(),
  };

  const customersService = {
    createCorporateProfile: jest.fn(),
  };

  let service: AuthService;

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hashed',
    firstName: 'Murat',
    lastName: 'Balci',
    phone: null,
    userType: UserType.INDIVIDUAL,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as never,
      passwordService,
      tokenService as never,
      jwtService as never,
      configService as never,
      adminService as never,
      customersService as never,
    );

    usersService.toResponse.mockImplementation((value: typeof user) => ({
      id: value.id,
      email: value.email,
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone,
      userType: value.userType,
      status: value.status,
    }));
  });

  it('register succeeds and returns tokens without passwordHash', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue('hashed-password');
    usersService.create.mockResolvedValue(user);
    tokenService.issueTokenPair.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await service.register({
      email: 'user@example.com',
      password: 'Password123!',
      firstName: 'Murat',
      lastName: 'Balci',
      userType: UserType.INDIVIDUAL,
    });

    expect(passwordService.hash).toHaveBeenCalledWith('Password123!');
    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
  });

  it('register rejects duplicate email', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'Murat',
        lastName: 'Balci',
        userType: UserType.INDIVIDUAL,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login succeeds for active user', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(true);
    tokenService.issueTokenPair.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const result = await service.login({
      email: 'user@example.com',
      password: 'Password123!',
    });

    expect(result.accessToken).toBe('access');
    expect(result.user.email).toBe('user@example.com');
  });

  it('login rejects invalid password with generic message', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('blocked user cannot login', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.BLOCKED,
    });
    passwordService.verify.mockResolvedValue(true);

    await expect(
      service.login({ email: 'user@example.com', password: 'Password123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rotates tokens and revokes old token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      userType: user.userType,
    });
    tokenService.findRefreshTokenByRaw.mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });
    usersService.findById.mockResolvedValue(user);
    tokenService.issueTokenPair.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const result = await service.refresh('old-refresh');

    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('old-refresh');
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('refresh rejects revoked or missing token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      userType: user.userType,
    });
    tokenService.findRefreshTokenByRaw.mockResolvedValue(null);

    await expect(service.refresh('revoked')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh reuse of rotated token revokes all user sessions', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      userType: user.userType,
    });
    tokenService.findRefreshTokenByRaw.mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
    });
    tokenService.revokeAllRefreshTokensForUser = jest.fn();

    await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokenService.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(
      user.id,
    );
  });

  it('refresh rejects expired token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      userType: user.userType,
    });
    tokenService.findRefreshTokenByRaw.mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
    });

    await expect(service.refresh('expired')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('expired');
  });

  it('logout revokes refresh token', async () => {
    await expect(service.logout('refresh')).resolves.toEqual({ success: true });
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('refresh');
  });

  it('forgotPassword returns honest message without claiming email was sent', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    const result = await service.forgotPassword('user@example.com');
    expect(result.message).toContain('yapılandırılmadığı');
    expect(result.message.toLowerCase()).not.toContain('gönderildi');
  });

  it('updateProfile updates allowed fields and returns user', async () => {
    const updated = { ...user, firstName: 'Ali', phone: '+905551112233' };
    usersService.updateProfile.mockResolvedValue(updated);
    adminService.getAccessForUser.mockResolvedValue({
      roles: [],
      permissions: [],
    });

    const result = await service.updateProfile(user.id, {
      firstName: 'Ali',
      phone: '+905551112233',
    });

    expect(usersService.updateProfile).toHaveBeenCalledWith(user.id, {
      firstName: 'Ali',
      lastName: undefined,
      phone: '+905551112233',
    });
    expect(result.firstName).toBe('Ali');
  });

  it('updateProfile rejects empty body', async () => {
    await expect(service.updateProfile(user.id, {})).rejects.toMatchObject({
      status: 400,
    });
    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });
});
