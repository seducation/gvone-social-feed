CREATE TABLE `chat_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`parentConversationId` int,
	`forkMessageId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(16) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_conversations_user_updated` ON `chat_conversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `chat_conversations_parent` ON `chat_conversations` (`parentConversationId`);--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_created` ON `chat_messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `chat_messages_user_conversation` ON `chat_messages` (`userId`,`conversationId`);