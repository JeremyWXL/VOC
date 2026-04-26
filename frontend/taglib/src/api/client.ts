const API_BASE = ''; // relative path, same origin

export interface ApiTagSystem {
  id: string;
  name: string;
  scene_type: string;
  description: string;
  csv_content: string;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

export interface TagSystemCreate {
  name: string;
  csv_content: string;
  scene_type?: string;
  description?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  listTagSystems: (scene?: string, preset?: boolean) =>
    request<{ items: ApiTagSystem[]; total: number }>(
      `/api/tag-systems?${new URLSearchParams({ ...(scene && { scene }), ...(preset !== undefined && { preset: String(preset) }) }).toString()}`
    ),
  getTagSystem: (id: string) => request<ApiTagSystem>(`/api/tag-systems/${id}`),
  createTagSystem: (data: TagSystemCreate) =>
    request<ApiTagSystem>(`/api/tag-systems`, { method: 'POST', body: JSON.stringify(data) }),
  updateTagSystem: (id: string, data: TagSystemCreate) =>
    request<ApiTagSystem>(`/api/tag-systems/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTagSystem: (id: string) =>
    request<void>(`/api/tag-systems/${id}`, { method: 'DELETE' }),
  copyTagSystem: (id: string) =>
    request<ApiTagSystem>(`/api/tag-systems/${id}/copy`, { method: 'POST' }),
};
