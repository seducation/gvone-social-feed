CREATE TABLE `feed_groups` (
	`feedId` int NOT NULL,
	`groupId` int NOT NULL,
	CONSTRAINT `feed_groups_pair` UNIQUE(`feedId`,`groupId`)
);
--> statement-breakpoint
CREATE TABLE `rss_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feedId` int NOT NULL,
	`guid` varchar(1024) NOT NULL,
	`title` text NOT NULL,
	`link` varchar(2048) NOT NULL,
	`description` text,
	`publishedAt` timestamp,
	`thumbnailUrl` varchar(2048),
	`videoUrl` varchar(2048),
	`videoMimeType` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rss_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `rss_articles_feed_guid` UNIQUE(`feedId`,`guid`)
);
--> statement-breakpoint
CREATE TABLE `rss_feeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(2048) NOT NULL,
	`customTitle` varchar(255),
	`title` varchar(512) NOT NULL,
	`description` text,
	`faviconUrl` varchar(2048),
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rss_feeds_id` PRIMARY KEY(`id`),
	CONSTRAINT `rss_feeds_user_url` UNIQUE(`userId`,`url`)
);
--> statement-breakpoint
CREATE TABLE `rss_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rss_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `rss_groups_user_name` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(16) NOT NULL DEFAULT 'user';