const TOKEN_KEY = 'croissant_token';

export const auth = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', 'network');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth.token) {
      auth.set(null);
      window.dispatchEvent(new Event('croissant:logout'));
    }
    throw new ApiError(res.status, data.error ?? res.statusText, data.code);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T = void>(url: string) => request<T>('DELETE', url),
};

/** Скачивание файла с авторизацией (CSV, QR-картинки) */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function fetchBlobUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'failed');
  return URL.createObjectURL(await res.blob());
}
