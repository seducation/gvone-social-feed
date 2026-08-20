ALTER TABLE `user_profiles` ADD `username` varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `username` varchar(30);--> statement-breakpoint
UPDATE `user_profiles` SET `username` = CONCAT('member_', `userId`) WHERE `username` IS NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` MODIFY `username` varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_username` UNIQUE(`username`);
