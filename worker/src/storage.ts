import type { Env } from './envTypes';

export interface User {
	username: string;
	salt: string;
	passwordHash: string;
}

export interface Room {
	roomId: string;
	name: string;
	owner: string;
}

export interface UserSession {
	username: string;
	sessionId: string;
	ttl?: number; // Time to live in seconds
}

export enum UserRole {
	USER = 'user',
	ASSISTANT = 'assistant',
}

export interface Message {
	id: string; // Unique identifier for the message
	roomId: string;
	role: UserRole;
	text: string;
	imageKey?: string; // Optional image key for R2 storage
}

export interface ImageRaw {
	key: string; // Unique identifier for the image
	data: string | ReadableStream | ArrayBuffer | Blob | ArrayBufferView; // Data of the image
	mimeType: string; // MIME type of the image
}

export interface ImageBase64 {
	key: string; // Unique identifier for the image
	data: string; // Base64 encoded data of the image
	mimeType: string; // MIME type of the image
}

async function initDB(env: Env): Promise<void> {
	await env.DB.prepare(`
		CREATE TABLE IF NOT EXISTS users (
			username TEXT PRIMARY KEY,
			salt TEXT NOT NULL,
			passwordHash TEXT NOT NULL
		);
	`).run();
	await env.DB.prepare(`
		CREATE TABLE IF NOT EXISTS rooms (
			roomId TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			owner TEXT NOT NULL,
			FOREIGN KEY (owner) REFERENCES users(username)
		);
	`).run();
	await env.DB.prepare(`
		CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			roomId TEXT NOT NULL,
			role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
			text TEXT NOT NULL,
			imageKey TEXT,
			FOREIGN KEY (roomId) REFERENCES rooms(roomId)
		);
	`).run();
}

export async function storeUser(env: Env, user: User): Promise<void> {
	await initDB(env);
	await env.DB.prepare(`
		INSERT INTO users (username, salt, passwordHash) VALUES (?, ?, ?)
	`).bind(user.username, user.salt, user.passwordHash).run();
}

export async function loadUser(env: Env, username: string): Promise<User | null> {
	await initDB(env);
	const result: User | null = await env.DB.prepare(`
		SELECT username, salt, passwordHash FROM users WHERE username = ?
	`).bind(username).first();
	return result ? { username: result.username, salt: result.salt, passwordHash: result.passwordHash } : null;
}

export async function storeRoom(env: Env, room: Room): Promise<void> {
	await initDB(env);
	await env.DB.prepare(`
		INSERT INTO rooms (roomId, name, owner) VALUES (?, ?, ?)
	`).bind(room.roomId, room.name, room.owner).run();
}

export async function loadRoom(env: Env, roomId: string): Promise<Room | null> {
	await initDB(env);
	const result: Room | null = await env.DB.prepare(`
		SELECT roomId, name, owner FROM rooms WHERE roomId = ?
	`).bind(roomId).first();
	return result ? { roomId: result.roomId, name: result.name, owner: result.owner } : null;
}

export async function loadRooms(env: Env, owner: string): Promise<Room[]> {
	await initDB(env);
	const results = await env.DB.prepare(`
		SELECT roomId, name, owner FROM rooms WHERE owner = ?
	`).bind(owner).all();
	return results.results.map((row: any) => ({
		roomId: row.roomId,
		name: row.name,
		owner: row.owner,
	}));
}

export async function storeSession(env: Env, session: UserSession): Promise<void> {
	await env.kv_store.put(session.sessionId, JSON.stringify({ username: session.username }), {
		expirationTtl: session.ttl!
	});
}

export async function loadSession(env: Env, sessionId: string): Promise<UserSession | null> {
	const data = await env.kv_store.get(sessionId);
	if (!data) return null;
	const sessionData = JSON.parse(data);
	return { username: sessionData.username, sessionId };
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
	await env.kv_store.delete(sessionId);
}

export async function extendSession(env: Env, sessionId: string): Promise<UserSession> {
	const session = await loadSession(env, sessionId);
	if (session) {
		const nextSession = {
			username: session.username,
			sessionId: session.sessionId,
			ttl: 3600 // Extend TTL to 1 hour (3600 seconds)
		};
		await storeSession(env, nextSession); // Re-store to extend TTL
		return nextSession;
	}
	else {
		throw new Error('Session not found');
	}
}

export async function storeMessage(env: Env, message: Message): Promise<void> {
	await initDB(env);
	await env.DB.prepare(`
		INSERT INTO messages (id, roomId, role, text, imageKey) VALUES (?, ?, ?, ?, ?)
	`).bind(message.id, message.roomId, message.role, message.text, message.imageKey || null).run();
	const key = `${message.roomId}:${message.id}`;
	await env.kv_store.put(key, JSON.stringify(message), {
		expirationTtl: 604800 // Message expires in 7 days
	});
}

export async function loadMessage(env: Env, messageId: string): Promise<Message | null> {
	const data = await env.kv_store.get(messageId);
	if (data) {
		const messageData = JSON.parse(data);
		// extend ttl
		await env.kv_store.put(messageId, JSON.stringify(messageData), {
			expirationTtl: 604800 // Extend TTL to 7 days
		});
		return {
			id: messageData.id,
			roomId: messageData.roomId,
			role: messageData.role,
			text: messageData.text,
			imageKey: messageData.imageKey || undefined
		};
	}
	const result: Message | null = await env.DB.prepare(`
		SELECT id, roomId, role, text, imageKey FROM messages WHERE id = ?
	`).bind(messageId).first();
	if (result) {
		// Store in KV for faster access next time
		await env.kv_store.put(result.id, JSON.stringify(result), {
			expirationTtl: 604800 // Message expires in 7 days
		});
		return {
			id: result.id,
			roomId: result.roomId,
			role: result.role,
			text: result.text,
			imageKey: result.imageKey || undefined
		};
	}
	return null;
}

export async function loadMessagesIdByRoom(env: Env, roomId: string, cursor: string | null): Promise<{ messageIds: string[], cursor: string | null }> {
	const limit = 100; // Number of messages to fetch per request
	let query = `
		SELECT id FROM messages WHERE roomId = ? ORDER BY id DESC LIMIT ?
	`;
	if (cursor) {
		query += ` AND id < ?`;
	}
	const params: any[] = [roomId, limit];
	if (cursor) {
		params.push(cursor);
	}
	const results = await env.DB.prepare(query).bind(...params).all();
	const messageIds = results.results.map((row: any) => row.id).reverse(); // Reverse to get oldest first

	let nextCursor: string | null = null;
	if (messageIds.length === limit) {
		nextCursor = messageIds[0]; // Set next cursor to the last message ID if we reached the limit
	}

	return { messageIds, cursor: nextCursor };
}

export async function storeImage(env: Env, image: ImageRaw): Promise<void> {
	await env.images.put(image.key, image.data, {
		httpMetadata: {
			contentType: image.mimeType, // Adjust based on actual image type
		},
	});
}

export async function storeImageBase64(env: Env, image: ImageBase64): Promise<void> {
	await env.images.put(image.key, image.data, {
		httpMetadata: {
			contentType: image.mimeType, // Adjust based on actual image type
		},
	});
}

export async function loadImageBase64(env: Env, key: string): Promise<ImageRaw | null> {
	const object = await env.images.get(key);
	if (!object) return null;
	const data = await object.arrayBuffer();
	return {
		key,
		data,
		mimeType: object.httpMetadata?.contentType || 'application/octet-stream',
	};
}
