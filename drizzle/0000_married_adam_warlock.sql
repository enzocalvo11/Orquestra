CREATE TABLE `plan_changes` (
	`task_id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`week_index` integer NOT NULL,
	`updated_at` text NOT NULL
);
