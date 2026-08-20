CREATE TABLE `topic_communities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(500),
	`creatorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topic_communities_id` PRIMARY KEY(`id`),
	CONSTRAINT `topic_communities_slug` UNIQUE(`slug`),
	CONSTRAINT `topic_communities_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `topic_community_members` (
	`communityId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_community_members_pair` UNIQUE(`communityId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `topic_community_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_community_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topic_community_threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`body` text,
	`sourceStoryUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `topic_community_threads_id` PRIMARY KEY(`id`),
	CONSTRAINT `topic_community_threads_story` UNIQUE(`communityId`,`sourceStoryUrl`)
);
--> statement-breakpoint
CREATE INDEX `topic_communities_creator` ON `topic_communities` (`creatorUserId`);--> statement-breakpoint
CREATE INDEX `topic_community_members_user` ON `topic_community_members` (`userId`);--> statement-breakpoint
CREATE INDEX `topic_community_replies_thread_created` ON `topic_community_replies` (`threadId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topic_community_replies_user_created` ON `topic_community_replies` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topic_community_threads_community_created` ON `topic_community_threads` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `topic_community_threads_user_created` ON `topic_community_threads` (`userId`,`createdAt`);