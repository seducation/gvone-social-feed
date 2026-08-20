ALTER TABLE `story_discussions` DROP INDEX `story_discussions_story_key`;--> statement-breakpoint
ALTER TABLE `story_discussions` ADD `storyUrl` varchar(2048) NOT NULL;--> statement-breakpoint
ALTER TABLE `story_discussions` ADD CONSTRAINT `story_discussions_story_url` UNIQUE(`storyUrl`);--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `storyKey`;--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `sourceLabel`;--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `storyTitle`;--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `storyLink`;--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `storyDescription`;--> statement-breakpoint
ALTER TABLE `story_discussions` DROP COLUMN `storyThumbnailUrl`;