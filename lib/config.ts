const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export const BACKEND_BASE_URL = rawBackendUrl.replace(/\/+$/, '');

