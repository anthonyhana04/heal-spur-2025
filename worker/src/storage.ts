import { uuidv7 } from 'uuidv7';
import type { Env } from './index';

/**
 * A chat room lives under one specific Auth0 `userId` and is identified by a uuid.
 * All KV keys follow the convention:  {userId}/rooms/{roomId}/messages/{messageUuid}
 * – The *room* metadata itself is stored at key:
 *      {userId}/rooms/{roomId}/meta
 * – Each *message* in a room is stored individually so we can stream / paginate later.
 */

export interface RoomMeta {
	id: string;          // uuid – same as the roomId
	title: string;       // user friendly name (first user prompt or explicit name)
	createdAt: number;   // Date.now()
	updatedAt: number;   // gets touched on every new message
}

export type Role = 'user' | 'model';
export interface ChatMessage {
	id: string;          // uuid – makes it easy to sort chronologically
	role: Role;
	content: string;
	imageUrl?: string;
	mimeType?: string;
	timestamp: number;   // Date.now()
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */
const ROOM_META_SUFFIX = 'meta';
const MESSAGE_PREFIX = 'messages';

function roomMetaKey(userId: string, roomId: string) {
	return `${userId}/rooms/${roomId}/${ROOM_META_SUFFIX}`;
}
function messageKey(userId: string, roomId: string, msgId: string) {
	return `${userId}/rooms/${roomId}/${MESSAGE_PREFIX}/${msgId}`;
}
function messagePrefix(userId: string, roomId: string) {
	return `${userId}/rooms/${roomId}/${MESSAGE_PREFIX}/`;
}
function roomsPrefix(userId: string) {
	return `${userId}/rooms/`;
}

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Creates a new room and immediately stores its metadata.
 */
export async function saveRoom(env: Env, userId: string, initialTitle: string | null): Promise<RoomMeta> {
	const now = Date.now();
	const id = uuidv7();
	const meta: RoomMeta = {
		id,
		title: initialTitle ?? 'New chat',
		createdAt: now,
		updatedAt: now,
	};
	await env.CHAT_LOGS.put(roomMetaKey(userId, id), JSON.stringify(meta));
	return meta;
}

/**
 * Returns all rooms for a user (unsorted list of RoomMeta).
 */
export async function getRooms(env: Env, userId: string): Promise<RoomMeta[]> {
	const list = await env.CHAT_LOGS.list({ prefix: roomsPrefix(userId), limit: 32 });
	const metas: RoomMeta[] = [];
	for (const { name } of list.keys) {
		if (name.endsWith(`/${ROOM_META_SUFFIX}`)) {
			const raw = await env.CHAT_LOGS.get(name);
			if (raw) metas.push(JSON.parse(raw));
		}
	}
	metas.sort((a, b) => b.updatedAt - a.updatedAt);
	return metas;
}

/**
 * Saves a single message in a room and updates the room's `updatedAt` timestamp.
 */
export async function saveMessage(env: Env, userId: string, roomId: string, role: Role, content: string, mimeType?: string, key?: string): Promise<ChatMessage> {
	const id = uuidv7();
	const msg: ChatMessage = {
		id,
		role,
		content,
		mimeType,
		...(key ? { key: key } : {}),
		...(mimeType ? { mimeType: mimeType } : {}),
		timestamp: Date.now(),
	};
	// Store message
	await env.CHAT_LOGS.put(messageKey(userId, roomId, id), JSON.stringify(msg));
	// Touch room meta
	const metaRaw = await env.CHAT_LOGS.get(roomMetaKey(userId, roomId));
	if (metaRaw) {
		const meta: RoomMeta = JSON.parse(metaRaw);
		meta.updatedAt = Date.now();
		await env.CHAT_LOGS.put(roomMetaKey(userId, roomId), JSON.stringify(meta));
	}
	return msg;
}

/**
 * Fetches the last `limit` messages from a room in chronological order.
 */
export async function getMessages(env: Env, userId: string, roomId: string, cursor: string | null = null, limit = 32): Promise<{ messages: ChatMessage[], cursor: string | null }> {
	const list = await env.CHAT_LOGS.list({ prefix: messagePrefix(userId, roomId), cursor, limit });
	// The KV list returns keys in *arbitrary* order → we need to fetch & sort ourselves.
	const msgs: ChatMessage[] = [];
	for (const { name } of list.keys) {
		const raw = await env.CHAT_LOGS.get(name);
		const obj = JSON.parse(raw || '{}');
		if (raw) msgs.push({
			id: obj.id,
			role: obj.role,
			content: obj.content,
			imageUrl: `${env.BUCKET_URL}/${obj.key}`, // Assuming the image URL is constructed this way
			mimeType: obj.mimeType,
			timestamp: obj.timestamp,
		});
	}
	msgs.sort((a, b) => a.timestamp - b.timestamp);
	return {
		messages: msgs,
		cursor: list.list_complete ? null : list.cursor, // If not complete, return the next cursor
	};
}
