import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from app.services.phishing_service import BLOCKLIST_PATH, reload_blocklist

FEED_URL = "https://openphish.com/feed.txt"
ALLOWED_FEED_HOSTS = {"openphish.com", "raw.githubusercontent.com"}
REFRESH_INTERVAL = timedelta(hours=12)
RETRY_INTERVAL = timedelta(minutes=5)
MAX_FEED_BYTES = 8 * 1024 * 1024
MAX_INDICATORS = 100_000
FEED_DIR = BLOCKLIST_PATH.parent / "threat_feeds"
EXTRA_FEEDS = (
    {"id": "phishunt", "name": "Phishunt", "url": "https://phishunt.io/feed.txt", "hosts_only": False, "interval": timedelta(hours=1), "allowed_hosts": {"phishunt.io", "www.phishunt.io", "raw.githubusercontent.com"}},
    {"id": "phishing_database", "name": "Phishing.Database", "url": "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt", "hosts_only": True, "interval": timedelta(hours=12), "max_bytes": 32 * 1024 * 1024, "allowed_hosts": {"raw.githubusercontent.com"}},
)

_state: dict[str, object] = {
    "status": "not_synced",
    "last_updated_at": None,
    "entry_count": 0,
    "last_error": None,
}
_extra_states: dict[str, dict[str, object]] = {
    str(feed["id"]): {"status": "not_synced", "last_updated_at": None, "entry_count": 0, "last_error": None}
    for feed in EXTRA_FEEDS
}
_sync_lock = asyncio.Lock()
_manual_sync_task: asyncio.Task[None] | None = None


def _parse_feed(body: str) -> list[str]:
    indicators: set[str] = set()
    for line in body.splitlines():
        candidate = line.strip()
        if not candidate or candidate.startswith("#"):
            continue
        try:
            parsed = urlsplit(candidate)
            host = parsed.hostname
            if parsed.scheme not in {"http", "https"} or not host or parsed.username or parsed.password:
                continue
            host.encode("idna")
        except (ValueError, UnicodeError):
            continue
        indicators.add(candidate)
        if len(indicators) >= MAX_INDICATORS:
            break
    if not indicators:
        raise ValueError("Le flux reçu ne contient aucune URL exploitable.")
    return sorted(indicators)


def _save_feed(indicators: list[str]) -> None:
    BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = BLOCKLIST_PATH.with_name(f"{BLOCKLIST_PATH.name}.tmp")
    temporary_path.write_text("\n".join(indicators) + "\n", encoding="utf-8")
    temporary_path.replace(BLOCKLIST_PATH)


def _parse_domain_feed(body: str) -> list[str]:
    indicators: set[str] = set()
    for line in body.splitlines():
        candidate = line.strip().lower()
        if not candidate or candidate.startswith(("#", "!")):
            continue
        parts = candidate.split()
        if len(parts) > 1:
            candidate = parts[-1] if parts[0] in {"0.0.0.0", "127.0.0.1"} else ""
        candidate = candidate.removeprefix("||").removesuffix("^").strip(".")
        if "://" in candidate:
            candidate = urlsplit(candidate).hostname or ""
        if not candidate or "/" in candidate or "*" in candidate:
            continue
        try:
            candidate.encode("idna")
            if len(candidate) > 253 or any(not label or len(label) > 63 for label in candidate.split(".")):
                continue
            if len(candidate.split(".")) < 2:
                continue
        except UnicodeError:
            continue
        indicators.add(candidate)
        if len(indicators) >= MAX_INDICATORS:
            break
    if not indicators:
        raise ValueError("Le flux de domaines ne contient aucun domaine exploitable.")
    return sorted(indicators)


def _snapshot_path(feed_id: str) -> Path:
    return FEED_DIR / f"{feed_id}.txt"


def _save_snapshot(feed_id: str, indicators: list[str]) -> None:
    FEED_DIR.mkdir(parents=True, exist_ok=True)
    temporary_path = _snapshot_path(feed_id).with_suffix(".tmp")
    temporary_path.write_text("\n".join(indicators) + "\n", encoding="utf-8")
    temporary_path.replace(_snapshot_path(feed_id))


def _rebuild_blocklist() -> int:
    FEED_DIR.mkdir(parents=True, exist_ok=True)
    openphish_snapshot = _snapshot_path("openphish")
    if not openphish_snapshot.exists() and BLOCKLIST_PATH.exists():
        openphish_snapshot.write_text(BLOCKLIST_PATH.read_text(encoding="utf-8", errors="ignore"), encoding="utf-8")
    merged: set[str] = set()
    for path in FEED_DIR.glob("*.txt"):
        merged.update(line.strip() for line in path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip())
    _save_feed(sorted(merged))
    return reload_blocklist()


def get_feed_status() -> dict[str, object]:
    all_states = [{"id": "openphish", "name": "OpenPhish Community", "url": FEED_URL, "interval": REFRESH_INTERVAL, **_state}]
    all_states.extend({**feed, **_extra_states[str(feed["id"])]} for feed in EXTRA_FEEDS)
    count = sum(int(feed["entry_count"]) or (sum(1 for line in _snapshot_path(str(feed["id"])).open(encoding="utf-8", errors="ignore") if line.strip()) if _snapshot_path(str(feed["id"])).exists() else 0) for feed in all_states)
    preview: list[str] = []
    if BLOCKLIST_PATH.exists():
        with BLOCKLIST_PATH.open(encoding="utf-8", errors="ignore") as feed_file:
            preview = [line.strip() for _, line in zip(range(5), feed_file) if line.strip()]
    last_updated_at = _state["last_updated_at"]
    next_update_at = None
    if isinstance(last_updated_at, str):
        try:
            last_update = datetime.fromisoformat(last_updated_at)
            next_update_at = (last_update + REFRESH_INTERVAL).isoformat()
        except ValueError:
            pass
    feed_rows = []
    for feed in all_states:
        updated = feed["last_updated_at"]
        source_next_update = None
        if isinstance(updated, str):
            try:
                source_next_update = (datetime.fromisoformat(updated) + feed["interval"]).isoformat()
            except (TypeError, ValueError):
                pass
        source_count = int(feed["entry_count"])
        snapshot = _snapshot_path(str(feed["id"]))
        if source_count == 0 and snapshot.exists():
            source_count = sum(1 for line in snapshot.open(encoding="utf-8", errors="ignore") if line.strip())
        feed_rows.append({"id": feed["id"], "name": feed["name"], "url": feed["url"], "status": feed["status"], "last_updated_at": updated, "next_update_at": source_next_update, "entry_count": source_count, "last_error": feed["last_error"], "update_interval_hours": max(1, int(feed["interval"].total_seconds() // 3600))})
    online_count = sum(1 for feed in all_states if feed["status"] == "online")
    overall_status = "syncing" if any(feed["status"] == "syncing" for feed in all_states) else "online" if online_count == len(all_states) else "partial" if online_count else "error"
    return {
        "source": "Flux phishing multi-source",
        "source_url": FEED_URL,
        "status": overall_status,
        "last_updated_at": last_updated_at,
        "next_update_at": next_update_at,
        "entry_count": count,
        "preview_urls": preview,
        "last_error": "; ".join(f"{feed['name']}: {feed['last_error']}" for feed in all_states if feed["last_error"]) or None,
        "update_interval_hours": int(REFRESH_INTERVAL.total_seconds() // 3600),
        "feeds": feed_rows,
        "license_note": "OpenPhish Community est réservé aux démos et usages non commerciaux. Phishunt est CC0; Phishing.Database est sous licence MIT.",
    }


async def sync_openphish_feed() -> dict[str, object]:
    async with _sync_lock:
        _state["status"] = "syncing"
        _state["last_error"] = None
        try:
            timeout = httpx.Timeout(20.0, connect=8.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3, headers={"User-Agent": "CyberShieldAI-Local-Demo/1.0"}) as client:
                response = await client.get(FEED_URL)
                response.raise_for_status()
            redirect_chain = [*response.history, response]
            if any(item.url.scheme != "https" or item.url.host not in ALLOWED_FEED_HOSTS for item in redirect_chain):
                raise ValueError("Le flux a redirigé vers un hôte non autorisé.")
            if len(response.content) > MAX_FEED_BYTES:
                raise ValueError("Le flux dépasse la taille maximale autorisée pour la démo.")
            indicators = _parse_feed(response.text)
            await asyncio.to_thread(_save_snapshot, "openphish", indicators)
            await asyncio.to_thread(_rebuild_blocklist)
            await asyncio.to_thread(reload_blocklist)
            _state.update({
                "status": "online",
                "last_updated_at": datetime.now(timezone.utc).isoformat(),
                "entry_count": len(indicators),
                "last_error": None,
            })
        except (httpx.HTTPError, OSError, ValueError) as error:
            _state["status"] = "error"
            _state["last_error"] = str(error)[:300]
        return get_feed_status()


async def _sync_extra_feed(feed: dict[str, object]) -> None:
    async with _sync_lock:
        feed_id = str(feed["id"])
        state = _extra_states[feed_id]
        state.update({"status": "syncing", "last_error": None})
        try:
            timeout = httpx.Timeout(35.0, connect=8.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3, headers={"User-Agent": "CyberShieldAI-Local-Demo/1.0"}) as client:
                response = await client.get(str(feed["url"]))
                response.raise_for_status()
            redirect_chain = [*response.history, response]
            allowed_hosts = feed["allowed_hosts"]
            if any(item.url.scheme != "https" or item.url.host not in allowed_hosts for item in redirect_chain):
                raise ValueError("Le flux a redirigé vers un hôte non autorisé.")
            if len(response.content) > int(feed.get("max_bytes", MAX_FEED_BYTES)):
                raise ValueError("Le flux dépasse la taille maximale autorisée.")
            indicators = _parse_domain_feed(response.text) if feed["hosts_only"] else _parse_feed(response.text)
            await asyncio.to_thread(_save_snapshot, feed_id, indicators)
            await asyncio.to_thread(_rebuild_blocklist)
            state.update({"status": "online", "last_updated_at": datetime.now(timezone.utc).isoformat(), "entry_count": len(indicators), "last_error": None})
        except (httpx.HTTPError, OSError, ValueError) as error:
            state.update({"status": "error", "last_error": str(error)[:300]})


async def sync_all_threat_feeds() -> dict[str, object]:
    await sync_openphish_feed()
    for feed in EXTRA_FEEDS:
        await _sync_extra_feed(feed)
    await asyncio.to_thread(reload_blocklist)
    return get_feed_status()


async def _run_manual_sync() -> None:
    try:
        await sync_all_threat_feeds()
    finally:
        global _manual_sync_task
        _manual_sync_task = None


async def start_threat_feed_sync() -> dict[str, object]:
    """Start a full refresh in the background and return its current status."""
    global _manual_sync_task
    if _manual_sync_task is None or _manual_sync_task.done():
        _state.update({"status": "syncing", "last_error": None})
        for state in _extra_states.values():
            state.update({"status": "syncing", "last_error": None})
        _manual_sync_task = asyncio.create_task(_run_manual_sync())
    return get_feed_status()


async def run_feed_refresh_loop() -> None:
    await sync_all_threat_feeds()
    while True:
        await asyncio.sleep(RETRY_INTERVAL.total_seconds())
        now = datetime.now(timezone.utc)
        if _state["status"] != "online" or not isinstance(_state["last_updated_at"], str):
            await sync_openphish_feed()
        else:
            try:
                if now - datetime.fromisoformat(str(_state["last_updated_at"])) >= REFRESH_INTERVAL:
                    await sync_openphish_feed()
            except ValueError:
                await sync_openphish_feed()
        for feed in EXTRA_FEEDS:
            updated = _extra_states[str(feed["id"])]["last_updated_at"]
            if _extra_states[str(feed["id"])]["status"] != "online" or not isinstance(updated, str):
                await _sync_extra_feed(feed)
                continue
            try:
                if now - datetime.fromisoformat(updated) >= feed["interval"]:
                    await _sync_extra_feed(feed)
            except ValueError:
                await _sync_extra_feed(feed)
