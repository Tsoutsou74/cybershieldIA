from fastapi import APIRouter, Depends

from app.core.deps import get_current_superadmin, get_current_user
from app.models.user import User
from app.services.threat_feed_service import get_feed_status, start_threat_feed_sync

router = APIRouter(prefix="/threat-intel", tags=["Threat intelligence"])


@router.get("/status")
def threat_feed_status(current_user: User = Depends(get_current_user)) -> dict[str, object]:
    return get_feed_status()


@router.post("/sync")
async def sync_threat_feed(current_user: User = Depends(get_current_superadmin)) -> dict[str, object]:
    return await start_threat_feed_sync()
