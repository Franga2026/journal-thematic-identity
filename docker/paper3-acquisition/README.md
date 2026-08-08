# Paper 3 acquisition runtime

Docker image for the **one-partition OpenAlex WORKS pilot** (SliceSpec v0.2).

- **Not** `postgres:16` / `cris-db`.
- No AWS credentials in the image.
- Outputs must be written to host bind-mounts under `data/paper3/bootstrap/`.

Build:

```bash
docker build -t paper3-acquisition:0.2.0 \
  -f docker/paper3-acquisition/Dockerfile \
  docker/paper3-acquisition
```

Run (from repo root):

```bash
docker run --rm \
  -v "$PWD":/work \
  -w /work/feasibility \
  paper3-acquisition:0.2.0 \
  python -m src.bootstrap_pilot --run-id 1
```
