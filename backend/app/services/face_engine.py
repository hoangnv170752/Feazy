"""
Singleton wrapper around insightface FaceAnalysis.
Loaded once at process start to avoid repeated model downloads.
"""
import threading

import cv2
import numpy as np

_lock = threading.Lock()
_app = None


def _get_app():
    global _app
    if _app is None:
        with _lock:
            if _app is None:
                import insightface
                from insightface.app import FaceAnalysis

                fa = FaceAnalysis(
                    name="buffalo_sc",
                    providers=["CPUExecutionProvider"],
                )
                fa.prepare(ctx_id=0, det_size=(640, 640))
                _app = fa
    return _app


def decode_image(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Cannot decode image bytes")
    return img


def extract_embedding(image_bytes: bytes) -> tuple[list[float], float]:
    """
    Returns (embedding, det_score) for the largest detected face.
    Raises ValueError if no face is found.
    """
    fa = _get_app()
    img = decode_image(image_bytes)
    faces = fa.get(img)
    if not faces:
        raise ValueError("No face detected in the image.")
    face = max(faces, key=lambda f: f.det_score)
    return face.normed_embedding.tolist(), float(face.det_score)


def cosine_distance(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    return float(1.0 - np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))
