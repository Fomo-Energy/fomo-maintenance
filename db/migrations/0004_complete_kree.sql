ALTER TABLE "email_deliveries" DROP CONSTRAINT "email_deliveries_provider_check";--> statement-breakpoint
ALTER TABLE "email_deliveries" ALTER COLUMN "provider" SET DEFAULT 'microsoft_graph';--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_provider_check" CHECK ("email_deliveries"."provider" in ('resend', 'microsoft_graph'));