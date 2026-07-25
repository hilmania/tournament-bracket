CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL DEFAULT 'single_elimination',
	`status` text NOT NULL DEFAULT 'draft',
	`created_at` integer NOT NULL
);

CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`seed` integer
);

CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE CASCADE,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`participant1_id` text REFERENCES `participants`(`id`),
	`participant2_id` text REFERENCES `participants`(`id`),
	`winner_id` text REFERENCES `participants`(`id`),
	`score1` integer,
	`score2` integer,
	`next_match_id` text
);
