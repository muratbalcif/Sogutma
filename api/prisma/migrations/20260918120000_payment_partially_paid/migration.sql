-- AlterEnum: PaymentStatus.PARTIALLY_PAID
DO $$ BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
