from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.face import FaceRecord
from app.repositories.base import BaseRepository


class FaceRepository(BaseRepository[FaceRecord]):
    model = FaceRecord

    async def get_by_person_id(self, person_id: str) -> list[FaceRecord]:
        result = await self._session.execute(
            select(FaceRecord).where(FaceRecord.person_id == person_id)
        )
        return list(result.scalars().all())

    async def get_all_with_embeddings(self) -> list[FaceRecord]:
        result = await self._session.execute(
            select(FaceRecord).where(FaceRecord.embedding.isnot(None))
        )
        return list(result.scalars().all())

    async def delete_by_person_id(self, person_id: str) -> int:
        records = await self.get_by_person_id(person_id)
        for record in records:
            await self._session.delete(record)
        await self._session.flush()
        return len(records)
