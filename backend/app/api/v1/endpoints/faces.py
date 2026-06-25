from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.api.dependencies import DBSession
from app.schemas.face import (
    FaceRecordResponse,
    FaceSearchResponse,
    FaceVerifyResponse,
)
from app.services.face import FaceService

router = APIRouter()

_MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/register",
    response_model=FaceRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a face for a person",
)
async def register_face(
    db: DBSession,
    image: Annotated[UploadFile, File(description="Face image (jpg/png)")],
    person_id: Annotated[str, Form(description="Unique person identifier")],
    label: Annotated[str | None, Form(description="Optional display name")] = None,
    model_name: Annotated[str, Form()] = "Facenet512",
    detector_backend: Annotated[str, Form()] = "retinaface",
) -> FaceRecordResponse:
    from app.schemas.face import FaceRegisterRequest

    image_bytes = await image.read()
    request = FaceRegisterRequest(
        person_id=person_id,
        label=label,
        model_name=model_name,
        detector_backend=detector_backend,
    )
    svc = FaceService(db)
    return await svc.register_face(image_bytes, image.filename or "face.jpg", request)


@router.get(
    "/{person_id}",
    response_model=list[FaceRecordResponse],
    summary="Get all registered faces for a person",
)
async def get_faces_by_person(
    person_id: str,
    db: DBSession,
) -> list[FaceRecordResponse]:
    svc = FaceService(db)
    return await svc.get_faces_by_person(person_id)


@router.get(
    "",
    response_model=list[FaceRecordResponse],
    summary="List all registered face records",
)
async def list_faces(
    db: DBSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[FaceRecordResponse]:
    svc = FaceService(db)
    return await svc.list_all_faces(limit=limit, offset=offset)


@router.delete(
    "/{person_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete all faces for a person",
)
async def delete_person_faces(
    person_id: str,
    db: DBSession,
) -> dict:
    svc = FaceService(db)
    count = await svc.delete_person(person_id)
    return {"deleted": count, "person_id": person_id}


@router.post(
    "/verify",
    response_model=FaceVerifyResponse,
    summary="Verify if an uploaded face matches a registered person",
)
async def verify_face(
    db: DBSession,
    image: Annotated[UploadFile, File(description="Probe face image")],
    person_id: Annotated[str, Form()],
    model_name: Annotated[str, Form()] = "Facenet512",
    detector_backend: Annotated[str, Form()] = "retinaface",
    distance_metric: Annotated[str, Form()] = "cosine",
) -> FaceVerifyResponse:
    image_bytes = await image.read()
    svc = FaceService(db)
    return await svc.verify_face(
        image_bytes,
        image.filename or "probe.jpg",
        person_id=person_id,
        model_name=model_name,
        detector_backend=detector_backend,
        distance_metric=distance_metric,
    )


@router.post(
    "/search",
    response_model=list[FaceSearchResponse],
    summary="Search for matching faces across all registered persons",
)
async def search_face(
    db: DBSession,
    image: Annotated[UploadFile, File(description="Probe face image")],
    model_name: Annotated[str, Form()] = "Facenet512",
    detector_backend: Annotated[str, Form()] = "retinaface",
    distance_metric: Annotated[str, Form()] = "cosine",
    top_k: Annotated[int, Form(ge=1, le=50)] = 5,
) -> list[FaceSearchResponse]:
    image_bytes = await image.read()
    svc = FaceService(db)
    return await svc.search_face(
        image_bytes,
        image.filename or "probe.jpg",
        model_name=model_name,
        detector_backend=detector_backend,
        distance_metric=distance_metric,
        top_k=top_k,
    )
