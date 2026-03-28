const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8888";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Server-side fetches go directly to the FastAPI backend.
  // The backend mounts routes at /v1, so strip the /api prefix
  // that pages use (which works client-side via Next.js rewrites).
  const normalizedPath = path.replace(/^\/api\/v1/, "/v1");
  const url = `${FASTAPI_URL}${normalizedPath}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new ApiError(response.status, errorBody);
  }

  return response.json() as Promise<T>;
}
