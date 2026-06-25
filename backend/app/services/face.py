import json
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.logging import get_logger
from app.models.face import FaceRecord
from app.repositories.face import FaceRepository
from app.schemas.face import (
    FaceRecordResponse,
    FaceRegisterRequest,
    FaceSearchResponse,
    FaceVerifyResponse,
)
from app.services.face_engine import cosine_distance, extract_embedding

logger = get_logger(__name__)

UPLOAD_DIR = Path("uploads/faces")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

COSINE_THRESHOLD = 0.40


class FaceService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = FaceRepository(session)

    async def register_face(
        self,
        image_bytes: bytes,
        filename: str,
        request: FaceRegisterRequest,
    ) -> FaceRecordResponse:
        try:
            embedding, det_score = extract_embedding(image_bytes)
        except ValueError as exc:
            raise BadRequestException(str(exc)) from exc

        face_id = uuid.uuid4()
        ext = Path(filename).suffix or ".jpg"
        save_path = UPLOAD_DIR / f"{face_id}{ext}"
        save_path.write_bytes(image_bytes)

        record = await self._repo.create(
            person_id=request.person_id,
            label=request.label,
            image_path=str(save_path),
            embedding=json.dumps(embedding),
            model_name=request.model_name,
            detector_backend=request.detector_backend,
            confidence=det_score,
        )
        return FaceRecordResponse.model_validate(record)

    async def get_faces_by_person(self, person_id: str) -> list[FaceRecordResponse]:
        records = await self._repo.get_by_person_id(person_id)
        if not records:
            raise NotFoundException(f"No faces registered for person_id='{person_id}'")
        return [FaceRecordResponse.model_validate(r) for r in records]

    async def list_all_faces(self, limit: int = 100, offset: int = 0) -> list[FaceRecordResponse]:
        records = await self._repo.get_all(limit=limit, offset=offset)
        return [FaceRecordResponse.model_validate(r) for r in records]

    async def delete_person(self, person_id: str) -> int:
        count = await self._repo.delete_by_person_id(person_id)
        if count == 0:
            raise NotFoundException(f"No faces found for person_id='{person_id}'")
        return count

    async def verify_face(
        self,
        image_bytes: bytes,
        filename: str,
        person_id: str,
        model_name: str = "ArcFace",
        detector_backend: str = "insightface",
        distance_metric: str = "cosine",
    ) -> FaceVerifyResponse:
        records = await self._repo.get_by_person_id(person_id)
        if not records:
            raise NotFoundException(f"No faces registered for person_id='{person_id}'")

        try:
            probe_embedding, _ = extract_embedding(image_bytes)
        except ValueError as exc:
            raise BadRequestException(str(exc)) from exc

        best_distance = float("inf")
        for record in records:
            if not record.embedding:
                continue
            stored: list[float] = json.loads(record.embedding)
            dist = cosine_distance(probe_embedding, stored)
            if dist < best_distance:
                best_distance = dist

        verified = best_distance <= COSINE_THRESHOLD
        return FaceVerifyResponse(
            person_id=person_id,
            verified=verified,
            distance=round(best_distance, 6),
            threshold=COSINE_THRESHOLD,
            model=model_name,
            detector_backend=detector_backend,
        )

    async def search_face(
        self,
        image_bytes: bytes,
        filename: str,
        model_name: str = "ArcFace",
        detector_backend: str = "insightface",
        distance_metric: str = "cosine",
        top_k: int = 5,
    ) -> list[FaceSearchResponse]:
        try:
            probe_embedding, _ = extract_embedding(image_bytes)
        except ValueError as exc:
            raise BadRequestException(str(exc)) from exc

        all_records: list[FaceRecord] = await self._repo.get_all_with_embeddings()
        if not all_records:
            return []

        scores: list[tuple[float, FaceRecord]] = []
        for record in all_records:
            if not record.embedding:
                continue
            stored: list[float] = json.loads(record.embedding)
            dist = cosine_distance(probe_embedding, stored)
            scores.append((dist, record))

        scores.sort(key=lambda x: x[0])

        return [
            FaceSearchResponse(
                face_id=r.id,
                person_id=r.person_id,
                label=r.label,
                distance=round(d, 6),
                verified=d <= COSINE_THRESHOLD,
            )
            for d, r in scores[:top_k]
        ]
