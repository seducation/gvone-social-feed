CREATE TABLE `topic_community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300),
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `topic_community_posts_community_created` ON `topic_community_posts` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topic_community_posts_user_created` ON `topic_community_posts` (`userId`,`createdAt`);