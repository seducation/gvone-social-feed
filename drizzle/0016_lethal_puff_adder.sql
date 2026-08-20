CREATE TABLE `profile_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160),
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `profile_posts_user_created` ON `profile_posts` (`userId`,`createdAt`);