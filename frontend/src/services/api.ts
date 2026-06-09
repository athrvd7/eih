const BASE_URL = "/api";

interface ApiError extends Error {
  status: number;
}

function createApiError(status: number, message: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  return err;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw createApiError(res.status, err.detail || res.statusText);
  }
  return res.json();
}

export const api = {
  ingest: {
    fromGithub: (url: string) =>
      request<{ job_id: string; status: string }>("/ingest/github", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    fromUpload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${BASE_URL}/ingest/upload`, {
        method: "POST",
        body: form,
      }).then((r) =>
        r.ok
          ? r.json()
          : r
              .json()
              .then((e) => Promise.reject(createApiError(r.status, e.detail))),
      );
    },
    fromDocs: (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return fetch(`${BASE_URL}/ingest/docs`, {
        method: "POST",
        body: form,
      }).then((r) =>
        r.ok
          ? r.json()
          : r
              .json()
              .then((e) => Promise.reject(createApiError(r.status, e.detail))),
      );
    },
  },
  jobs: {
    get: (jobId: string) => request<any>(`/jobs/${jobId}`),
  },
  graph: {
    get: (jobId: string) => request<any>(`/graph/${jobId}`),
    getNode: (jobId: string, nodeId: string) =>
      request<any>(`/graph/${jobId}/node/${encodeURIComponent(nodeId)}`),
  },
  walkthrough: {
    get: (jobId: string) => request<any>(`/walkthrough/${jobId}`),
  },
  docs: {
    get: (jobId: string) => request<any>(`/docs/${jobId}`),
    update: (jobId: string, sections: any[]) =>
      request<any>(`/docs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ sections }),
      }),
  },
  chat: {
    send: (jobId: string, question: string) =>
      request<any>(`/chat/${jobId}`, {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
    getHistory: (jobId: string) => request<any>(`/chat/${jobId}/history`),
    getSuggestions: (jobId: string) =>
      request<any>(`/chat/${jobId}/suggestions`),
  },
};

export type { ApiError };
