ALTER TABLE "bookings" ADD COLUMN "installer_type" text DEFAULT 'fomo' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installer_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_installer_type_check" CHECK ("bookings"."installer_type" in ('fomo', 'other', 'rto'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_installer_name_type_check" CHECK ("bookings"."installer_type" = 'other' or "bookings"."installer_name" is null);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_installer_name_format_check" CHECK ("bookings"."installer_name" is null or ("bookings"."installer_name" = btrim("bookings"."installer_name") and char_length("bookings"."installer_name") between 1 and 120));