import { csvEscape } from './security.util';

describe('csvEscape formula injection', () => {
  it('prefixes dangerous leading characters', () => {
    expect(csvEscape('=CMD()')).toBe("'=CMD()");
    expect(csvEscape('+1234')).toBe("'+1234");
    expect(csvEscape('-1+1')).toBe("'-1+1");
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes commas and quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('leaves normal text alone', () => {
    expect(csvEscape('Murat Balci')).toBe('Murat Balci');
  });
});
