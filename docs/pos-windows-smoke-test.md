# FurkanSoğutma POS — Windows smoke test checklist

Use after installing the Windows NSIS build (unsigned) **or** on https://admin.furkansogutma.net/pos.

API: `https://api.furkansogutma.net/api/v1`  
User needs `pos.sell` (or `POS_CASHIER` / `SUPER_ADMIN`).

## AUTH

- [ ] Login
- [ ] Refresh
- [ ] POS permission

## REGISTER

- [ ] Register selection

## SALE

- [ ] Barcode scan
- [ ] Product search
- [ ] Cart
- [ ] Cash
- [ ] Card
- [ ] Bank transfer
- [ ] On account
- [ ] Split payment

## ACCOUNTING

- [ ] Current account debit
- [ ] Payment credit
- [ ] Credit limit

## INVENTORY

- [ ] Stock decreases

## RETURN

- [ ] Sale lookup
- [ ] Partial return
- [ ] Full return
- [ ] Stock increases
- [ ] Accounting reversal
- [ ] Refund

## REPORT

- [ ] Summary (admin)
- [ ] X report (admin)
- [ ] CSV (admin)

## ERRORS

- [ ] Out of stock
- [ ] Credit limit
- [ ] Network
- [ ] Unauthorized

## Notes

- Windows installer is currently **unsigned** (SmartScreen may warn).
- Auto-update is not enabled in Phase 6.
- Barcode: USB keyboard-wedge scanner, suffix Enter — no vendor SDK.
