from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseResponseSchema, BaseSchema


class FaceRegisterRequest(BaseSchema):
    person_id: str = Field(..., min_length=1, max_length=128, description="Unique person identifier")
    label: str | None = Field(None, max_length=256, description="Optional display name / label")
    model_name: str = Field("Facenet512", description="DeepFace embedding model")
    detector_backend: str = Field("retinaface", description="Face detector backend")


class FaceRecordResponse(BaseResponseSchema):
    person_id: str
    label: str | None
    image_path: str
    model_name: str
    detector_backend: str
    confidence: float | None


class FaceVerifyRequest(BaseSchema):
    person_id: str = Field(..., description="Person ID to verify against")
    model_name: str = Field("Facenet512")
    detector_backend: str = Field("retinaface")
    distance_metric: str = Field("cosine", description="cosine | euclidean | euclidean_l2")


class FaceVerifyResponse(BaseSchema):
    person_id: str
    verified: bool
    distance: float
    threshold: float
    model: str
    detector_backend: str


class FaceSearchResponse(BaseSchema):
    face_id: UUID
    person_id: str
    label: str | None
    distance: float
    verified: bool
