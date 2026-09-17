import { BadRequestException } from '@nestjs/common';
import { assertSpreadsheetFile } from './spreadsheet-guard';

describe('spreadsheet upload guard', () => {
  it('rejects dangerous extensions', () => {
    expect(() => assertSpreadsheetFile('payload.svg')).toThrow(
      BadRequestException,
    );
    expect(() => assertSpreadsheetFile('macro.xlsm')).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid MIME even with .xlsx extension', () => {
    expect(() =>
      assertSpreadsheetFile('ok.xlsx', 'application/javascript'),
    ).toThrow(BadRequestException);
  });

  it('accepts csv and xlsx with matching MIME', () => {
    expect(() => assertSpreadsheetFile('a.csv', 'text/csv')).not.toThrow();
    expect(() =>
      assertSpreadsheetFile(
        'a.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).not.toThrow();
  });
});
