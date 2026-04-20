/**
 * Phase 1 — RIN API client for ClaimRush.
 * In dev: Vite proxy forwards /v1/* → localhost:8888/v1/*.
 * In prod: VITE_API_URL points to the Railway backend.
 * JWT is read from localStorage (same key as RIN: 'access_token').
 */

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/v1';

function getToken() {
  const raw = localStorage.getItem('access_token');
  if (!raw) return null;
  try {
    // RIN stores it as JSON.stringify(token), so it has quotes
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    // Token expired or invalid — clear and redirect to login
    if (path !== '/auth/login') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('cr_role');
      localStorage.removeItem('cr_user');
      window.location.href = '/login';
    }
  }

  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw { status: res.status, ...err };
  }
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, detail: err.detail || 'Login failed' };
  }
  const data = await res.json();
  localStorage.setItem('access_token', JSON.stringify(data.access_token));
  return data;
}

export async function fetchCurrentUser() {
  return apiJson('/users/me');
}
