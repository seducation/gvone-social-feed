ALTER TABLE `story_discussion_posts` ADD `parentPostId` int;--> statement-breakpoint
ALTER TABLE `story_discussion_posts` ADD `parentPostId` int;--> statement-breakpoint
ALTER TABLE `story_discussion_posts` ADD `quotedPostId` int;--> statement-breakpoint
CREATE INDEX `story_discussion_posts_parent_created` ON `story_discussion_posts` (`parentPostId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `story_discussion_posts_quoted_post` ON `story_discussion_posts` (`quotedPostId`);
