import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes passwords and never returns plaintext', async () => {
    const password = 'Password123!';
    const hash = await service.hash(password);

    expect(hash).not.toEqual(password);
    expect(hash.startsWith('$argon2')).toBe(true);
    expect(await service.verify(hash, password)).toBe(true);
    expect(await service.verify(hash, 'wrong-password')).toBe(false);
  });
});
