CREATE TABLE `story_discussion_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discussionId` int NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(16) NOT NULL,
	`content` text,
	`parentPostId` int,
	`repostOfPostId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `story_discussion_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_discussions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyKey` varchar(64) NOT NULL,
	`sourceLabel` varchar(180) NOT NULL,
	`storyTitle` varchar(512) NOT NULL,
	`storyLink` varchar(2048) NOT NULL,
	`storyDescription` text,
	`storyThumbnailUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `story_discussions_id` PRIMARY KEY(`id`),
	CONSTRAINT `story_discussions_story_key` UNIQUE(`storyKey`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`userId` int NOT NULL,
	`displayName` varchar(80) NOT NULL,
	`bio` varchar(280),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE INDEX `story_discussion_posts_discussion_created` ON `story_discussion_posts` (`discussionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `story_discussion_posts_parent_created` ON `story_discussion_posts` (`parentPostId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `story_discussion_posts_user_created` ON `story_discussion_posts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `story_discussions_updated` ON `story_discussions` (`updatedAt`);