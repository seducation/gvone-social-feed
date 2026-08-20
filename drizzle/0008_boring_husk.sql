DROP INDEX `story_discussion_posts_parent_created` ON `story_discussion_posts`;--> statement-breakpoint
ALTER TABLE `story_discussion_posts` DROP COLUMN `kind`;--> statement-breakpoint
ALTER TABLE `story_discussion_posts` DROP COLUMN `parentPostId`;--> statement-breakpoint
ALTER TABLE `story_discussion_posts` DROP COLUMN `repostOfPostId`;