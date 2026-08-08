"""Finalize one-partition pilot report (technical metrics only)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import writers

REPO = Path(__file__).resolve().parents[2]
BOOTSTRAP = REPO / "data" / "paper3" / "bootstrap"
N_OBJECTS = 2446


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--firewall-pass", action="store_true")
    p.add_argument("--image-tag", default="")
    p.add_argument("--image-id", default="")
    p.add_argument("--image-digest", default="")
    p.add_argument("--dockerfile-sha256", default="")
    p.add_argument("--requirements-sha256", default="")
    args = p.parse_args()

    report_path = BOOTSTRAP / "pilot_acquisition_report.json"
    rep = json.loads(report_path.read_text(encoding="utf-8"))
    r1 = rep.get("run_1", {})
    r2 = rep.get("run_2", {})
    sha1 = r1.get("output_sha256")
    sha2 = r2.get("output_sha256")

    restr = REPO / "feasibility" / "tmp_restricted"
    leftover = [
        x.name
        for x in restr.iterdir()
        if x.is_file() and x.name not in {".gitignore", ".gitkeep"}
    ]

    ib = int(r1.get("object_bytes") or 0)
    ob = int(r1.get("output_bytes") or 0)
    wc = float(r1.get("wall_clock_seconds") or 0)
    # Prefer official WORKS manifest total size (not N * this tiny early part).
    man_bytes = None
    man_path = BOOTSTRAP / "works_manifest.pinned.json"
    if man_path.is_file():
        man = json.loads(man_path.read_text(encoding="utf-8"))
        man_bytes = int(man.get("content_length") or 0) or None
    slim_ratio = (ob / ib) if ib else None

    rep.update(
        {
            "PILOT_INFRASTRUCTURE_ONLY": True,
            "prohibited_outcomes_computed": False,
            "full_works_scan_started": False,
            "used_cris_victoria_works": False,
            "output_sha256_run1": sha1,
            "output_sha256_run2": sha2,
            "byte_reproducible": bool(sha1 and sha2 and sha1 == sha2),
            "firewall_pass": bool(args.firewall_pass),
            "tmp_restricted_empty": len(leftover) == 0,
            "tmp_restricted_leftover": leftover,
            "q1_vertical_slice_pass": bool(r1.get("q1", {}).get("q1_sha256")),
            "docker_build": {
                "image_tag": args.image_tag,
                "image_id": args.image_id,
                "image_digest": args.image_digest or None,
                "dockerfile_sha256": args.dockerfile_sha256,
                "requirements_sha256": args.requirements_sha256,
            },
            "full_scan_estimate_from_pilot_only": {
                "warning": (
                    "Single partition may not be representative of all "
                    f"{N_OBJECTS} objects. Transfer uses manifest "
                    "content_length; Layer-B/time scale the pilot ratio only."
                ),
                "n_objects": N_OBJECTS,
                "est_transfer_bytes_from_manifest": man_bytes,
                "est_transfer_gib_from_manifest": round(man_bytes / 1024**3, 2)
                if man_bytes
                else None,
                "pilot_object_bytes": ib,
                "pilot_output_bytes": ob,
                "pilot_slim_byte_ratio": round(slim_ratio, 6) if slim_ratio else None,
                "est_persistent_layer_b_gib_if_same_ratio": round(
                    (man_bytes * slim_ratio) / 1024**3, 2
                )
                if man_bytes and slim_ratio
                else None,
                "est_wall_clock_hours_linear_from_pilot": round(
                    wc * N_OBJECTS / 3600, 2
                ),
                "est_temp_gib_for_one_object_buffer": round(ib * 2 / 1024**3, 3),
            },
        }
    )
    writers.write_bootstrap_json("pilot_acquisition_report.json", rep)
    print(
        json.dumps(
            {
                "byte_reproducible": rep["byte_reproducible"],
                "sha1": sha1,
                "sha2": sha2,
                "firewall_pass": rep["firewall_pass"],
                "q1_pass": rep["q1_vertical_slice_pass"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
