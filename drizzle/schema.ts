import { boolean, index, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const rssFeeds = mysqlTable("rss_feeds", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  customTitle: varchar("customTitle", { length: 255 }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  faviconUrl: varchar("faviconUrl", { length: 2048 }),
  isEnabled: boolean("isEnabled").notNull().default(true),
  lastFetchedAt: timestamp("lastFetchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userUrl: uniqueIndex("rss_feeds_user_url").on(table.userId, table.url) }));

export const rssGroups = mysqlTable("rss_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userName: uniqueIndex("rss_groups_user_name").on(table.userId, table.name) }));

export const feedGroups = mysqlTable("feed_groups", {
  feedId: int("feedId").notNull(),
  groupId: int("groupId").notNull(),
}, (table) => ({ pair: uniqueIndex("feed_groups_pair").on(table.feedId, table.groupId) }));

export const sourceTabPreferences = mysqlTable("source_tab_preferences", {
  userId: int("userId").primaryKey(),
  tabOrder: text("tabOrder").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rssArticles = mysqlTable("rss_articles", {
  id: int("id").autoincrement().primaryKey(),
  feedId: int("feedId").notNull(),
  guid: varchar("guid", { length: 1024 }).notNull(),
  title: text("title").notNull(),
  link: varchar("link", { length: 2048 }).notNull(),
  description: text("description"),
  publishedAt: timestamp("publishedAt"),
  thumbnailUrl: varchar("thumbnailUrl", { length: 2048 }),
  videoUrl: varchar("videoUrl", { length: 2048 }),
  videoMimeType: varchar("videoMimeType", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ feedGuid: uniqueIndex("rss_articles_feed_guid").on(table.feedId, table.guid) }));

export const chatConversations = mysqlTable("chat_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  parentConversationId: int("parentConversationId"),
  forkMessageId: int("forkMessageId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userUpdated: index("chat_conversations_user_updated").on(table.userId, table.updatedAt),
  parentConversation: index("chat_conversations_parent").on(table.parentConversationId),
}));

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  conversationCreated: index("chat_messages_conversation_created").on(table.conversationId, table.createdAt),
  userConversation: index("chat_messages_user_conversation").on(table.userId, table.conversationId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type RssFeed = typeof rssFeeds.$inferSelect;
export type RssGroup = typeof rssGroups.$inferSelect;
export type RssArticle = typeof rssArticles.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
