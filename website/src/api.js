export const API_ROOT = process.env.REACT_APP_API_ROOT || "";

export async function api(path, options = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include", // send cookies such as sessionId
    ...options,
  });

  if (!res.ok) {
    // Try to parse error text for useful message
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  // Some endpoints (logout, OPTIONS) may return 204 with no body
  if (res.status === 204 || res.headers.get("content-type")?.includes("text/plain")) {
    return res.text();
  }
  return res.json();
} 