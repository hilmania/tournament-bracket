CREATE TABLE `master_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`created_at` integer NOT NULL
);

ALTER TABLE `participants` ADD COLUMN `master_participant_id` text REFERENCES `master_participants`(`id`);
