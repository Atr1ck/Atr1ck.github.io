export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_PUBLISH_ASSET_BYTES = 2.75 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 2.75 * 1024 * 1024;
export const MAX_MARKDOWN_BYTES = 256 * 1024;

// Vercel rejects function request bodies above 4.5 MB. Keep room for headers
// and platform parsing overhead after JSON and base64 expansion.
export const MAX_PUBLISH_REQUEST_BYTES = 4 * 1024 * 1024;
