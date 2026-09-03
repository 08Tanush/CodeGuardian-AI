import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

// Every function here returns a plain value on success and throws an
// Error with a friendly `.message` on failure, so components can just
// try/catch and show err.message directly.
function friendlyError(err) {
  if (err.response?.data?.detail) {
    return new Error(err.response.data.detail);
  }
  if (err.code === "ECONNABORTED") {
    return new Error("The request timed out. Large repositories can take a little longer - please try again.");
  }
  if (!err.response) {
    return new Error("Couldn't reach the CodeGuardian backend. Is the API server running?");
  }
  return new Error("Something went wrong. Please try again.");
}

export async function uploadZip(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const { data } = await client.post("/upload/zip", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });
    return data;
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function uploadGithubUrl(url) {
  try {
    const { data } = await client.post("/upload/github", { url });
    return data;
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function getAnalysis(id) {
  try {
    const { data } = await client.get(`/analysis/${id}`);
    return data;
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function explainFile(id, path) {
  try {
    const { data } = await client.post("/file/explain", { id, path });
    return data;
  } catch (err) {
    throw friendlyError(err);
  }
}

export function reportDownloadUrl(id) {
  return `${API_BASE}/report/${id}/download`;
}
