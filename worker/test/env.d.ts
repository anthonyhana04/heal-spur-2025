/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:test" {
	export const env: {
		GOOGLE_API_KEY: string;
		MY_BUCKET: R2Bucket;
	};
	export const SELF: {
		fetch: typeof fetch;
	};
}
