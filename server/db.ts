import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alias } from "drizzle-orm/mysql-core";
import {
  ChatConversation,
  ChatMessage,
  InsertUser,
  RssArticle,
  ProviderCommunity,
  ProviderCommunityPost,
  TopicCommunity,
  TopicCommunityPost,
  TopicCommunityReply,
  TopicCommunityThread,
  StoryDiscussion,
  StoryDiscussionPost,
  UserProfile,
  chatConversations,
  chatMessages,
  feedGroups,
  rssArticles,
  rssFeeds,
  rssGroups,
  providerCommunities,
  providerCommunityPosts,
  topicCommunities,
  topicCommunityMembers,
  topicCommunityPosts,
  topicCommunityPostReplies,
  topicCommunityReplies,
  topicCommunityThreads,
  sourceTabPreferences,
  storyDiscussionPosts,
  storyDiscussions,
  userProfiles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { ParsedFeed } from "./feedParser";
import { buildBranchHistory, type BranchHistoryMessage, type BranchNode, type DirectBranchMessage } from "./chatMemory";

let _db: ReturnType<typeof drizzle> | null = null;
const quotedStoryDiscussionPost = alias(storyDiscussionPosts, "quoted_story_discussion_post");
const quotedStoryProfile = alias(userProfiles, "quoted_story_profile");
const parentStoryDiscussionPost = alias(storyDiscussionPosts, "parent_story_discussion_post");
const parentStoryProfile = alias(userProfiles, "parent_story_profile");
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch { _db = null; } } return _db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb(); if (!db || !user.openId) return;
  const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, role: values.role } });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }

export function ownsResource(userId: number, resource: { userId: number } | undefined) { return Boolean(resource && resource.userId === userId); }
export function sortArticlesByPublished<T extends { publishedAt: Date | null }>(articles: T[]) { return [...articles].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)); }
export function isReplyableStoryThread<T extends { parentPostId: number | null }>(post: T | undefined): post is T & { parentPostId: null } { return Boolean(post && post.parentPostId === null); }
export const ARTICLE_HISTORY_LIMIT = 500;

export async function listFeeds(userId: number, enabledOnly = false) { const db = await getDb(); if (!db) return []; return db.select().from(rssFeeds).where(enabledOnly ? and(eq(rssFeeds.userId, userId), eq(rssFeeds.isEnabled, true)) : eq(rssFeeds.userId, userId)).orderBy(desc(rssFeeds.createdAt)); }
export async function listGroups(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(rssGroups).where(eq(rssGroups.userId, userId)).orderBy(rssGroups.name); }
export async function getFeed(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(rssFeeds).where(and(eq(rssFeeds.id, id), eq(rssFeeds.userId, userId))).limit(1))[0]; }
export async function getGroup(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(rssGroups).where(and(eq(rssGroups.id, id), eq(rssGroups.userId, userId))).limit(1))[0]; }

export async function saveParsedFeed(userId: number, feedId: number, parsed: ParsedFeed) {
  const db = await getDb(); if (!db) return;
  await db.update(rssFeeds).set({ title: parsed.title, description: parsed.description, faviconUrl: parsed.faviconUrl, lastFetchedAt: new Date() }).where(and(eq(rssFeeds.id, feedId), eq(rssFeeds.userId, userId)));
  for (const article of parsed.articles) {
    await db.insert(rssArticles).values({ feedId, ...article }).onDuplicateKeyUpdate({ set: { title: article.title, link: article.link, description: article.description, publishedAt: article.publishedAt, thumbnailUrl: article.thumbnailUrl, videoUrl: article.videoUrl, videoMimeType: article.videoMimeType } });
  }
}
export async function listArticlesForFeeds(feedIds: number[], limit = ARTICLE_HISTORY_LIMIT): Promise<RssArticle[]> { const db = await getDb(); if (!db || !feedIds.length) return []; const rows = await db.select().from(rssArticles).where(inArray(rssArticles.feedId, feedIds)).orderBy(desc(rssArticles.publishedAt)).limit(limit); return sortArticlesByPublished(rows); }
export async function groupFeedIds(userId: number, groupId: number) { const db = await getDb(); if (!db) return []; const rows = await db.select({ feedId: feedGroups.feedId }).from(feedGroups).innerJoin(rssFeeds, eq(feedGroups.feedId, rssFeeds.id)).where(and(eq(feedGroups.groupId, groupId), eq(rssFeeds.userId, userId), eq(rssFeeds.isEnabled, true))); return rows.map((row) => row.feedId); }
export async function assignFeed(userId: number, feedId: number, groupId: number) { const db = await getDb(); if (!db || !ownsResource(userId, await getFeed(userId, feedId)) || !ownsResource(userId, await getGroup(userId, groupId))) return; await db.insert(feedGroups).values({ feedId, groupId }).onDuplicateKeyUpdate({ set: { feedId } }); }
export async function unassignFeed(userId: number, feedId: number, groupId: number) { const db = await getDb(); if (!db || !ownsResource(userId, await getFeed(userId, feedId)) || !ownsResource(userId, await getGroup(userId, groupId))) return; await db.delete(feedGroups).where(and(eq(feedGroups.feedId, feedId), eq(feedGroups.groupId, groupId))); }
export async function listAssignedFeedIds(userId: number, groupId: number) { return groupFeedIds(userId, groupId); }

export async function getSourceTabOrder(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const preference = (await db.select().from(sourceTabPreferences).where(eq(sourceTabPreferences.userId, userId)).limit(1))[0];
  if (!preference) return [];
  try {
    const order = JSON.parse(preference.tabOrder);
    return Array.isArray(order) && order.every((key) => typeof key === "string") ? order : [];
  } catch { return []; }
}

export async function saveSourceTabOrder(userId: number, tabOrder: string[]) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(sourceTabPreferences).values({ userId, tabOrder: JSON.stringify(tabOrder) }).onDuplicateKeyUpdate({ set: { tabOrder: JSON.stringify(tabOrder), updatedAt: new Date() } });
  return true;
}

export async function listChatConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatConversations).where(eq(chatConversations.userId, userId)).orderBy(desc(chatConversations.updatedAt));
}

export async function getChatConversation(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(chatConversations).where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId))).limit(1))[0];
}

export async function createChatConversation(userId: number, title: string, parentConversationId?: number | null, forkMessageId?: number | null) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(chatConversations).values({ userId, title, parentConversationId: parentConversationId ?? null, forkMessageId: forkMessageId ?? null });
  return getChatConversation(userId, Number(result[0].insertId));
}

export async function listDirectChatMessages(userId: number, conversationId: number, throughMessageId?: number): Promise<DirectBranchMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId)];
  if (throughMessageId) conditions.push(lte(chatMessages.id, throughMessageId));
  const messages = await db.select().from(chatMessages).where(and(...conditions)).orderBy(asc(chatMessages.id));
  return messages.filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant");
}

export async function getDirectChatMessage(userId: number, conversationId: number, messageId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(chatMessages).where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId))).limit(1))[0];
}

export async function addChatMessage(userId: number, conversationId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(chatMessages).values({ userId, conversationId, role, content });
  await db.update(chatConversations).set({ updatedAt: new Date() }).where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
  return getDirectChatMessage(userId, conversationId, Number(result[0].insertId));
}

export async function createChatBranch(userId: number, sourceConversationId: number, forkMessageId: number, title: string) {
  const source = await getChatConversation(userId, sourceConversationId);
  if (!source || !(await getDirectChatMessage(userId, sourceConversationId, forkMessageId))) return undefined;
  return createChatConversation(userId, title, sourceConversationId, forkMessageId);
}

export async function getChatBranchHistory(userId: number, conversationId: number): Promise<BranchHistoryMessage[]> {
  const active = await getChatConversation(userId, conversationId);
  if (!active) return [];
  const leafToRoot: ChatConversation[] = [];
  let current: ChatConversation | undefined = active;
  for (let depth = 0; current && depth < 24; depth += 1) {
    leafToRoot.push(current);
    current = current.parentConversationId ? await getChatConversation(userId, current.parentConversationId) : undefined;
  }
  const lineage = leafToRoot.reverse() as BranchNode[];
  const messagesByConversation = new Map<number, DirectBranchMessage[]>();
  for (let index = 0; index < lineage.length; index += 1) {
    const nextBranch = lineage[index + 1];
    messagesByConversation.set(lineage[index].id, await listDirectChatMessages(userId, lineage[index].id, nextBranch?.forkMessageId ?? undefined));
  }
  return buildBranchHistory(lineage, messagesByConversation);
}

function defaultProfileName(name: string | null | undefined) {
  return (name?.trim() || "gvone member").slice(0, 80);
}

export function defaultProfileUsername(userId: number) {
  return `member_${userId}`;
}

export async function getUserProfile(userId: number): Promise<UserProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1))[0];
}

export async function getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(userProfiles).where(eq(userProfiles.username, username)).limit(1))[0];
}

export async function ensureUserProfile(userId: number, fallbackName?: string | null): Promise<UserProfile | undefined> {
  const existing = await getUserProfile(userId);
  if (existing) return existing;
  const db = await getDb();
  if (!db) return undefined;
  try {
    await db.insert(userProfiles).values({ userId, displayName: defaultProfileName(fallbackName), username: defaultProfileUsername(userId) });
  } catch {
    // A concurrent request may have created the profile first; read it below.
  }
  return getUserProfile(userId);
}

export async function updateUserProfile(userId: number, displayName: string, username: string, bio?: string | null) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await getUserProfile(userId);
  if (existing) {
    await db.update(userProfiles).set({ displayName, username, bio: bio || null, updatedAt: new Date() }).where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({ userId, displayName, username, bio: bio || null });
  }
  return getUserProfile(userId);
}

export type StoryPulseInput = {
  storyUrl: string;
};

export async function getStoryDiscussion(id: number): Promise<StoryDiscussion | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(storyDiscussions).where(eq(storyDiscussions.id, id)).limit(1))[0];
}

export async function getStoryDiscussionPost(id: number): Promise<StoryDiscussionPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(storyDiscussionPosts).where(eq(storyDiscussionPosts.id, id)).limit(1))[0];
}

export async function openStoryDiscussion(input: StoryPulseInput): Promise<StoryDiscussion | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const existing = (await db.select().from(storyDiscussions).where(eq(storyDiscussions.storyUrl, input.storyUrl)).limit(1))[0];
  if (existing) return existing;
  try {
    const result = await db.insert(storyDiscussions).values(input);
    return getStoryDiscussion(Number(result[0].insertId));
  } catch {
    return (await db.select().from(storyDiscussions).where(eq(storyDiscussions.storyUrl, input.storyUrl)).limit(1))[0];
  }
}

export async function listStoryReposts(discussionId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: storyDiscussionPosts.id,
    discussionId: storyDiscussionPosts.discussionId,
    userId: storyDiscussionPosts.userId,
    content: storyDiscussionPosts.content,
    parentPostId: storyDiscussionPosts.parentPostId,
    quotedPostId: storyDiscussionPosts.quotedPostId,
    createdAt: storyDiscussionPosts.createdAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
    bio: userProfiles.bio,
    quotedContent: quotedStoryDiscussionPost.content,
    quotedDisplayName: quotedStoryProfile.displayName,
    quotedUsername: quotedStoryProfile.username,
  }).from(storyDiscussionPosts)
    .leftJoin(userProfiles, eq(storyDiscussionPosts.userId, userProfiles.userId))
    .leftJoin(quotedStoryDiscussionPost, eq(storyDiscussionPosts.quotedPostId, quotedStoryDiscussionPost.id))
    .leftJoin(quotedStoryProfile, eq(quotedStoryDiscussionPost.userId, quotedStoryProfile.userId))
    .where(eq(storyDiscussionPosts.discussionId, discussionId))
    .orderBy(asc(storyDiscussionPosts.createdAt));
  const repliesByParent = new Map<number, typeof rows>();
  for (const row of rows) {
    if (row.parentPostId !== null) repliesByParent.set(row.parentPostId, [...(repliesByParent.get(row.parentPostId) ?? []), row]);
  }
  return rows.filter((row) => row.parentPostId === null).map((thread) => ({
    ...thread,
    replies: repliesByParent.get(thread.id) ?? [],
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function addStoryRepost(userId: number, discussionId: number, content: string): Promise<StoryDiscussionPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(storyDiscussionPosts).values({ userId, discussionId, content });
  await db.update(storyDiscussions).set({ updatedAt: new Date() }).where(eq(storyDiscussions.id, discussionId));
  return (await db.select().from(storyDiscussionPosts).where(eq(storyDiscussionPosts.id, Number(result[0].insertId))).limit(1))[0];
}

export async function addStoryReply(userId: number, discussionId: number, parentPostId: number, content: string, quotedPostId?: number): Promise<StoryDiscussionPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const parent = await getStoryDiscussionPost(parentPostId);
  if (!isReplyableStoryThread(parent) || parent.discussionId !== discussionId) return undefined;
  if (quotedPostId) {
    const quoted = await getStoryDiscussionPost(quotedPostId);
    if (!isReplyableStoryThread(quoted) || quoted.discussionId !== discussionId) return undefined;
  }
  const result = await db.insert(storyDiscussionPosts).values({ userId, discussionId, parentPostId, quotedPostId: quotedPostId ?? null, content });
  await db.update(storyDiscussions).set({ updatedAt: new Date() }).where(eq(storyDiscussions.id, discussionId));
  return getStoryDiscussionPost(Number(result[0].insertId));
}

export async function listProfilePulse(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: storyDiscussionPosts.id,
    parentPostId: storyDiscussionPosts.parentPostId,
    quotedPostId: storyDiscussionPosts.quotedPostId,
    content: storyDiscussionPosts.content,
    createdAt: storyDiscussionPosts.createdAt,
    discussionId: storyDiscussions.id,
    storyUrl: storyDiscussions.storyUrl,
    parentContent: parentStoryDiscussionPost.content,
    parentDisplayName: parentStoryProfile.displayName,
    parentUsername: parentStoryProfile.username,
    quotedContent: quotedStoryDiscussionPost.content,
    quotedDisplayName: quotedStoryProfile.displayName,
    quotedUsername: quotedStoryProfile.username,
  }).from(storyDiscussionPosts)
    .innerJoin(storyDiscussions, eq(storyDiscussionPosts.discussionId, storyDiscussions.id))
    .leftJoin(parentStoryDiscussionPost, eq(storyDiscussionPosts.parentPostId, parentStoryDiscussionPost.id))
    .leftJoin(parentStoryProfile, eq(parentStoryDiscussionPost.userId, parentStoryProfile.userId))
    .leftJoin(quotedStoryDiscussionPost, eq(storyDiscussionPosts.quotedPostId, quotedStoryDiscussionPost.id))
    .leftJoin(quotedStoryProfile, eq(quotedStoryDiscussionPost.userId, quotedStoryProfile.userId))
    .where(eq(storyDiscussionPosts.userId, userId))
    .orderBy(desc(storyDiscussionPosts.createdAt));
}

export function canonicalProviderHostname(value: string) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export async function listUserProviderHostnames(userId: number) {
  const feeds = await listFeeds(userId);
  return Array.from(new Set(feeds.map((feed) => canonicalProviderHostname(feed.url)).filter(Boolean))).sort();
}

export async function getOrCreateProviderCommunity(providerHostname: string): Promise<ProviderCommunity | undefined> {
  const db = await getDb();
  if (!db || !providerHostname) return undefined;
  const existing = (await db.select().from(providerCommunities).where(eq(providerCommunities.providerHostname, providerHostname)).limit(1))[0];
  if (existing) return existing;
  try { await db.insert(providerCommunities).values({ providerHostname }); } catch { /* Concurrent creation is safe; read the shared row below. */ }
  return (await db.select().from(providerCommunities).where(eq(providerCommunities.providerHostname, providerHostname)).limit(1))[0];
}

export async function findProviderCommunity(providerHostname: string): Promise<ProviderCommunity | undefined> {
  const db = await getDb();
  if (!db || !providerHostname) return undefined;
  return (await db.select().from(providerCommunities).where(eq(providerCommunities.providerHostname, providerHostname)).limit(1))[0];
}

export async function listProviderCommunitiesForUser(userId: number): Promise<ProviderCommunity[]> {
  const providerHostnames = await listUserProviderHostnames(userId);
  await Promise.all(providerHostnames.map((providerHostname) => getOrCreateProviderCommunity(providerHostname)));
  const db = await getDb();
  if (!db) return [];
  return db.select().from(providerCommunities).orderBy(asc(providerCommunities.providerHostname));
}

export async function listPostableProviderCommunitiesForUser(userId: number): Promise<ProviderCommunity[]> {
  const providerHostnames = await listUserProviderHostnames(userId);
  const communities = await Promise.all(providerHostnames.map((providerHostname) => getOrCreateProviderCommunity(providerHostname)));
  return communities.filter((community): community is ProviderCommunity => Boolean(community));
}

export async function getProviderCommunityForUser(userId: number, providerHostname: string): Promise<ProviderCommunity | undefined> {
  const normalized = canonicalProviderHostname(`https://${providerHostname}`) || providerHostname.toLowerCase().replace(/^www\./, "");
  return findProviderCommunity(normalized);
}

export async function getProviderCommunityForPosting(userId: number, providerHostname: string): Promise<ProviderCommunity | undefined> {
  const normalized = canonicalProviderHostname(`https://${providerHostname}`) || providerHostname.toLowerCase().replace(/^www\./, "");
  const savedProviders = await listUserProviderHostnames(userId);
  if (!savedProviders.includes(normalized)) return undefined;
  return getOrCreateProviderCommunity(normalized);
}

export async function createProviderCommunityPost(userId: number, providerHostname: string, title: string, body?: string | null): Promise<ProviderCommunityPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getProviderCommunityForPosting(userId, providerHostname);
  if (!community) return undefined;
  const result = await db.insert(providerCommunityPosts).values({ communityId: community.id, userId, title, body: body || null });
  return (await db.select().from(providerCommunityPosts).where(eq(providerCommunityPosts.id, Number(result[0].insertId))).limit(1))[0];
}

export async function listProviderCommunityPostsForUser(userId: number, providerHostname: string) {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getProviderCommunityForUser(userId, providerHostname);
  if (!community) return undefined;
  const rows = await db.select({
    id: providerCommunityPosts.id,
    communityId: providerCommunityPosts.communityId,
    userId: providerCommunityPosts.userId,
    title: providerCommunityPosts.title,
    body: providerCommunityPosts.body,
    createdAt: providerCommunityPosts.createdAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
  }).from(providerCommunityPosts)
    .leftJoin(userProfiles, eq(providerCommunityPosts.userId, userProfiles.userId))
    .where(eq(providerCommunityPosts.communityId, community.id))
    .orderBy(desc(providerCommunityPosts.createdAt));
  return { community, posts: rows };
}

export async function listAllProviderCommunityPosts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: providerCommunityPosts.id,
    communityId: providerCommunityPosts.communityId,
    providerHostname: providerCommunities.providerHostname,
    userId: providerCommunityPosts.userId,
    title: providerCommunityPosts.title,
    body: providerCommunityPosts.body,
    createdAt: providerCommunityPosts.createdAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
  }).from(providerCommunityPosts)
    .innerJoin(providerCommunities, eq(providerCommunityPosts.communityId, providerCommunities.id))
    .leftJoin(userProfiles, eq(providerCommunityPosts.userId, userProfiles.userId))
    .orderBy(desc(providerCommunityPosts.createdAt));
}

export async function listProfileProviderCommunityPosts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: providerCommunityPosts.id,
    communityId: providerCommunityPosts.communityId,
    providerHostname: providerCommunities.providerHostname,
    title: providerCommunityPosts.title,
    body: providerCommunityPosts.body,
    createdAt: providerCommunityPosts.createdAt,
  }).from(providerCommunityPosts)
    .innerJoin(providerCommunities, eq(providerCommunityPosts.communityId, providerCommunities.id))
    .where(eq(providerCommunityPosts.userId, userId))
    .orderBy(desc(providerCommunityPosts.createdAt));
}

export type TopicCommunityInput = {
  slug: string;
  name: string;
  description?: string | null;
};

export type TopicThreadInput = {
  title: string;
  body?: string | null;
  sourceStoryUrl?: string | null;
};

export async function getTopicCommunityBySlug(slug: string): Promise<TopicCommunity | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(topicCommunities).where(eq(topicCommunities.slug, slug)).limit(1))[0];
}

export async function isTopicCommunityMember(userId: number, communityId: number) {
  const db = await getDb();
  if (!db) return false;
  return Boolean((await db.select({ userId: topicCommunityMembers.userId }).from(topicCommunityMembers)
    .where(and(eq(topicCommunityMembers.communityId, communityId), eq(topicCommunityMembers.userId, userId))).limit(1))[0]);
}

async function countTopicCommunityMembers(communityId: number) {
  const db = await getDb();
  if (!db) return 0;
  return (await db.select({ userId: topicCommunityMembers.userId }).from(topicCommunityMembers)
    .where(eq(topicCommunityMembers.communityId, communityId))).length;
}

async function countTopicCommunityThreads(communityId: number) {
  const db = await getDb();
  if (!db) return 0;
  return (await db.select({ id: topicCommunityThreads.id }).from(topicCommunityThreads)
    .where(eq(topicCommunityThreads.communityId, communityId))).length;
}

export async function listTopicCommunitiesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const communities = await db.select().from(topicCommunities).orderBy(desc(topicCommunities.updatedAt));
  return Promise.all(communities.map(async (community) => ({
    ...community,
    isMember: await isTopicCommunityMember(userId, community.id),
    memberCount: await countTopicCommunityMembers(community.id),
    threadCount: await countTopicCommunityThreads(community.id),
  }))); 
}

export async function listAllTopicCommunityFeed() {
  const db = await getDb();
  if (!db) return [];
  const posts = await db.select({ id: topicCommunityPosts.id, communityId: topicCommunityPosts.communityId, communitySlug: topicCommunities.slug, communityName: topicCommunities.name, userId: topicCommunityPosts.userId, title: topicCommunityPosts.title, body: topicCommunityPosts.body, createdAt: topicCommunityPosts.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityPosts).innerJoin(topicCommunities, eq(topicCommunityPosts.communityId, topicCommunities.id)).leftJoin(userProfiles, eq(topicCommunityPosts.userId, userProfiles.userId)).orderBy(desc(topicCommunityPosts.createdAt));
  const threads = await db.select({ id: topicCommunityThreads.id, communityId: topicCommunityThreads.communityId, communitySlug: topicCommunities.slug, communityName: topicCommunities.name, userId: topicCommunityThreads.userId, title: topicCommunityThreads.title, body: topicCommunityThreads.body, sourceStoryUrl: topicCommunityThreads.sourceStoryUrl, createdAt: topicCommunityThreads.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityThreads).innerJoin(topicCommunities, eq(topicCommunityThreads.communityId, topicCommunities.id)).leftJoin(userProfiles, eq(topicCommunityThreads.userId, userProfiles.userId)).orderBy(desc(topicCommunityThreads.createdAt));
  const enrichedThreads = await Promise.all(threads.map(async (thread) => ({ ...thread, kind: "thread" as const, story: thread.sourceStoryUrl ? await getTopicThreadStory(thread.userId, thread.sourceStoryUrl) : undefined })));
  return [...posts.map((post) => ({ ...post, kind: "post" as const })), ...enrichedThreads].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function createTopicCommunity(userId: number, input: TopicCommunityInput): Promise<TopicCommunity | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.insert(topicCommunities).values({ ...input, description: input.description || null, creatorUserId: userId });
    const communityId = Number(result[0].insertId);
    await db.insert(topicCommunityMembers).values({ communityId, userId }).onDuplicateKeyUpdate({ set: { communityId } });
    return (await db.select().from(topicCommunities).where(eq(topicCommunities.id, communityId)).limit(1))[0];
  } catch {
    return undefined;
  }
}

export async function joinTopicCommunity(userId: number, slug: string): Promise<TopicCommunity | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getTopicCommunityBySlug(slug);
  if (!community) return undefined;
  await db.insert(topicCommunityMembers).values({ communityId: community.id, userId }).onDuplicateKeyUpdate({ set: { communityId: community.id } });
  return community;
}

export async function leaveTopicCommunity(userId: number, slug: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const community = await getTopicCommunityBySlug(slug);
  if (!community) return false;
  await db.delete(topicCommunityMembers).where(and(eq(topicCommunityMembers.communityId, community.id), eq(topicCommunityMembers.userId, userId)));
  return true;
}

export async function createTopicCommunityPost(userId: number, slug: string, body: string, title?: string | null): Promise<TopicCommunityPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getTopicCommunityBySlug(slug);
  if (!community || !(await isTopicCommunityMember(userId, community.id))) return undefined;
  const result = await db.insert(topicCommunityPosts).values({ communityId: community.id, userId, title: title || null, body });
  return (await db.select().from(topicCommunityPosts).where(eq(topicCommunityPosts.id, Number(result[0].insertId))).limit(1))[0];
}

export async function userHasSavedStoryUrl(userId: number, sourceStoryUrl: string) {
  const db = await getDb();
  if (!db) return false;
  return Boolean((await db.select({ id: rssArticles.id }).from(rssArticles)
    .innerJoin(rssFeeds, eq(rssArticles.feedId, rssFeeds.id))
    .where(and(eq(rssFeeds.userId, userId), eq(rssArticles.link, sourceStoryUrl))).limit(1))[0]);
}

export async function getTopicThreadStory(userId: number, sourceStoryUrl: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select({ id: rssArticles.id, title: rssArticles.title, link: rssArticles.link, description: rssArticles.description, thumbnailUrl: rssArticles.thumbnailUrl, videoUrl: rssArticles.videoUrl, videoMimeType: rssArticles.videoMimeType, publishedAt: rssArticles.publishedAt }).from(rssArticles)
    .innerJoin(rssFeeds, eq(rssArticles.feedId, rssFeeds.id))
    .where(and(eq(rssFeeds.userId, userId), eq(rssArticles.link, sourceStoryUrl))).limit(1))[0];
}

export async function createTopicCommunityThread(userId: number, slug: string, input: TopicThreadInput): Promise<TopicCommunityThread | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getTopicCommunityBySlug(slug);
  if (!community || !(await isTopicCommunityMember(userId, community.id))) return undefined;
  if (input.sourceStoryUrl && !(await userHasSavedStoryUrl(userId, input.sourceStoryUrl))) return undefined;
  try {
    const result = await db.insert(topicCommunityThreads).values({
      communityId: community.id,
      userId,
      title: input.title,
      body: input.body || null,
      sourceStoryUrl: input.sourceStoryUrl || null,
    });
    return (await db.select().from(topicCommunityThreads).where(eq(topicCommunityThreads.id, Number(result[0].insertId))).limit(1))[0];
  } catch {
    return undefined;
  }
}

export async function getTopicCommunityThread(threadId: number): Promise<TopicCommunityThread | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(topicCommunityThreads).where(eq(topicCommunityThreads.id, threadId)).limit(1))[0];
}

export async function getTopicCommunityPost(postId: number): Promise<TopicCommunityPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(topicCommunityPosts).where(eq(topicCommunityPosts.id, postId)).limit(1))[0];
}

export async function createTopicCommunityReply(userId: number, threadId: number, body: string): Promise<TopicCommunityReply | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const thread = await getTopicCommunityThread(threadId);
  if (!thread || !(await isTopicCommunityMember(userId, thread.communityId))) return undefined;
  const result = await db.insert(topicCommunityReplies).values({ threadId, userId, body });
  return (await db.select().from(topicCommunityReplies).where(eq(topicCommunityReplies.id, Number(result[0].insertId))).limit(1))[0];
}

export async function createTopicCommunityPostReply(userId: number, postId: number, body: string) {
  const db = await getDb();
  if (!db) return undefined;
  const post = await getTopicCommunityPost(postId);
  if (!post || !(await isTopicCommunityMember(userId, post.communityId))) return undefined;
  const result = await db.insert(topicCommunityPostReplies).values({ postId, userId, body });
  return (await db.select().from(topicCommunityPostReplies).where(eq(topicCommunityPostReplies.id, Number(result[0].insertId))).limit(1))[0];
}

export async function getTopicCommunityDiscussion(userId: number, slug: string, kind: "post" | "thread", entryId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getTopicCommunityBySlug(slug);
  if (!community) return undefined;
  const base = { community, isMember: await isTopicCommunityMember(userId, community.id), kind };
  if (kind === "thread") {
    const entry = (await db.select({ id: topicCommunityThreads.id, communityId: topicCommunityThreads.communityId, userId: topicCommunityThreads.userId, title: topicCommunityThreads.title, body: topicCommunityThreads.body, sourceStoryUrl: topicCommunityThreads.sourceStoryUrl, createdAt: topicCommunityThreads.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityThreads).leftJoin(userProfiles, eq(topicCommunityThreads.userId, userProfiles.userId)).where(and(eq(topicCommunityThreads.id, entryId), eq(topicCommunityThreads.communityId, community.id))).limit(1))[0];
    if (!entry) return undefined;
    const replies = await db.select({ id: topicCommunityReplies.id, userId: topicCommunityReplies.userId, body: topicCommunityReplies.body, createdAt: topicCommunityReplies.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityReplies).leftJoin(userProfiles, eq(topicCommunityReplies.userId, userProfiles.userId)).where(eq(topicCommunityReplies.threadId, entryId)).orderBy(asc(topicCommunityReplies.createdAt));
    return { ...base, entry: { ...entry, story: entry.sourceStoryUrl ? await getTopicThreadStory(entry.userId, entry.sourceStoryUrl) : undefined }, replies };
  }
  const entry = (await db.select({ id: topicCommunityPosts.id, communityId: topicCommunityPosts.communityId, userId: topicCommunityPosts.userId, title: topicCommunityPosts.title, body: topicCommunityPosts.body, createdAt: topicCommunityPosts.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityPosts).leftJoin(userProfiles, eq(topicCommunityPosts.userId, userProfiles.userId)).where(and(eq(topicCommunityPosts.id, entryId), eq(topicCommunityPosts.communityId, community.id))).limit(1))[0];
  if (!entry) return undefined;
  const replies = await db.select({ id: topicCommunityPostReplies.id, userId: topicCommunityPostReplies.userId, body: topicCommunityPostReplies.body, createdAt: topicCommunityPostReplies.createdAt, displayName: userProfiles.displayName, username: userProfiles.username }).from(topicCommunityPostReplies).leftJoin(userProfiles, eq(topicCommunityPostReplies.userId, userProfiles.userId)).where(eq(topicCommunityPostReplies.postId, entryId)).orderBy(asc(topicCommunityPostReplies.createdAt));
  return { ...base, entry, replies };
}

export async function getTopicCommunityForUser(userId: number, slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const community = await getTopicCommunityBySlug(slug);
  if (!community) return undefined;
  const rows = await db.select({
    id: topicCommunityThreads.id,
    communityId: topicCommunityThreads.communityId,
    userId: topicCommunityThreads.userId,
    title: topicCommunityThreads.title,
    body: topicCommunityThreads.body,
    sourceStoryUrl: topicCommunityThreads.sourceStoryUrl,
    createdAt: topicCommunityThreads.createdAt,
    updatedAt: topicCommunityThreads.updatedAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
  }).from(topicCommunityThreads)
    .leftJoin(userProfiles, eq(topicCommunityThreads.userId, userProfiles.userId))
    .where(eq(topicCommunityThreads.communityId, community.id))
    .orderBy(desc(topicCommunityThreads.createdAt));
  const threadIds = rows.map((thread) => thread.id);
  const replyRows = threadIds.length ? await db.select({
    id: topicCommunityReplies.id,
    threadId: topicCommunityReplies.threadId,
    userId: topicCommunityReplies.userId,
    body: topicCommunityReplies.body,
    createdAt: topicCommunityReplies.createdAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
  }).from(topicCommunityReplies)
    .leftJoin(userProfiles, eq(topicCommunityReplies.userId, userProfiles.userId))
    .where(inArray(topicCommunityReplies.threadId, threadIds))
    .orderBy(asc(topicCommunityReplies.createdAt)) : [];
  const repliesByThread = new Map<number, typeof replyRows>();
  for (const reply of replyRows) repliesByThread.set(reply.threadId, [...(repliesByThread.get(reply.threadId) ?? []), reply]);
  const posts = await db.select({
    id: topicCommunityPosts.id,
    communityId: topicCommunityPosts.communityId,
    userId: topicCommunityPosts.userId,
    title: topicCommunityPosts.title,
    body: topicCommunityPosts.body,
    createdAt: topicCommunityPosts.createdAt,
    displayName: userProfiles.displayName,
    username: userProfiles.username,
  }).from(topicCommunityPosts)
    .leftJoin(userProfiles, eq(topicCommunityPosts.userId, userProfiles.userId))
    .where(eq(topicCommunityPosts.communityId, community.id))
    .orderBy(desc(topicCommunityPosts.createdAt));
  const threads = await Promise.all(rows.map(async (thread) => ({ ...thread, replies: repliesByThread.get(thread.id) ?? [], story: thread.sourceStoryUrl ? await getTopicThreadStory(thread.userId, thread.sourceStoryUrl) : undefined })));
  const feed = [
    ...posts.map((post) => ({ ...post, kind: "post" as const })),
    ...threads.map((thread) => ({ ...thread, kind: "thread" as const })),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return {
    community,
    isMember: await isTopicCommunityMember(userId, community.id),
    memberCount: await countTopicCommunityMembers(community.id),
    posts,
    threads,
    feed,
  };
}
