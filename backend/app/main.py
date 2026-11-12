import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.routers import activities, auth, scanner, snacks, websocket
from app.services.image_service import UPLOADS_ROOT, ensure_upload_dirs
from app.services.websocket_manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    ws_manager.set_event_loop(asyncio.get_running_loop())
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Snack Overflow API",
        description="Office pantry inventory, voting, and activity management API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Consistent {error: {code, message}} error format across all endpoints
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/health", tags=["Health"])
    def health_check() -> dict:
        return {"status": "ok", "service": "snack-overflow-api"}

    ensure_upload_dirs()
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_ROOT)), name="uploads")

    app.include_router(auth.router)
    app.include_router(snacks.router)
    app.include_router(activities.router)
    app.include_router(scanner.router)
    app.include_router(websocket.router)

    return app


app = create_app()

