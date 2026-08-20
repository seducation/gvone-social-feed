CREATE TABLE `topic_community_post_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_community_post_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `topic_community_post_replies_post_created` ON `topic_community_post_replies` (`postId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topic_community_post_replies_user_created` ON `topic_community_post_replies` (`userId`,`createdAt`);