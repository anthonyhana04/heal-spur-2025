import { env, SELF } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";

// Mock the SDK like in worker.test
vi.mock("@google/genai", () => {
	return {
		GoogleGenAI: class {
			models = {
				generateContent: vi.fn().mockResolvedValue({ text: "model-response" }),
			};
		},
	};
});

function jsonRequest(url: string, body: unknown): Request {
	return new Request(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("Worker /generate endpoint", () => {
	it("rejects non-POST methods with 405", async () => {
		const response = await worker.fetch(
			new Request("http://example.com/generate", { method: "GET" }),
			env
		);
		expect(response.status).toBe(405);
		expect(await response.text()).toBe("Method not allowed");
	});

	it("unit style", async () => {
		const reqBody = { contents: [{ parts: [{ text: "Ping" }] }] };
		const response = await worker.fetch(
			jsonRequest("http://example.com/generate", reqBody),
			env
		);
		expect(await response.json()).toEqual({ text: "model-response" });
	});

	it("integration style (SELF)", async () => {
		const reqBody = { contents: [{ parts: [{ text: "Ping" }] }] };
		const response = await SELF.fetch("https://example.com/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(reqBody),
		});
		expect(await response.json()).toEqual({ text: "model-response" });
	});
});
