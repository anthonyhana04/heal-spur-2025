import { AutoRouter } from "itty-router";
import { deleteSession, extendSession, loadImageBase64, loadMessage, loadMessagesIdByRoom, loadRoom, loadRooms, loadSession, loadUser, Message, storeImage, storeImageBase64, storeMessage, storeRoom, storeSession, storeUser, UserRole } from "./storage";
import { uuidv7 } from "uuidv7";
import { EventSourceParserStream } from "eventsource-parser/stream";

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
const registerCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
	const encoder = new TextEncoder();
	const encodedPassword = encoder.encode(password);
	const hashedBuffer = await crypto.subtle.digest(
		"SHA-256",
		new Uint8Array([...salt, ...encodedPassword])
	);
	return btoa(String.fromCharCode(...new Uint8Array(hashedBuffer)));
}

async function handleRegister(req: Request, env: Env): Promise<Response> {
	const corsHeaders = registerCors;
	const { username, password } = await req.json<{
		username: string;
		password: string;
	}>();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hashedPassword = await hashPassword(password, salt);
	const base64Salt = btoa(String.fromCharCode(...salt));
	try {
		await storeUser(env, {
			username,
			passwordHash: hashedPassword,
			salt: base64Salt,
		});
	} catch (error) {
		console.error("Error storing user:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
	return new Response(`User ${username} registered successfully`, {
		status: 201,
		headers: {
			"Content-Type": "text/plain",
			...corsHeaders,
		}
	});
}

const loginCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

async function handleLogin(req: Request, env: Env): Promise<Response> {
	const { username, password } = await req.json<{
		username: string;
		password: string;
	}>();
	const corsHeaders = loginCors;
	try {
		const user = await loadUser(env, username);
		if (!user) {
			return new Response("User not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				}
			});
		}
		const { passwordHash, salt } = user;
		const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
		const hashedPassword = await hashPassword(password, saltBytes);
		if (hashedPassword === passwordHash) {
			const sessionId = uuidv7();
			// Store the session ID in a cookie or database as needed
			const session = {
				sessionId,
				username,
				ttl: 60 * 60, // 1 hour TTL
			}
			await storeSession(env, session);
			return new Response(JSON.stringify(session), {
				status: 200,
				headers: {
					"Set-Cookie": `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict`,
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		} else {
			return new Response("Invalid credentials", {
				status: 401,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				}
			});
		}
	} catch (error) {
		console.error("Error during login:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}

const logoutCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

async function handleLogout(req: Request, env: Env): Promise<Response> {
	const sessionId = getSessionId(req);
	const corsHeaders = logoutCors;
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
	try {
		await deleteSession(env, sessionId);
		return new Response("Logout successful", {
			status: 200,
			headers: {
				"Set-Cookie": "sessionId=; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error during logout:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

const roomCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Credentials": "true",
};

async function handleCreateRoom(req: Request, env: Env): Promise<Response> {
	const corsHeaders = roomCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const { username } = session;
		const { name } = await req.json<{ name: string }>();
		const roomId = crypto.randomUUID();
		const room = {
			roomId,
			name,
			owner: username,
		}
		await storeRoom(env, room);
		return new Response(JSON.stringify(room), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error fetching rooms:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

const getRoomsCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Credentials": "true",
};
async function handleGetRooms(req: Request, env: Env): Promise<Response> {
	const corsHeaders = getRoomsCors;
	try {
		const sessionId = getSessionId(req);
		if (!sessionId) {
			return new Response("Not logged in", {
				status: 401,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const rooms = await loadRooms(env, session.username);
		return new Response(JSON.stringify(rooms), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error fetching rooms:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

async function handleGetRoom(req: Request, env: Env): Promise<Response> {
	const corsHeaders = roomCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const roomId = new URL(req.url).searchParams.get("roomId");
		if (!roomId) {
			return new Response("Room ID is required", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const room = await loadRoom(env, roomId);
		if (!room) {
			return new Response("Room not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		return new Response(JSON.stringify(room), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error fetching room:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

const uploadImageCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Credentials": "true",
};

async function handleUploadImage(req: Request, env: Env): Promise<Response> {
	const corsHeaders = uploadImageCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return Promise.resolve(new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		}));
	}
	const mimeType = req.headers.get("Content-Type");
	if (!mimeType || !mimeType.startsWith("image/")) {
		return Promise.resolve(new Response("Invalid image format", {
			status: 400,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		}));
	}
	try {
		const key = `images/${crypto.randomUUID()}`;
		const imgageData = await req.arrayBuffer();
		if (!imgageData) {
			return Promise.resolve(new Response("No image data provided", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				}
			}));
		}
		const storeImagePromise = storeImage(env, {
			key,
			data: imgageData,
			mimeType,
		});
		const imageDataBase64 = btoa(String.fromCharCode(...new Uint8Array(imgageData)));
		const storeImageBase64Promise = storeImageBase64(env, {
			key,
			data: imageDataBase64,
			mimeType,
		});
		await storeImagePromise;
		await storeImageBase64Promise;
		return new Response(JSON.stringify({ key }), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	}
	catch (error) {
		console.error("Error uploading image:", error);
		return Promise.resolve(new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		}));
	}
}

const getMessagesCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Credentials": "true",
};

async function handleGetMessages(req: Request, env: Env): Promise<Response> {
	const corsHeaders = getMessagesCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const roomId = new URL(req.url).searchParams.get("roomId");
		if (!roomId) {
			return new Response("Room ID is required", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const cursor = new URL(req.url).searchParams.get("cursor") || null;
		const messages = await loadMessagesIdByRoom(env, roomId, cursor);
		return new Response(JSON.stringify(messages), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error fetching messages:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

const messageCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Credentials": "true",
};

async function handleGetMessage(req: Request, env: Env): Promise<Response> {
	const corsHeaders = messageCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const messageId = new URL(req.url).searchParams.get("messageId");
		if (!messageId) {
			return new Response("Message ID is required", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const message = await loadMessage(env, messageId);
		if (!message) {
			return new Response("Message not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		return new Response(JSON.stringify(message), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error fetching message:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

async function handleCreateMessage(req: Request, env: Env): Promise<Response> {
	const corsHeaders = messageCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await loadSession(env, sessionId);
		if (!session) {
			return new Response("Session not found", {
				status: 404,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const body = await req.json<{ roomId: string; content: string, imageKey: string | null | undefined }>();
		console.log("Body:", body);
		const { roomId, content, imageKey } = body;
		if (!roomId || !content) {
			return new Response("Room ID and content are required", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
					...corsHeaders,
				},
			});
		}
		const oldMessageIds = await loadMessagesIdByRoom(env, roomId, null);
		const history = (await Promise.all(oldMessageIds.messageIds.map(async id => {
			const m = await loadMessage(env, id);
			if (!m) {
				return null; // Skip if message not found
			}
			return await makeAiMessage(env, m);
		}))).filter(m => m !== null);
		const message = {
			id: uuidv7(),
			roomId,
			role: UserRole.USER,
			text: content,
			imageKey: imageKey || undefined,
		};
		history.push(await makeAiMessage(env, message));
		const responseId = uuidv7();
		const stream = await env.AI.run("@cf/google/gemma-3-12b-it", {
			messages: history,
			stream: true,
			max_tokens: 32768,
		});

		// Create a TransformStream to collect the streamed content
		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		let fullText = '';

		// Process the stream
		const jsonStream = stream.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
		(async () => {
			try {
				for await (const chunk of jsonStream) {
					console.log("Stream data:", chunk.data);
					if (chunk.data === "[DONE]") {
						break; // End of stream
					}
					const { response } = JSON.parse(chunk.data);
					if (!response) {
						continue; // Skip if no response
					}
					fullText += response; // Collect the full text
					// convert string to Uint8Array
					const responseBytes = new TextEncoder().encode(`data: ${response}\n\n`);
					await writer.write(responseBytes); // Stream to the client
				}
				// Store the complete assistant message after stream ends
				const outputMessage = {
					id: responseId,
					roomId,
					role: UserRole.ASSISTANT,
					text: fullText,
					imageKey: undefined,
				};
				await storeMessage(env, message);
				await storeMessage(env, outputMessage);
			} finally {
				await writer.close();
			}
		})().catch(error => {
			console.error("Error processing stream:", error);
		});

		// Return the readable stream to the client
		return new Response(readable, {
			headers: {
				"Content-Type": "text/event-stream",
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error creating message:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

const extendCors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Credentials": "true",
};

async function extendUserSession(req: Request, env: Env): Promise<Response> {
	const corsHeaders = extendCors;
	const sessionId = getSessionId(req);
	if (!sessionId) {
		return new Response("Not logged in", {
			status: 401,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			},
		});
	}
	try {
		const session = await extendSession(env, sessionId);
		return new Response(JSON.stringify(session), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Set-Cookie": `sessionId=${session.sessionId}; HttpOnly; Secure; SameSite=Strict`,
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error("Error extending session:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				...corsHeaders,
			}
		});
	}
}

async function makeAiMessage(env: Env, m: Message): Promise<{ role: UserRole; content: string | { type: string; uri: string, text: string } }> {
	if (m.imageKey) {
		const imageb64 = await loadImageBase64(env, m.imageKey);
		if (!imageb64) {
			throw new Error("Image not found");
		}
		const { data, mimeType } = imageb64;
		return {
			role: m.role,
			content: {
				type: "image",
				uri: `data:${mimeType};base64,${data}`,
				text: m.text,
			},
		};
	}
	return {
		role: m.role,
		content: m.text,
	};
}

function getSessionId(req: Request): string | null {
	console.log("Request Headers:", req.headers);
	const authHeader = req.headers.get("Cookie") || "";
	const match = authHeader.match(/sessionId=([^;]+)/);
	console.log("Auth Header:", authHeader);
	return match ? match[1] : null;
}

const router = AutoRouter();
router
	.options("/api/register", () => new Response(null, {
		status: 204,
		headers: registerCors,
	}))
	.post("/api/register", handleRegister)
	.options("/api/login", () => new Response(null, {
		status: 204,
		headers: loginCors,
	}))
	.post("/api/login", handleLogin)
	.options("/api/logout", () => new Response(null, {
		status: 204,
		headers: logoutCors,
	}))
	.post("/api/logout", handleLogout)
	.options("/api/room", () => new Response(null, {
		status: 204,
		headers: roomCors,
	}))
	.post("/api/room", handleCreateRoom)
	.get("/api/room", handleGetRoom)
	.options("/api/rooms", () => new Response(null, {
		status: 204,
		headers: getRoomsCors,
	}))
	.get("/api/rooms", handleGetRooms)
	.options("/api/image", () => new Response(null, {
		status: 204,
		headers: uploadImageCors,
	}))
	.post("/api/image", handleUploadImage)
	.options("/api/messages", () => new Response(null, {
		status: 204,
		headers: getMessagesCors,
	}))
	.get("/api/messages", handleGetMessages)
	.options("/api/message", () => new Response(null, {
		status: 204,
		headers: messageCors,
	}))
	.get("/api/message", handleGetMessage)
	.post("/api/message", handleCreateMessage)
	.options("/api/extend", () => new Response(null, {
		status: 204,
		headers: extendCors,
	}))
	.post("/api/extend", extendUserSession);

export default router satisfies ExportedHandler<Env>;
