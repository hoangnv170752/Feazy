from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditMixin


class FaceRecord(Base, AuditMixin):
    __tablename__ = "face_records"

    person_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str] = mapped_column(String(64), default="Facenet512")
    detector_backend: Mapped[str] = mapped_column(String(64), default="retinaface")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
