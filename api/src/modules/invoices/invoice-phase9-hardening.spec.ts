/* eslint-disable @typescript-eslint/unbound-method -- Reflect metadata needs method refs */
import 'reflect-metadata';
import { InvoiceStatus } from '@prisma/client';
import { PERMISSIONS_KEY } from '../admin/decorators/permissions.decorator';
import { AdminInvoicesController } from './admin-invoices.controller';
import {
  resolveCanDownloadDocument,
  resolveCanFormalize,
  resolveCanRetry,
  resolveCanSync,
} from './dto/invoice-query.dto';

function routePermissions(
  method: keyof AdminInvoicesController,
): string[] | undefined {
  return Reflect.getMetadata(
    PERMISSIONS_KEY,
    AdminInvoicesController.prototype[method],
  ) as string[] | undefined;
}

describe('Phase 9 security / capability hardening', () => {
  it('admin invoice routes declare expected permissions', () => {
    expect(routePermissions('createFromSale')).toEqual(['invoice.create']);
    expect(routePermissions('formalize')).toEqual(['invoice.create']);
    expect(routePermissions('getPdf')).toEqual(['invoice.read']);
    expect(routePermissions('getXml')).toEqual(['invoice.read']);
    expect(routePermissions('sync')).toEqual(['invoice.read']);
    expect(routePermissions('getById')).toEqual(['invoice.read']);
  });

  it('FAILED + validation error is not retryable', () => {
    expect(
      resolveCanRetry({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: null,
        errorCode: 'KOLAYBI_VALIDATION_ERROR',
      }),
    ).toBe(false);
    expect(
      resolveCanRetry({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: null,
        errorCode: 'TOTAL_MISMATCH',
      }),
    ).toBe(false);
  });

  it('FAILED + timeout is create-retryable', () => {
    expect(
      resolveCanRetry({
        status: InvoiceStatus.FAILED,
        uuid: null,
        externalDocumentId: null,
        errorCode: 'KOLAYBI_TIMEOUT',
      }),
    ).toBe(true);
  });

  it('FORMALIZE_UNKNOWN only retryable when still formalizable draft', () => {
    expect(
      resolveCanRetry({
        status: InvoiceStatus.SUCCESS,
        uuid: null,
        externalDocumentId: '18',
        errorCode: 'FORMALIZE_UNKNOWN',
      }),
    ).toBe(true);
    expect(
      resolveCanRetry({
        status: InvoiceStatus.SUCCESS,
        uuid: 'ettn',
        externalDocumentId: '18',
        errorCode: 'FORMALIZE_UNKNOWN',
      }),
    ).toBe(false);
  });

  it('download/sync flags require formalized uuid / external id', () => {
    expect(
      resolveCanDownloadDocument({
        status: InvoiceStatus.SUCCESS,
        uuid: null,
      }),
    ).toBe(false);
    expect(
      resolveCanDownloadDocument({
        status: InvoiceStatus.SUCCESS,
        uuid: 'u',
      }),
    ).toBe(true);
    expect(resolveCanSync({ externalDocumentId: null })).toBe(false);
    expect(resolveCanSync({ externalDocumentId: '1' })).toBe(true);
    expect(
      resolveCanFormalize({
        status: InvoiceStatus.SUCCESS,
        uuid: null,
        externalDocumentId: '1',
      }),
    ).toBe(true);
  });
});
