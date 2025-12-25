// web/src/api/client.ts
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export { API_BASE_URL };

export function getAuthToken(): string | null {
  return localStorage.getItem("w2c_token");
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("w2c_token", token);
  } else {
    localStorage.removeItem("w2c_token");
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = text;
    try {
      const json = JSON.parse(text);
      errorMessage = json.message || text;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage || `Request failed: ${res.status}`);
  }

  return res.json();
}
