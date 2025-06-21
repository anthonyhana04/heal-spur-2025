import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";

// Mock @google/genai SDK
vi.mock("@google/genai", () => {
  const generateMock = vi.fn().mockResolvedValue({ text: "model-response" });
  return {
    GoogleGenAI: class {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      constructor(opts: { apiKey: string }) {}
      /* eslint-enable */
      models = {
        generateContent: generateMock,
      };
    },
  };
});

// helper to make JSON Request
function jsonReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Cloudflare Worker endpoints", () => {
  const bucketPut = vi.fn();
  const env = {
    GOOGLE_API_KEY: "dummy",
    MY_BUCKET: { put: bucketPut } as unknown as R2Bucket,
  };

  beforeEach(() => {
    bucketPut.mockReset();
  });

  it("/generate proxies to Gemini via SDK", async () => {
    const reqBody = {
      contents: [{ parts: [{ text: "Hello" }] }],
    };

    const res = await (worker as any).fetch(jsonReq("http://localhost/generate", reqBody), env);
    const data = await res.json();
    expect(data).toEqual({ text: "model-response" });
  });

  it("/upload stores file to R2 and returns Gemini file object", async () => {
    // Mock fetch used inside handleUpload to hit Files API
    // It should return { file: { uri: "gs://file", mimeType: "image/jpeg" } }
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ file: { uri: "gs://file", mimeType: "image/jpeg" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    );

    const base64 = btoa("demo");
    const reqBody = {
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      data: base64,
    };

    const res = await (worker as any).fetch(jsonReq("http://localhost/upload", reqBody), env);
    const data = await res.json();
    expect(bucketPut).toHaveBeenCalledOnce();
    expect(data.file.uri).toBe("gs://file");
  });
}); 