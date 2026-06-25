const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface FaceRecord {
  id: string;
  person_id: string;
  label: string | null;
  image_path: string;
  model_name: string;
  detector_backend: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface VerifyResult {
  person_id: string;
  verified: boolean;
  distance: number;
  threshold: number;
  model: string;
  detector_backend: string;
}

export interface SearchResult {
  face_id: string;
  person_id: string;
  label: string | null;
  distance: number;
  verified: boolean;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  environment: string;
}

// Health check
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

// Register a face
export async function registerFace(
  image: File | Blob,
  personId: string,
  label?: string,
  modelName: string = "ArcFace",
  detectorBackend: string = "retinaface"
): Promise<FaceRecord> {
  const form = new FormData();
  form.append("image", image);
  form.append("person_id", personId);
  if (label) form.append("label", label);
  form.append("model_name", modelName);
  form.append("detector_backend", detectorBackend);

  const res = await fetch(`${API_BASE}/faces/register`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(error.detail || "Registration failed");
  }
  return res.json();
}

// Verify a face against a person_id
export async function verifyFace(
  image: File | Blob,
  personId: string,
  modelName: string = "ArcFace",
  distanceMetric: string = "cosine"
): Promise<VerifyResult> {
  const form = new FormData();
  form.append("image", image);
  form.append("person_id", personId);
  form.append("model_name", modelName);
  form.append("distance_metric", distanceMetric);

  const res = await fetch(`${API_BASE}/faces/verify`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Verification failed" }));
    throw new Error(error.detail || "Verification failed");
  }
  return res.json();
}

// Search for similar faces
export async function searchFace(
  image: File | Blob,
  topK: number = 5,
  modelName: string = "ArcFace",
  distanceMetric: string = "cosine"
): Promise<SearchResult[]> {
  const form = new FormData();
  form.append("image", image);
  form.append("top_k", topK.toString());
  form.append("model_name", modelName);
  form.append("distance_metric", distanceMetric);

  const res = await fetch(`${API_BASE}/faces/search`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Search failed" }));
    throw new Error(error.detail || "Search failed");
  }
  return res.json();
}

// Get faces by person_id
export async function getFacesByPerson(personId: string): Promise<FaceRecord[]> {
  const res = await fetch(`${API_BASE}/faces/${encodeURIComponent(personId)}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error("Failed to fetch faces");
  }
  return res.json();
}

// List all faces
export async function listFaces(limit: number = 50, offset: number = 0): Promise<FaceRecord[]> {
  const res = await fetch(`${API_BASE}/faces?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to list faces");
  return res.json();
}

// Delete all faces for a person
export async function deleteFacesByPerson(personId: string): Promise<{ deleted: number; person_id: string }> {
  const res = await fetch(`${API_BASE}/faces/${encodeURIComponent(personId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete faces");
  return res.json();
}

// Helper: Convert canvas to Blob
export function canvasToBlob(canvas: HTMLCanvasElement, type: string = "image/jpeg", quality: number = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to convert canvas to blob"));
      },
      type,
      quality
    );
  });
}
