# Paper 3 — Phase-0 acquisition runtime (one-partition WORKS pilot).
# Separate from postgres:16 (cris-db). No credentials baked in.
FROM python:3.12.8-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /work

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# Repo is bind-mounted at /work at runtime.
WORKDIR /work/feasibility

# Default: help text; orchestration passes an explicit module.
CMD ["python", "-c", "print('paper3-acquisition image ready')"]
