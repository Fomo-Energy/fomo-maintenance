ALTER TABLE "bookings" ADD COLUMN "installer_type" text DEFAULT 'fomo' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installer_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_installer_type_check" CHECK ("bookings"."installer_type" in ('fomo', 'other', 'rto'));