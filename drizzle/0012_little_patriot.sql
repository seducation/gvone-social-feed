CREATE TABLE `provider_communities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerHostname` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_communities_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_communities_provider_hostname` UNIQUE(`providerHostname`)
);
--> statement-breakpoint
CREATE TABLE `provider_community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `provider_community_posts_community_created` ON `provider_community_posts` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_community_posts_user_created` ON `provider_community_posts` (`userId`,`createdAt`);