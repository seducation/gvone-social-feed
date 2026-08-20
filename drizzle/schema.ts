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

export const userProfiles = mysqlTable("user_profiles", {
  userId: int("userId").primaryKey(),
  displayName: varchar("displayName", { length: 80 }).notNull(),
  username: varchar("username", { length: 30 }).notNull(),
  bio: varchar("bio", { length: 280 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  username: uniqueIndex("user_profiles_username").on(table.username),
}));

export const storyDiscussions = mysqlTable("story_discussions", {
  id: int("id").autoincrement().primaryKey(),
  storyUrl: varchar("storyUrl", { length: 2048 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  storyUrl: uniqueIndex("story_discussions_story_url").on(table.storyUrl),
  updated: index("story_discussions_updated").on(table.updatedAt),
}));

export const storyDiscussionPosts = mysqlTable("story_discussion_posts", {
  id: int("id").autoincrement().primaryKey(),
  discussionId: int("discussionId").notNull(),
  userId: int("userId").notNull(),
  content: text("content"),
  parentPostId: int("parentPostId"),
  quotedPostId: int("quotedPostId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  discussionCreated: index("story_discussion_posts_discussion_created").on(table.discussionId, table.createdAt),
  userCreated: index("story_discussion_posts_user_created").on(table.userId, table.createdAt),
  parentCreated: index("story_discussion_posts_parent_created").on(table.parentPostId, table.createdAt),
  quotedPost: index("story_discussion_posts_quoted_post").on(table.quotedPostId),
}));

export const providerCommunities = mysqlTable("provider_communities", {
  id: int("id").autoincrement().primaryKey(),
  providerHostname: varchar("providerHostname", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerHostname: uniqueIndex("provider_communities_provider_hostname").on(table.providerHostname),
}));

export const providerCommunityPosts = mysqlTable("provider_community_posts", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  communityCreated: index("provider_community_posts_community_created").on(table.communityId, table.createdAt),
  userCreated: index("provider_community_posts_user_created").on(table.userId, table.createdAt),
}));

export const topicCommunities = mysqlTable("topic_communities", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 500 }),
  creatorUserId: int("creatorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slug: uniqueIndex("topic_communities_slug").on(table.slug),
  name: uniqueIndex("topic_communities_name").on(table.name),
  creator: index("topic_communities_creator").on(table.creatorUserId),
}));

export const topicCommunityMembers = mysqlTable("topic_community_members", {
  communityId: int("communityId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (table) => ({
  membership: uniqueIndex("topic_community_members_pair").on(table.communityId, table.userId),
  user: index("topic_community_members_user").on(table.userId),
}));

export const topicCommunityPosts = mysqlTable("topic_community_posts", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  communityCreated: index("topic_community_posts_community_created").on(table.communityId, table.createdAt),
  userCreated: index("topic_community_posts_user_created").on(table.userId, table.createdAt),
}));

export const topicCommunityThreads = mysqlTable("topic_community_threads", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  body: text("body"),
  sourceStoryUrl: varchar("sourceStoryUrl", { length: 2048 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  communityCreated: index("topic_community_threads_community_created").on(table.communityId, table.createdAt),
  userCreated: index("topic_community_threads_user_created").on(table.userId, table.createdAt),
  sharedStory: uniqueIndex("topic_community_threads_story").on(table.communityId, table.sourceStoryUrl),
}));

export const topicCommunityReplies = mysqlTable("topic_community_replies", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("threadId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  threadCreated: index("topic_community_replies_thread_created").on(table.threadId, table.createdAt),
  userCreated: index("topic_community_replies_user_created").on(table.userId, table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type RssFeed = typeof rssFeeds.$inferSelect;
export type RssGroup = typeof rssGroups.$inferSelect;
export type RssArticle = typeof rssArticles.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type StoryDiscussion = typeof storyDiscussions.$inferSelect;
export type StoryDiscussionPost = typeof storyDiscussionPosts.$inferSelect;
export type ProviderCommunity = typeof providerCommunities.$inferSelect;
export type ProviderCommunityPost = typeof providerCommunityPosts.$inferSelect;
export type TopicCommunity = typeof topicCommunities.$inferSelect;
export type TopicCommunityMember = typeof topicCommunityMembers.$inferSelect;
export type TopicCommunityPost = typeof topicCommunityPosts.$inferSelect;
export type TopicCommunityThread = typeof topicCommunityThreads.$inferSelect;
export type TopicCommunityReply = typeof topicCommunityReplies.$inferSelect;
