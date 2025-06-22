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

const router = AutoRouter()
router
	.post('/upload', handleUpload)
	.post('/generate', handleGenerate)

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
		const genAI = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
		const { roomId, prompt, url, mimeType } = (await request.json() as any);
		await saveMessages(env, userId, roomId, role, content, mimeType, url);
		const contents = (await getMessages(env, roomId)).map((item: any) => {
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
