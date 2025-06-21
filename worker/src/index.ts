/**
 * Cloudflare Worker proxy for Google Gemini API + R2 file-upload helper.
 *
 *  Endpoints
 *  ├─ POST /generate   – proxy a Gemini text/vision request (same shape as Gemini API).
 *  ├─ POST /upload     – accept a base64-encoded file, persist it to Cloudflare R2 and forward it to
 *  │                     Gemini Files API. Returns the File object { name, uri, mimeType, … }.
 *  └─ /r2/*           – Direct R2 bucket operations (GET/PUT/DELETE)
 *
 *  The /upload route expects JSON of the form:
 *  {
 *    "fileName": "myImage.jpg",
 *    "mimeType": "image/jpeg",
 *    "data": "<base64>" ,          // raw file bytes encoded as base64
 *    "displayName": "optional human readable label"
 *  }
 */


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
}

interface GeminiTextRequest {
	contents: {
		parts: { text: string }[];
	}[];
}

interface GeminiImageRequest {
	contents: {
		parts:
		| { text: string }
		| {
			inlineData: { data: string; mimeType: string };
		}[];
	}[];
}

type GeminiRequest = GeminiTextRequest | GeminiImageRequest;

import { GoogleGenAI } from "@google/genai";

// Helpful CORS headers
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// Helper function to handle R2 operations
async function handleR2Operations(request: Request, env: Env, key: string): Promise<Response> {
	switch (request.method) {
		case "PUT":
			console.log(env);
			await env.MY_BUCKET.put(key, request.body);
			return new Response(`Put ${key} successfully!`, {
				headers: CORS_HEADERS
			});

		case "GET":
			const object = await env.MY_BUCKET.get(key);

			if (object === null) {
				return new Response("Object Not Found", {
					status: 404,
					headers: CORS_HEADERS
				});
			}

			const headers = new Headers(CORS_HEADERS);
			object.writeHttpMetadata(headers);
			headers.set("etag", object.httpEtag);

			return new Response(object.body, {
				headers,
			});

		case "DELETE":
			await env.MY_BUCKET.delete(key);
			return new Response("Deleted!", {
				headers: CORS_HEADERS
			});

		default:
			return new Response("Method Not Allowed", {
				status: 405,
				headers: {
					...CORS_HEADERS,
					Allow: "PUT, GET, DELETE",
				},
			});
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Handle CORS pre-flight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const { pathname } = new URL(request.url);

		// Handle R2 operations if path starts with /r2/
		if (pathname.startsWith('/r2/')) {
			const key = pathname.slice(3); // Remove '/r2' prefix
			return handleR2Operations(request, env, key);
		}

		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
		}

		try {
			if (pathname === "/upload") {
				return await handleUpload(request, env);
			}
			// Default – proxy to Gemini generateContent
			return await handleGenerate(request, env);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	},
} satisfies ExportedHandler<Env>;

/**
 * /generate – proxy request directly to gemini-pro or gemini-pro-vision depending on presence of image parts.
 */
async function handleGenerate(request: Request, env: Env): Promise<Response> {
	const requestData = (await request.json()) as GeminiRequest;

	// Pick model based on presence of image parts
	const hasImage = (requestData as any).contents?.[0]?.parts?.some(
		(part: any) => "inlineData" in part && part.inlineData?.mimeType?.startsWith("image/")
	);

	const modelId = hasImage ? "gemini-pro-vision" : "gemini-pro";

	// Use GoogleGenAI SDK
	const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

	const result = await ai.models.generateContent({
		model: modelId,
		contents: requestData.contents as any
	});

	return new Response(JSON.stringify(result), {
		headers: { "Content-Type": "application/json", ...CORS_HEADERS },
	});
}

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
