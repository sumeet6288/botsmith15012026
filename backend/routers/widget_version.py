from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/widget", tags=["widget-versioning"])

WIDGET_DIR = Path("/app/frontend/public")
MANIFEST_PATH = WIDGET_DIR / "versions" / "manifest.json"

def load_manifest():
    """Load version manifest"""
    if not MANIFEST_PATH.exists():
        # Return default manifest if file doesn't exist yet
        return {
            "latest": "2.0.0",
            "stable": "2.0.0",
            "beta": "2.0.0-beta.1",
            "versions": [
                {
                    "version": "2.0.0",
                    "releaseDate": datetime.now().isoformat(),
                    "status": "stable",
                    "deprecated": False,
                    "breaking_changes": False,
                    "changelog": "Added error isolation and subscription enforcement",
                    "minSupportedUntil": "2026-01-21"
                }
            ]
        }
    
    with open(MANIFEST_PATH) as f:
        return json.load(f)

@router.get("/manifest.json")
async def get_manifest():
    """Get widget version manifest"""
    return load_manifest()

@router.get("/latest/fast-widget.js")
async def get_latest_widget():
    """Serve latest stable widget version"""
    manifest = load_manifest()
    latest_version = manifest["latest"]
    
    # For now, serve the main widget file
    widget_path = WIDGET_DIR / "fast-widget.js"
    
    if not widget_path.exists():
        raise HTTPException(status_code=404, detail="Widget not found")
    
    return FileResponse(
        widget_path,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600",  # 1 hour cache
            "X-Widget-Version": latest_version,
            "X-Widget-Channel": "latest"
        }
    )

@router.get("/v{major}/fast-widget.js")
async def get_major_version_widget(major: int):
    """Serve widget locked to major version (v1, v2, etc.)"""
    manifest = load_manifest()
    
    # Find latest version within major version
    versions = [v for v in manifest["versions"] 
                if v["version"].startswith(f"{major}.") and not v["deprecated"]]
    
    if not versions:
        raise HTTPException(status_code=404, detail=f"No stable v{major} version available")
    
    latest_in_major = sorted(versions, key=lambda x: x["version"], reverse=True)[0]
    version = latest_in_major["version"]
    
    # For now, serve the main widget file
    widget_path = WIDGET_DIR / "fast-widget.js"
    
    if not widget_path.exists():
        raise HTTPException(status_code=404, detail="Widget not found")
    
    return FileResponse(
        widget_path,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=86400",  # 24 hour cache (stable)
            "X-Widget-Version": version,
            "X-Widget-Channel": f"v{major}"
        }
    )

@router.get("/{version}/fast-widget.js")
async def get_exact_version_widget(version: str):
    """Serve exact widget version (1.2.3)"""
    widget_path = WIDGET_DIR / "fast-widget.js"
    
    if not widget_path.exists():
        raise HTTPException(status_code=404, detail="Widget not found")
    
    manifest = load_manifest()
    version_info = next((v for v in manifest["versions"] if v["version"] == version), None)
    
    # Warn if version is deprecated
    headers = {
        "Cache-Control": "public, max-age=2592000",  # 30 days (pinned version)
        "X-Widget-Version": version,
        "X-Widget-Channel": "pinned"
    }
    
    if version_info and version_info.get("deprecated"):
        headers["X-Widget-Deprecated"] = "true"
        headers["X-Widget-EOL-Date"] = version_info.get("endOfLifeDate", "")
        headers["X-Widget-Migration-Guide"] = version_info.get("migrationGuide", "")
    
    return FileResponse(widget_path, media_type="application/javascript", headers=headers)

@router.get("/beta/fast-widget.js")
async def get_beta_widget():
    """Serve beta widget version (for testing)"""
    manifest = load_manifest()
    beta_version = manifest["beta"]
    widget_path = WIDGET_DIR / "fast-widget.js"
    
    if not widget_path.exists():
        raise HTTPException(status_code=404, detail="Widget not found")
    
    return FileResponse(
        widget_path,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=300",  # 5 min cache (beta)
            "X-Widget-Version": beta_version,
            "X-Widget-Channel": "beta",
            "X-Widget-Stability": "beta"
        }
    )

@router.get("/health")
async def widget_health():
    """Health check for widget service"""
    manifest = load_manifest()
    return {
        "status": "healthy",
        "latest_version": manifest["latest"],
        "stable_version": manifest["stable"],
        "beta_version": manifest["beta"],
        "supported_versions": [v["version"] for v in manifest["versions"] 
                               if not v["deprecated"]]
    }
