# Paper 3 — Cloud full-scan target (provisioning runbook)

**STOP condition for this Mac host:** free space ~131 GiB &lt; 250 GiB floor.  
**Do not start the full WORKS scan locally.**

Target: Linux VM near S3 with **≥250 GiB** free persistent disk (prefer 300–500 GiB).

## Preproduction commits (already created locally)

| Role | Commit |
|---|---|
| SPEC | `2c63e02c4e7d4714f9b5bf06c586edec0ee3d163` |
| EXECUTOR | `324d894acc616ff76c045b6bbb72a0990e9c0346` |
| READINESS | `9fa39924247c73db25159441fae89a041c3b150f` |
| GITIGNORE | `45f99fe69d50b1164ace2539d79841e2e0d95688` |
| PROVENANCE | `7ebe9f2b5d9a633a6d91aea4326aad5ba7dffd6a` |
| PROVENANCE fix | `7f3a64b3616f08adcd540bea79c1039c848e6abb` (HEAD) |

Provenance file SHA-256: see `docs/paper3/provenance/paper3_preproduction_git_provenance.json.sha256`.

Remote (Paper 3): `paper` → `https://github.com/Franga2026/journal-thematic-identity.git`  
Branch: `release-qss-v1`  
**Push only with explicit user authorization** (not performed in the preproduction sealing step).

---

## 1) Optional push (user must authorize)

```bash
cd "/Users/franga/Downloads/directorio-uta 7"
git push -u paper HEAD
```

---

## 2) Example EC2 provisioning (edit placeholders)

Requires AWS SSO session (already observed as available for account `284483510714` on the author machine).  
**Do not paste secrets into the repo.**

```bash
export AWS_REGION=us-east-1
export KEY_NAME=YOUR_KEY
export SG_ID=YOUR_SG          # egress HTTPS to S3 + Docker registries
export SUBNET_ID=YOUR_SUBNET

aws ec2 run-instances \
  --region "$AWS_REGION" \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --instance-type m6i.2xlarge \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --subnet-id "$SUBNET_ID" \
  --block-device-mappings '[
    {"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}},
    {"DeviceName":"/dev/xvdb","Ebs":{"VolumeSize":400,"VolumeType":"gp3","DeleteOnTermination":true}}
  ]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=paper3-works-acquisition},{Key=Project,Value=paper3}]'
```

OpenAlex parquet is anonymously readable (`--no-sign-request` / unsigned boto3). Instance profile is optional for this scan.

---

## 3) On the instance — persistent mount + Docker

```bash
sudo mkfs.xfs /dev/xvdb
sudo mkdir -p /data/paper3
echo '/dev/xvdb /data/paper3 xfs defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a
df -h /data/paper3   # Avail must be >= 250G

sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"   # re-login afterwards
```

```bash
git clone https://github.com/Franga2026/journal-thematic-identity.git /opt/paper3
cd /opt/paper3
git checkout 7f3a64b3616f08adcd540bea79c1039c848e6abb

docker build -t paper3-acquisition:0.2.0 docker/paper3-acquisition
docker image inspect paper3-acquisition:0.2.0 --format '{{.Id}}'
# expect: sha256:3a7dbe684a28d1ccb4659ffe5138384960eb234ed8d2f1a03580f3b31cf5e76b
```

---

## 4) Cloud preflight (auth gate remains CLOSED)

```bash
cd /opt/paper3
docker run --rm \
  -v "$PWD":/work \
  -v /data/paper3:/data/paper3 \
  -w /work \
  paper3-acquisition:0.2.0 \
  bash -lc '
    pip install -q pytest pandas
    python feasibility/ci/check_acquisition_firewall.py
    pytest tests/paper3_acquisition -q
  '
```

Also verify normative SHA-256s for protocol, acquisition spec, WORKS/SOURCES manifests, taxonomy.  
Write `data/paper3/production/cloud_preflight_report.json` only after PASS.

If any check fails → **NO-GO**. Do not open the gate.

---

## 5) Authorize + full scan (only after preflight PASS)

- Do **not** hardcode `FULL_SCAN_AUTHORIZED=true` into git.
- Prefer a runtime authorization file under `/data/paper3/production/full_scan_authorization.json` plus env scoped to one Docker run.
- Process object_index `0..2445` with checkpointing under `/data/paper3/layer_b/`.
- Expect ~675 GiB S3 read; wall-clock many hours.
- After completion: invalidate authorization; confirm production entrypoint REFUSED again.
- Commit only manifests/hashes/reports — never Layer B parquet blobs or secrets.

---

## Absolute prohibitions (unchanged)

No Q2–Q10, H1–H4, Tests E–I, I/P, JSD-family, quartiles, lags, coupling, or journal×window analysis during acquisition.
