# VERSION register

**Package:** Reconstructing Journal Thematic Identity from Article-Level Topics — Preprint v1.0 (2026-07-29)  
**Status:** Preprint, prepared for submission to *Quantitative Science Studies* (not yet peer reviewed).  
**Zenodo (reserved DOI):** https://doi.org/10.5281/zenodo.21659764 — public record available upon publication of the deposit.

This register distinguishes the frozen scientific record from the public distributed copy, so that sanitization never overwrites the historical hashes.

**Hash-status legend**
- `catalog-verified` — the frozen source's SHA-256 is registered in `data/audit/sha256_catalog.json` and was re-computed here to match it.
- `locally computed from frozen source` — SHA-256 computed here from the frozen source file; the file is a canonical script for the paper but is **not** individually listed in the audit catalog.
- `public sanitized derivative` — the file as distributed in this repository, after removing credentials / absolute local paths. Carries a new public SHA-256. No analytical logic or data value was modified.

---

## 1. Canonical code — frozen source vs public sanitized copy

| Public file | Derived from | Frozen SHA-256 | Frozen status | Public SHA-256 (public sanitized derivative) | Transformation |
|---|---|---|---|---|---|
| `code/01_compute_descriptors.py` | `cris-discovery-api/scripts/md_intrinsecos.py` | `0e819dc45410093939129ae992b2d767b47d154a263643c29efe74f7635b0f48` | `locally computed from frozen source` | `4e85013dc371fedfe036b5cb019bc676a82da2494df8a6ca5a2d6935d3852023` | renamed for public distribution; hard-coded PostgreSQL DSN replaced with CRIS_DB_DSN env read (raise if unset); **no analytical logic modified** |
| `code/02_discriminant_analysis.py` | `cris-discovery-api/scripts/jca_discriminant_validity.py` | `8e9eb539d12624b8606d416330afe0140aa78ee41c155277be80e9852c2c5b41` | `locally computed from frozen source` | `8e9eb539d12624b8606d416330afe0140aa78ee41c155277be80e9852c2c5b41` | renamed for public distribution; no credential in source (DSN imported from db); no change to DSN handling; **no analytical logic modified** |
| `code/03_temporal_replication.py` | `cris-discovery-api/scripts/prueba_A_prima.py` | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` | `catalog-verified` | `c4b3e2e531a74413ab62dfa3119d798dba11cb2bad12371c490726d17fd0e76d` | renamed for public distribution; DSN env var standardized to CRIS_DB_DSN (fallback DSN); placeholder text neutralized; no credential in source; **no analytical logic modified** |
| `code/04_documentary_control.py` | `cris-discovery-api/scripts/recompute_S_pdoc.py` | `80124f26a27d8b958a716fe7a7c430374c39b0032bc6c1b29549238168040214` | `locally computed from frozen source` | `8e9d71bda44a5989764a42fc94e885c4a96821b48ebc8a0e6d63290293c60ef3` | renamed for public distribution; OpenAlex mailto neutralized to placeholder; no credential in source (DSN imported from db); **no analytical logic modified** |
| `code/05_taxonomic_robustness.py` | `cris-discovery-api/scripts/pruebaB_taxonomica.py` | `fe98a5d7ca51f674c52803b810379eb2c58116403bfec3efb8d41cbc229f6357` | `locally computed from frozen source` | `b2fa793bb0700067542168d1d1879505cf76c96a0d1d164d52a307c0afbe0dc5` | renamed for public distribution; hard-coded PostgreSQL DSN replaced with CRIS_DB_DSN env read (raise if unset); **no analytical logic modified** |
| `code/06_snapshot_robustness.py` | `cris-discovery-api/scripts/pruebaC_snapshot.py` | `0be3ff6be2f87ae3989b00ebedcab835a7f1561ed765c1299c8e05e8d9c1b04e` | `locally computed from frozen source` | `a753b7f56531086bf1aee773d2366f3fd9594788972d71533de43872e280d7f1` | renamed for public distribution; hard-coded PostgreSQL DSN replaced with CRIS_DB_DSN env read (raise if unset); **no analytical logic modified** |
| `code/db.py` | `cris-discovery-api/db.py` | `d72aae6223531e53db546867742c1a04ee1cd7d8e61e9b4d26413b193dbe693a` | `locally computed from frozen source` | `09416f387505bf7d6948f41613697ab6938b3ca87212f78183e401f0faf74b2c` | default credential removed; CRIS_DB_DSN now required (raise if unset); **no analytical logic modified** |

> Only `prueba_A_prima.py` (→ `03_temporal_replication.py`) is individually registered in the audit catalog, and its frozen hash matches it (`catalog-verified`). The other scripts are canonical for the paper but are not per-file entries in the catalog; their frozen hashes are `locally computed from frozen source`. All public files are `public sanitized derivative`s.

## 2. Data artifacts redacted for public release (absolute local paths removed)

Only absolute local filesystem paths were removed; **no data value was changed**. Files not listed here are byte-identical to the frozen originals.

| File | Frozen SHA-256 | Frozen status | Public SHA-256 |
|---|---|---|---|
| `data/audit/diag_entropia_cola_A_rerun.log` | `61e4f060857277cbe1037e6fb13a2d8534ff13a9ff1572c6011df32d31bb6e32` | `catalog-verified` | `0fb95ec1b6dfea4608a3038e3db5b476ded2d86d63a4eeb0189416adf9f4801f` |
| `data/audit/pruebaB_taxonomica_rerun.log` | `2da3fe175c31c201c103cac9aace2901df8c0a985d69e5380355d9185b28a7c6` | `catalog-verified` | `4d002348d84a1373fb3854a55d1ea82508f1250776215dd3d17581db122f8500` |
| `data/audit/md_intrinsecos_rerun.log` | `653fd8d97110fbff05efb6029df1f3b79ccfa22d56c9a9733e39011619d922d8` | `catalog-verified` | `2c6e4ebce3c4f5e5f5244dfecd95a5ea342ee1e6b924747f77458abf6d3e1f9a` |
| `data/audit/robustez_perfil_A_rerun.log` | `7bd57bec64ae5f21a5553d0caec6838c7498c42fb842fa62d4f01160a8281af9` | `catalog-verified` | `27af949e3c5e7651b97883e1b7eca91b2c1b0329fb17ed96f10478a2b67971ea` |
| `data/audit/chequeo_jca_joes_rerun.log` | `9195f038bc72854e2f5eda11971e0cf69474fa92e66e1e7bed63cb324e59aab3` | `catalog-verified` | `a710210afe4e30fb1ac7e58649d0b5096594086c133560ce37eb26347f188d5e` |
| `data/manifests/manifest_A_prima_pdoc.json` | `70d1ae785a4effd759d04de984228ff989f0fb5a7cfe674914636aa197ac86b4` | `catalog-verified` | `efcadc5c526596110ed057dc25bfbc79837c25804b42822b4fb4c5aa3b3da425` |
| `data/manifests/manifest_A_prima_pcit.json` | `82f80062126da32f3f7093b5ddbd8f694d017bb455f949b3c811660df60143ba` | `locally computed from frozen source (not in catalog)` | `c1b28e34880f421091ff950ed91e9588dd6fa5aa1ba594a4eb1cc5056effb2cd` |

## 3. Public artifact register (SHA-256 of every file as distributed)

| File | SHA-256 |
|---|---|
| `CHANGELOG.md` | `feec55d4caba053ebf1c026a78cb0702e44a7816d602f20b3ae941bf6601aeb6` |
| `CITATION.cff` | `1ad519226f65bf2c11b4270773ffecd17df5038c9fbf8f41664d774081a20b79` |
| `LICENSE` | `366e8b5a61c069cc327bb7685854c76565c1af372e42332f7b9522415752320e` |
| `README.md` | `a2c2486f29e839d93d13f9181163f3c2beefeda5b280d87b8663f92d69af8ba9` |
| `code/01_compute_descriptors.py` | `4e85013dc371fedfe036b5cb019bc676a82da2494df8a6ca5a2d6935d3852023` |
| `code/02_discriminant_analysis.py` | `8e9eb539d12624b8606d416330afe0140aa78ee41c155277be80e9852c2c5b41` |
| `code/03_temporal_replication.py` | `c4b3e2e531a74413ab62dfa3119d798dba11cb2bad12371c490726d17fd0e76d` |
| `code/04_documentary_control.py` | `8e9d71bda44a5989764a42fc94e885c4a96821b48ebc8a0e6d63290293c60ef3` |
| `code/05_taxonomic_robustness.py` | `b2fa793bb0700067542168d1d1879505cf76c96a0d1d164d52a307c0afbe0dc5` |
| `code/06_snapshot_robustness.py` | `a753b7f56531086bf1aee773d2366f3fd9594788972d71533de43872e280d7f1` |
| `code/LICENSE` | `260899247c0bcb9a684f6edfd5ee543c4324c637325a4f76fb99a09c36372b37` |
| `code/README.md` | `f6d6849104c2837c4c47ca15b6c985e6487b189e0da4adeeab693ba8510416e5` |
| `code/db.py` | `09416f387505bf7d6948f41613697ab6938b3ca87212f78183e401f0faf74b2c` |
| `code/requirements.txt` | `3e5e937b316c05aeb0637b90687e4dd98182bc3581cb1c91017dbec46770305a` |
| `data/README.md` | `fed12ff383438018d2ba9a9f4cf727e33bd32162cfe8952f855b14b5383bbeef` |
| `data/audit/backward_metrics_raw.json` | `bf23833c9c1f67da1217b2391cdfa4d0e741d84ecd7ecae0f00384274bf27be0` |
| `data/audit/chequeo_jca_joes_rerun.log` | `a710210afe4e30fb1ac7e58649d0b5096594086c133560ce37eb26347f188d5e` |
| `data/audit/cohort_query_dump.json` | `30bf21d5279460158c63c5c49f988934bb26c48b1ce6fa4c710655d87048da3e` |
| `data/audit/diag_entropia_cola_A_rerun.log` | `0fb95ec1b6dfea4608a3038e3db5b476ded2d86d63a4eeb0189416adf9f4801f` |
| `data/audit/matriz_verificacion_numerica.md` | `d10761774a8013f5993bcb2435f8766ede04439b70ebb0e8d9588f3d7da7db0d` |
| `data/audit/md_intrinsecos_rerun.log` | `2c6e4ebce3c4f5e5f5244dfecd95a5ea342ee1e6b924747f77458abf6d3e1f9a` |
| `data/audit/pruebaB_taxonomica_rerun.log` | `4d002348d84a1373fb3854a55d1ea82508f1250776215dd3d17581db122f8500` |
| `data/audit/r2_models_exact.json` | `ab81daf53941c4d2181e23ac7be0b36f1bcbcf0ac4513e50f1a33011442b4bf2` |
| `data/audit/ref_a_empirical_trail.json` | `749b56f8dc59cda7f81bee0352d094502602ed5a85d9ff3cbeb1d41bdab94d70` |
| `data/audit/release_audit_report_final.md` | `87dcf0d65a0082ea81567d83bdb420497fe72f956d6249ae8d1cc32c56e684cc` |
| `data/audit/robustez_perfil_A_rerun.log` | `27af949e3c5e7651b97883e1b7eca91b2c1b0329fb17ed96f10478a2b67971ea` |
| `data/audit/sha256_catalog.json` | `373f74a8d8a806111b516afa68e51647eb952fc4ee279f05ed7b37a76be36369` |
| `data/audit/stability_extract.json` | `dee8777594e026224f680e79afbe3735e455b8862ff613d17aa219b769107434` |
| `data/audit/typology_from_md_intrinsecos.json` | `a4369db8ed2217a7e600a5a6a04ee1b59dd165ea413570050b9e283de60ad185` |
| `data/manifests/analisis_A_prima_pdoc_panel_comun.json` | `0a98c292284b5caf0077c679f5647524410c6fabf1c628f9f47b38bcc57d6cab` |
| `data/manifests/figure3_data.json` | `430a86345405ad776246d70d02a3c93bc6991f41e3f1208fa530922b6612b0e4` |
| `data/manifests/figure4_robustness.json` | `c5621b1f94046f5644c82837bba5a6b3a7e2c2619ba538b86de946a2387ada6d` |
| `data/manifests/figure4_stability.csv` | `a25322815ebabe97e852909174f420893087d7b9ccd11946e416c0c804791113` |
| `data/manifests/jca_discriminant_2024.json` | `52ad51c19896537a9008b535ab438858d5b020f93c95a48d4f7958cd1a81fbaa` |
| `data/manifests/manifest_A_prima.json` | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` |
| `data/manifests/manifest_A_prima_pcit.json` | `c1b28e34880f421091ff950ed91e9588dd6fa5aa1ba594a4eb1cc5056effb2cd` |
| `data/manifests/manifest_A_prima_pdoc.json` | `efcadc5c526596110ed057dc25bfbc79837c25804b42822b4fb4c5aa3b3da425` |
| `data/manifests/regresion_pcit_report.json` | `8e10518bb0383eb45ea97109cbf14f13945f453acff1d344efc3cc1bbbe1d91e` |
| `data/manifests/resultados_A_prima_pcit.csv` | `72f9dbd3a785fd0141fffe84df1e3fc2ca52ea2803591f02a185f5a9eee5a9bd` |
| `data/manifests/resultados_A_prima_pdoc.csv` | `75317452b1e1c4b10f034fdbeecd52e7b19bbe4c4651fbb253648d4c365cfcfd` |
| `data/manifests/resultados_A_prima_por_revista.csv` | `40ce53c92cb805e50bcd03532d36c740232c196ece1bd4c65b53e7041d4a5022` |
| `data/preregistration/preregistro_MD_cobertura_completa.md` | `373476518ffecceb8ff67a12cd3fb57416f7ed25ba07983de1c8ce0261601986` |
| `data/preregistration/preregistro_S_pdoc.md` | `bc239a9150187bb582eda9f252ee1a17d6e12b661431d68e86a2f6878a65fd72` |
| `data/preregistration/preregistro_discriminante.md` | `12d58f2216c3352cbf762c01f87764d4b336cdb1a7daef0a16b405b6dcdde36f` |
| `data/preregistration/preregistro_pruebaA_prima.md` | `e08ce26c0a8f39b05d05aa1c1667301e79160810c5f8692f036b8862b648b982` |
| `data/preregistration/preregistro_pruebaB.md` | `e0556aadd671b8dfeed737d7f420112db645d955a9d4072bc776afdf1d12dbb7` |
| `data/preregistration/preregistro_pruebaC.md` | `010ab3322f2be12dfb7f22e2c02742ef83e6b6acde2047d429056e79aa3d911a` |
| `figures/figure1.pdf` | `167a2a163f24dceb988f818c9be7fa14813af604148f49ed5ac4271944aa6994` |
| `figures/figure2.pdf` | `6937cd22c504a7e0e728d1fd44c1b0433678a4b9ef4ce5d939d9f5ab10a26b8c` |
| `figures/figure3.pdf` | `ea6865b387288c3cfe975c6ac8547add00bd803a9a0f37aa8216bb8d6f6ad1ee` |
| `figures/figure4.pdf` | `062c278c1acad54f5e2c5eabe81fb4968e0cab0d4b3ecb92e0393af0da1a7de2` |
| `figures/figure5.pdf` | `f3f8e47f0ad1ed9da4b46ce6a87286864e71e9653f62cdea75a9e7a10ec9b261` |
| `manuscript/preprint.md` | `3ea06b6e3fc8aac23c7ddb3fd5486e10218842a584c7eb15976cc5fabd7bef63` |
| `manuscript/preprint.pdf` | `db5dfb4944b1852ce98727a5b9d8d4c6a767fe3c58b8d2f22c01b8485476f065` |
| `manuscript/supplementary.md` | `0af25cbc7322e31a8baada504b1e5801515a9d6fb6eccfb01e2557cb56c3df5f` |
| `manuscript/supplementary.pdf` | `23e3ca0d90c570607a3dc37802ba093b8b1cfdff7e899047d776518d603a7df3` |
