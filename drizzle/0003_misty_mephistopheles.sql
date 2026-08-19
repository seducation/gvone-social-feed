CREATE TABLE `source_tab_preferences` (
	`userId` int NOT NULL,
	`tabOrder` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_tab_preferences_userId` PRIMARY KEY(`userId`)
);
