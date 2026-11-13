FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System packages needed to build/run psycopg2, Pillow and healthchecks.
# (Most Python deps ship manylinux wheels, but these cover source fallbacks
# on less common host architectures so the image builds anywhere.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch from the official CPU wheel index first.
# The default PyPI wheel pulls several GB of NVIDIA CUDA/cuDNN dependencies
# that this project never uses (the scanner model runs on CPU), which would
# make the image huge and slow to build on a plain laptop with no GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install the rest of the Python dependencies (torch already satisfies the
# version constraint above, so pip won't re-download the GPU build)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make sure the uploads directories exist (also created at runtime by the app)
RUN mkdir -p /app/uploads/snacks /app/uploads/demo

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -fs http://localhost:8000/health || exit 1

# Run migrations (and optionally seed demo data) before starting the API
CMD alembic upgrade head && \
    if [ "$SEED_DB" = "true" ]; then python -m scripts.seed || true; fi && \
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
