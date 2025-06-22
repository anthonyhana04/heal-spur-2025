/**
 * Cloudflare Worker proxy for Google Gemini API + R2 file-upload helper.
 *
 *	Endpoints
 *	├─ POST /generate	 – proxy a Gemini text/vision request (same shape as Gemini API).
 *	├─ POST /upload		 – accept a base64-encoded file, persist it to Cloudflare R2 and forward it to
 *	│										 Gemini Files API. Returns the File object { name, uri, mimeType, … }.
 *	└─ /r2/*					 – Direct R2 bucket operations (GET/PUT/DELETE)
 *
 *	The /upload route expects JSON of the form:
 *	{
 *		"fileName": "myImage.jpg",
 *		"mimeType": "image/jpeg",
 *		"data": "<base64>" ,					// raw file bytes encoded as base64
 *		"displayName": "optional human readable label"
 *	}
 */
import { AutoRouter } from 'itty-router'
import { GoogleGenAI } from '@google/genai';
import { saveMessage, getMessages, saveRoom, getRooms } from './storage';
import { uuidv7 } from 'uuidv7';

const router = AutoRouter()
router
	.post('/upload', handleUpload)
	.post('/generate', handleGenerate)
	.post('/room', createRoom)
	.get('/rooms', listRooms)
	.post('/messages', listMessages)
	.post('/register', registerUser)
	.post('/login', loginUser);

declare global {
	interface ImportMeta {
		env?: {
			MODE?: string;
		};
	}
}

export interface Env {
	GOOGLE_API_KEY: string;
	MY_BUCKET: R2Bucket; // R2 bucket binding defined in wrangler.toml / wrangler.json
	CHAT_LOGS: KVNamespace; // Optional KV namespace for chat logs
}

// Helpful CORS headers
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default router satisfies ExportedHandler<Env>;

/**
 * /upload – persist file to R2 and forward it to Gemini Files API.
 */
async function handleUpload(request: Request, env: Env): Promise<Response> {
	const body = await request.json<{
		fileName: string;
		mimeType: string;
		data: string; // base64
	}>();

	const { fileName, mimeType, data } = body;
	if (!fileName || !mimeType || !data) {
		return new Response(
			JSON.stringify({ error: "fileName, mimeType and data fields are required" }),
			{ status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);
	}

	// Decode base64 → ArrayBuffer
	const binaryString = atob(data);
	const binary = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		binary[i] = binaryString.charCodeAt(i);
	}
	// Persist in R2 (the key will be the original filename with uuid prefix)
	const r2Key = `${crypto.randomUUID()}-${fileName}`;
	await env.MY_BUCKET.put(r2Key, binary, {
		httpMetadata: { contentType: mimeType },
	});
	return new Response(
		JSON.stringify({
			name: fileName,
			mimeType,
			r2Key, // Include R2 key for reference
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		}
	);
}

/**
 * /generate – proxy a Gemini text/vision request.
 */
async function handleGenerate(request: Request, env: Env): Promise<Response> {
	try {
		const userId = request.headers.get("X-User-Id"); // Replace with actual user ID logic
		if (!userId) {
			return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
		}
		const genAI = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
		const { roomId, content, url, mimeType } = (await request.json() as any);
		await saveMessage(env, userId, roomId, "user", content, mimeType, url);
		const { messages } = (await getMessages(env, userId, roomId));
		const contents = messages.map((item: any) => {
			const parts: any = [{ text: item.content }];
			if (item.url && item.mimeType) {
				const fileData = {
					mimeType: item.mimeType,
					fileUri: `${item.url}`,
				};
				parts.push(fileData);
			}
			return {
				parts,
				role: item.role,
			};
		});
		const response = await genAI.models.generateContentStream({
			model: "gemini-2.5-flash",
			contents: contents,
		});
		const { readable, writable } = new TransformStream();
		for await (const chunk of response) {
			if (chunk.text !== undefined) {
				const text = chunk.text;
				const responseChunk = { text };
				writable.getWriter().write(JSON.stringify(responseChunk) + "\n");
			}
			else {
				// Handle unexpected chunk format
				console.warn("Unexpected chunk format:", chunk);
			}
		}
		return new Response(readable, {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				...CORS_HEADERS,
				"Cache-Control": "no-cache",
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
			{ status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);
	}
}

/**
 *rooms – create a new room.
 */

async function createRoom(request: Request, env: Env): Promise<Response> {
	const body = await request.json<{ initialTitle: string | null }>();
	const userId = request.headers.get("X-User-Id"); // Replace with actual user ID logic
	if (!userId) {
		return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
	}
	try {
		const meta = await saveRoom(env, userId, body.initialTitle);
		return new Response(JSON.stringify(meta), {
			status: 201,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
			{ status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);
	}
}

/**
 * /rooms – get all rooms for a user.
 */
async function listRooms(request: Request, env: Env): Promise<Response> {
	const userId = request.headers.get("X-User-Id"); // Replace with actual user ID logic
	if (!userId) {
		return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
	}
	try {
		const rooms = await getRooms(env, userId);
		return new Response(JSON.stringify(rooms), {
			status: 200,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
			{ status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);
	}
}

/**
 * listMessages – get all messages in a room with pagination.
 */
async function listMessages(request: Request, env: Env): Promise<Response> {
	const userId = request.headers.get("X-User-Id"); // Replace with actual user ID logic
	if (!userId) {
		return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
	}
	try {
		const { roomId, cursor } = await request.json<{ roomId: string; cursor?: string }>();
		if (!roomId) {
			return new Response(JSON.stringify({ error: "Room ID is required" }), { status: 400 });
		}
		return new Response(
			JSON.stringify(await getMessages(env, userId, roomId, cursor)),
			{
				status: 200,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			}
		);
	}
	catch (error) {
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
			{ status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);
	}
}

// ---------------------------------------------------------------------------
// Auth helpers & handlers
// ---------------------------------------------------------------------------

const USER_PREFIX = 'users/';
const SESSION_PREFIX = 'sessions/';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

function userKey(username: string) {
	return `${USER_PREFIX}${username.toLowerCase()}`;
}
function sessionKey(sessionId: string) {
	return `${SESSION_PREFIX}${sessionId}`;
}

function parseBasicAuth(request: Request): { username: string; password: string } | null {
	const auth = request.headers.get('Authorization');
	if (!auth || !auth.startsWith('Basic ')) return null;
	try {
		const decoded = atob(auth.slice('Basic '.length));
		const [username, ...rest] = decoded.split(':');
		const password = rest.join(':'); // in case password contains ':'
		if (!username || !password) return null;
		return { username, password };
	} catch {
		return null;
	}
}

async function sha256(message: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const bytes = Array.from(new Uint8Array(hashBuffer));
	return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function registerUser(request: Request, env: Env): Promise<Response> {
	// Try to extract credentials from Basic Auth header; fallback to JSON body
	let creds = parseBasicAuth(request);
	if (!creds) {
		try {
			const body = await request.json<{ username: string; password: string }>();
			creds = { username: body.username, password: body.password };
		} catch {
			creds = null;
		}
	}
	if (!creds || !creds.username || !creds.password) {
		return new Response(JSON.stringify({ error: 'Username and password are required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}
	const usernameKey = userKey(creds.username);
	// Check if user already exists
	const existing = await env.CHAT_LOGS.get(usernameKey);
	if (existing) {
		return new Response(JSON.stringify({ error: 'Username already exists' }), {
			status: 409,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}
	const passwordHash = await sha256(creds.password);
	const userObj = {
		username: creds.username,
		passwordHash,
		createdAt: Date.now(),
	};
	await env.CHAT_LOGS.put(usernameKey, JSON.stringify(userObj));
	return new Response(JSON.stringify({ message: 'User registered successfully' }), {
		status: 201,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}

async function loginUser(request: Request, env: Env): Promise<Response> {
	const creds = parseBasicAuth(request);
	if (!creds) {
		return new Response(JSON.stringify({ error: 'Basic Authorization header is required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="User Visible Realm"', ...CORS_HEADERS },
		});
	}
	const userRaw = await env.CHAT_LOGS.get(userKey(creds.username));
	if (!userRaw) {
		return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}
	const user = JSON.parse(userRaw) as { passwordHash: string };
	const incomingHash = await sha256(creds.password);
	if (incomingHash !== user.passwordHash) {
		return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}
	const sessionId = uuidv7();
	await env.CHAT_LOGS.put(sessionKey(sessionId), creds.username, { expirationTtl: SESSION_TTL });
	return new Response(JSON.stringify({ sessionId }), {
		status: 200,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}
