CREATE TABLE "rider_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rider_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "rider_auth_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rider_legacy_imports" (
	"hash" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_riders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"archive_id" uuid NOT NULL,
	"profile" jsonb NOT NULL,
	"search_name" text NOT NULL,
	"complete" boolean NOT NULL,
	"division" text NOT NULL,
	"ending" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_riders_owner_id_archive_id_unique" UNIQUE("owner_id","archive_id")
);
--> statement-breakpoint
CREATE TABLE "rider_rankings" (
	"public_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"scope" text NOT NULL,
	"version" integer NOT NULL,
	"score" double precision NOT NULL,
	CONSTRAINT "rider_rankings_public_id_metric_scope_version_pk" PRIMARY KEY("public_id","metric","scope","version")
);
--> statement-breakpoint
CREATE TABLE "rider_reports" (
	"public_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rider_reports_public_id_reporter_id_pk" PRIMARY KEY("public_id","reporter_id")
);
--> statement-breakpoint
ALTER TABLE "rider_accounts" ADD CONSTRAINT "rider_accounts_user_id_rider_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."rider_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_riders" ADD CONSTRAINT "public_riders_owner_id_rider_accounts_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."rider_accounts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_rankings" ADD CONSTRAINT "rider_rankings_public_id_public_riders_id_fk" FOREIGN KEY ("public_id") REFERENCES "public"."public_riders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_reports" ADD CONSTRAINT "rider_reports_public_id_public_riders_id_fk" FOREIGN KEY ("public_id") REFERENCES "public"."public_riders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_reports" ADD CONSTRAINT "rider_reports_reporter_id_rider_accounts_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."rider_accounts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rider_auth_limits_expires_at_index" ON "rider_auth_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "public_riders_active_hidden_published_at_id_index" ON "public_riders" USING btree ("active","hidden","published_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "public_riders_active_hidden_search_name_index" ON "public_riders" USING btree ("active","hidden","search_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "public_riders_division_ending_complete_index" ON "public_riders" USING btree ("division","ending","complete");--> statement-breakpoint
CREATE INDEX "rider_rankings_metric_scope_version_score_public_id_index" ON "rider_rankings" USING btree ("metric","scope","version","score" DESC NULLS LAST,"public_id");--> statement-breakpoint
CREATE INDEX "rider_reports_created_at_index" ON "rider_reports" USING btree ("created_at");