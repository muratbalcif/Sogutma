import { createHash } from 'crypto';
import { TokenService } from './token.service';

describe('TokenService', () => {
  it('hashes refresh tokens and does not store plaintext', () => {
    const service = Object.create(TokenService.prototype) as TokenService;
    const raw = 'raw-refresh-token-value';
    const hash = service.hashToken(raw);

    expect(hash).not.toEqual(raw);
    expect(hash).toEqual(createHash('sha256').update(raw).digest('hex'));
  });
});
