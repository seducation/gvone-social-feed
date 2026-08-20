ALTER TABLE `chat_conversations` ADD `rssArticleId` int;--> statement-breakpoint
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_user_article` UNIQUE(`userId`,`rssArticleId`);