CREATE TABLE "nutrition_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"excluded_ingredients" text[] DEFAULT '{}' NOT NULL,
	"preferred_categories" text[] DEFAULT '{}' NOT NULL,
	"meal_style" text DEFAULT 'varied' NOT NULL,
	"energy_label" text DEFAULT 'leicht' NOT NULL,
	CONSTRAINT "nutrition_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_profile_ids" integer[] DEFAULT '{}' NOT NULL,
	"household_size" integer DEFAULT 2 NOT NULL,
	"budget_level" text DEFAULT 'medium' NOT NULL,
	"cook_time_limit" integer DEFAULT 30 NOT NULL,
	"bio_preferred" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"default_unit" text DEFAULT 'g' NOT NULL,
	"bio_recommended" boolean DEFAULT false NOT NULL,
	"score_base" integer DEFAULT 50 NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"ingredient_id" integer,
	"custom_name" text,
	"amount" text DEFAULT '1' NOT NULL,
	"unit" text DEFAULT 'g' NOT NULL,
	"optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"description" text,
	"prep_time" integer DEFAULT 10 NOT NULL,
	"cook_time" integer DEFAULT 20 NOT NULL,
	"servings" integer DEFAULT 2 NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"energy_type" text DEFAULT 'leicht' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_day_id" integer NOT NULL,
	"meal_type" text DEFAULT 'lunch' NOT NULL,
	"recipe_id" integer,
	"custom_note" text,
	"time_slot" time
);
--> statement-breakpoint
CREATE TABLE "meal_plan_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"day_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"cycle_length_days" integer DEFAULT 7 NOT NULL,
	"repeat_enabled" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" text,
	"unit" text,
	"category" text DEFAULT 'Sonstiges' NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"bio_recommended" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"ingredient_id" integer
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"week_from" text NOT NULL,
	"week_to" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"meal_plan_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"input" text NOT NULL,
	"output" jsonb,
	"model" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"meal_entry_id" integer,
	"recipe_id" integer,
	"rating" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_meal_plan_day_id_meal_plan_days_id_fk" FOREIGN KEY ("meal_plan_day_id") REFERENCES "public"."meal_plan_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_days" ADD CONSTRAINT "meal_plan_days_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;