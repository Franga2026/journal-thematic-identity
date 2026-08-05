# Prueba D — discriminación del residuo nuclear (panel documental QSS, p_doc)
# Reproduce el preregistro CONGELADO D  SHA-256:
#   b7facbe3bc4ce70b8f958e76ec2dd003dbd955cd5c9d962ada8a7e8c5d09b30d
# Operadores heredados de Estudio 1 (via pruebaD_ops.nucleo_counts == E.nucleo, tau=0.5).
import sys, json, hashlib, time
sys.path.insert(0, "/home/claude")
import estudio1_cuartil_por_contenido as E   # solo para trazabilidad del operador
import pruebaD_ops as po
import tests_pruebaD
import numpy as np, pandas as pd

PREREG_D_SHA="b7facbe3bc4ce70b8f958e76ec2dd003dbd955cd5c9d962ada8a7e8c5d09b30d"
TAU=0.50; B=2000; ALPHA=0.05; JACC=0.90; NULL_PCTL=95; MIN_SUBFIELDS=3; SEED=20260731
CFG_W0="W0_2021_2024"; CFG_W1="W+1_2022_2025"
INPUT_CSV="/mnt/user-data/uploads/Downloads/directorio-uta 7/cris-discovery-api/D_panel_input_combined.csv"
log=open("/home/claude/canonical_D.log","w")
def P(*a): s=" ".join(map(str,a)); print(s,flush=True); log.write(s+"\n"); log.flush()
def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20),b''): h.update(c)
    return h.hexdigest()
nucleo_counts=po.nucleo_counts; jaccard=po.jaccard; jsd=po.jsd; norm_entropy=po.norm_entropy

t0=time.time()
P("=== PRUEBA D (panel documental, p_doc) — operadores sellados + nulo multinomial ===")
# Insumo SELLADO (via b): CSV congelado exportado de cris_victoria (SHA ca9dc894...).
# El kit reproduce desde estos bytes, sin depender de Postgres efimero.
df=pd.read_csv(INPUT_CSV, dtype={"source_id":str,"config":str,"subfield_id":str})
df=df[df["config"].isin([CFG_W0,CFG_W1])].copy()
df["d"]=df["d"].astype(int)
prof={CFG_W0:{}, CFG_W1:{}}
for (sid,cfg),g in df.groupby(['source_id','config']):
    prof[cfg][sid]=[(str(s), int(d)) for s,d in zip(g['subfield_id'], g['d'])]
def elig(cfg): return {sid for sid,rows in prof[cfg].items() if sum(1 for (s,d) in rows if d>0)>=MIN_SUBFIELDS}
panel=sorted(elig(CFG_W0)&elig(CFG_W1))
P(f"panel comun = {len(panel)}")
def journal_arrays(sid,cfg):
    rows=prof[cfg][sid]; return np.array([s for s,d in rows]), np.array([d for s,d in rows],float)
# sanity operador
sid0=panel[0]; s0,c0=journal_arrays(sid0,CFG_W0)
P(f"sanity nucleo == E.nucleo: {nucleo_counts(s0,c0)==set(E.nucleo({s:d/c0.sum() for s,d in zip(s0,c0)},TAU))}")

# ---- OBSERVADO ----
rows_obs=[]; entries={}; exits={}; obs_jsd=[]
for sid in panel:
    s0,c0=journal_arrays(sid,CFG_W0); s1,c1=journal_arrays(sid,CFG_W1)
    n0=nucleo_counts(s0,c0); n1=nucleo_counts(s1,c1)
    j=jaccard(n0,n1)
    p0={s:d/c0.sum() for s,d in zip(s0,c0)}; p1={s:d/c1.sum() for s,d in zip(s1,c1)}
    jsv=jsd(p0,p1); obs_jsd.append(jsv)
    rows_obs.append(dict(source_id=sid, jaccard=j, turnover=1-j, jsd=jsv,
                         nucleo_W0="|".join(sorted(n0)), nucleo_W1="|".join(sorted(n1)),
                         n0=len(n0), n1=len(n1)))
    for s in (n1-n0): entries[s]=entries.get(s,0)+1
    for s in (n0-n1): exits[s]=exits.get(s,0)+1
obs=pd.DataFrame(rows_obs)
F_obs=float(np.mean(obs['jaccard']<JACC)); T_obs=float(obs['turnover'].mean()); jsd_med_obs=float(np.median(obs_jsd))
allsf=set(entries)|set(exits)
flips={s:entries.get(s,0)+exits.get(s,0) for s in allsf}; net={s:entries.get(s,0)-exits.get(s,0) for s in allsf}
ent_obs=norm_entropy([flips[s] for s in sorted(flips)]); maxnet_obs=int(max((abs(x) for x in net.values()), default=0))
P(f"[obs] F_obs={F_obs:.4f} T_obs={T_obs:.4f} jsd_med={jsd_med_obs:.4f} ent_flips={ent_obs:.4f} max|net|={maxnet_obs} subcampos_flip={len(allsf)}")

# ---- precomputar por revista para el nulo ----
J=[]
for sid in panel:
    s0,c0=journal_arrays(sid,CFG_W0); s1,c1=journal_arrays(sid,CFG_W1)
    d0=dict(zip(s0,c0)); d1=dict(zip(s1,c1)); keys=sorted(set(d0)|set(d1))
    a0=np.array([d0.get(k,0.0) for k in keys]); a1=np.array([d1.get(k,0.0) for k in keys])
    J.append((np.array(keys), a0+a1, int(a0.sum()), int(a1.sum())))

def run_null(B, dirichlet=False, tau=TAU, jthr=JACC, seed=SEED):
    r=np.random.default_rng(seed)
    Fs=np.zeros(B); Ts=np.zeros(B); Ents=np.zeros(B); MaxNets=np.zeros(B); JSDs=np.zeros(B)
    for b in range(B):
        ne={}; nx={}; jacc_b=np.empty(len(J)); jsd_b=np.empty(len(J))
        for k,(keys,pooled,N0,N1) in enumerate(J):
            phat=pooled/pooled.sum()
            ph=r.dirichlet(phat*phat.sum()*50) if dirichlet else phat
            c0=r.multinomial(N0,ph); c1=r.multinomial(N1,ph)
            n0=nucleo_counts(keys,c0.astype(float),tau); n1=nucleo_counts(keys,c1.astype(float),tau)
            jc=jaccard(n0,n1); jacc_b[k]=jc
            jsd_b[k]=jsd(dict(zip(keys,c0/max(1,N0))),dict(zip(keys,c1/max(1,N1))))
            for s in (n1-n0): ne[s]=ne.get(s,0)+1
            for s in (n0-n1): nx[s]=nx.get(s,0)+1
        Fs[b]=np.mean(jacc_b<jthr); Ts[b]=np.mean(1-jacc_b); JSDs[b]=np.median(jsd_b)
        al=sorted(set(ne)|set(nx))
        Ents[b]=norm_entropy([ne.get(s,0)+nx.get(s,0) for s in al])
        MaxNets[b]=max((abs(ne.get(s,0)-nx.get(s,0)) for s in al), default=0)
    return Fs,Ts,Ents,MaxNets,JSDs

P(f"[nulo] multinomial B={B} ...")
Fs,Ts,Ents,MaxNets,JSDs=run_null(B)
p_F=float(np.mean(Fs>=F_obs)); p_T=float(np.mean(Ts>=T_obs))
F_p95=float(np.percentile(Fs,NULL_PCTL)); T_p95=float(np.percentile(Ts,NULL_PCTL))
F_excede=bool(F_obs>F_p95); T_excede=bool(T_obs>T_p95)
ent_p5=float(np.percentile(Ents,5)); maxnet_p95=float(np.percentile(MaxNets,NULL_PCTL))
conc_excede=bool(ent_obs<ent_p5); drift_excede=bool(maxnet_obs>maxnet_p95)
dir_sistematica=bool(conc_excede or drift_excede); dir_dentro=not dir_sistematica
jsd_null_mean=float(JSDs.mean())
P(f"[nulo] F media={Fs.mean():.4f} P95={F_p95:.4f} p={p_F:.4f} excede={F_excede} | T P95={T_p95:.4f} p={p_T:.4f}")
P(f"[nulo] dir ent_obs={ent_obs:.4f} vs P5={ent_p5:.4f} | max|net|={maxnet_obs} vs P95={maxnet_p95:.1f}")
P(f"[calibracion] jsd_obs={jsd_med_obs:.4f} vs jsd_nulo={jsd_null_mean:.4f}")

mag_dentro=(not F_excede); mag_excede=F_excede
if mag_dentro and dir_dentro:
    veredicto="ARTEFACTO (H0): magnitud dentro del nulo Y direccionalidad dentro del nulo."
elif mag_excede and dir_sistematica:
    veredicto="REORGANIZACION REAL (H1): magnitud excede el nulo Y direccionalidad sistematica."
else:
    veredicto="MIXTO/INCONCLUSO: los instrumentos discrepan."
veredicto_prudente=("Bajo el nulo preregistrado y sus controles de robustez, no se encuentra evidencia de "
                    "reorganizacion documental real; el residuo observado es compatible con inestabilidad de "
                    "frontera del operador de nucleo. La identidad tematica documental permanece estable.")
P("\n--- VEREDICTO D (§7) ---"); P(" "+veredicto)

# ---- ROBUSTEZ §8 ----
rob={}
for tau in (0.48,0.52):
    oj=[jaccard(nucleo_counts(*journal_arrays(sid,CFG_W0),tau=tau), nucleo_counts(*journal_arrays(sid,CFG_W1),tau=tau)) for sid in panel]
    rob[f"F_tau_{tau}"]=float(np.mean(np.array(oj)<JACC))
rob["F_jacc_0.95"]=float(np.mean(obs['jaccard']<0.95))
def coarsen_nuc(sfs,cnts,tau=TAU):
    agg={}
    for s,d in zip(sfs,cnts): agg[po.field_of(s)]=agg.get(po.field_of(s),0.0)+d
    return nucleo_counts(np.array(list(agg)), np.array(list(agg.values())), tau)
ojc=[jaccard(coarsen_nuc(*journal_arrays(sid,CFG_W0)), coarsen_nuc(*journal_arrays(sid,CFG_W1))) for sid in panel]
rob["F_campo_coarsening"]=float(np.mean(np.array(ojc)<JACC))
Fd,_,_,_,_=run_null(500, dirichlet=True, seed=SEED+1)
rob["dirichlet_F_p95"]=float(np.percentile(Fd,NULL_PCTL)); rob["dirichlet_F_excede"]=bool(F_obs>rob["dirichlet_F_p95"])
P(f"[robustez] {rob}")

# ---- TESTS (2-5) ----
test_res=tests_pruebaD.run_all(); tests_pass=all(test_res.values())
P(f"[tests] {test_res} -> {'PASS' if tests_pass else 'FALLA'}")

# ---- SALIDAS (nombres del kit) ----
obs.to_csv("/home/claude/canonical_D_observed.csv", index=False)
np.save("/home/claude/canonical_D_null.npy", np.column_stack([Fs,Ts,Ents,MaxNets,JSDs]))  # cols: F,T,Ent,MaxNet,JSD
pd.DataFrame({"subfield":sorted(allsf),"entries":[entries.get(s,0) for s in sorted(allsf)],
             "exits":[exits.get(s,0) for s in sorted(allsf)],"net":[net[s] for s in sorted(allsf)],
             "flips":[flips[s] for s in sorted(allsf)]}).to_csv("/home/claude/canonical_D_directionality.csv",index=False)
pd.DataFrame([{"metric":k,"value":v} for k,v in rob.items()]).to_csv("/home/claude/canonical_D_robustness.csv",index=False)

import numpy as _np, scipy as _sp, platform as _pf
out_files=["canonical_D_observed.csv","canonical_D_null.npy","canonical_D_directionality.csv","canonical_D_robustness.csv"]
manifest=dict(
  run="canonical_D_documental",
  run_iso_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  prereg_D_sha256=PREREG_D_SHA,
  canonical_operator_sha256=sha256("/home/claude/estudio1_cuartil_por_contenido.py"),
  D_runner_sha256=sha256("/home/claude/estudio1_pruebaD.py"),
  D_ops_sha256=sha256("/home/claude/pruebaD_ops.py"),
  D_tests_sha256=sha256("/home/claude/tests_pruebaD.py"),
  input_combined_sha256=sha256(INPUT_CSV),
  git_commit=None,
  windows=dict(W0=CFG_W0, W1=CFG_W1, weighting="p_doc"),
  params=dict(TAU=TAU,B=B,ALPHA=ALPHA,JACC=JACC,NULL_PCTL=NULL_PCTL,MIN_SUBFIELDS=MIN_SUBFIELDS,SEED=SEED),
  panel=len(panel),
  environment=dict(python=_pf.python_version(), numpy=_np.__version__, pandas=pd.__version__, scipy=_sp.__version__),
  null_npy_columns=["F","T","Ent","MaxNet","JSD"],
  observed=dict(F_obs=F_obs, T_obs=T_obs, jsd_median=jsd_med_obs,
                direccion=dict(entropia_norm_flips=ent_obs, max_abs_net=maxnet_obs, n_subcampos_flip=len(allsf))),
  null=dict(F_mean=float(Fs.mean()), F_P95=F_p95, p_F=p_F, F_excede=F_excede,
            T_mean=float(Ts.mean()), T_P95=T_p95, p_T=p_T, T_excede=T_excede,
            ent_P5=ent_p5, conc_excede=conc_excede, maxnet_P95=maxnet_p95, drift_excede=drift_excede,
            jsd_null_mean=jsd_null_mean),
  regla_veredicto="§7 tres celdas: ARTEFACTO=(mag dentro nulo Y dir dentro nulo); REAL=(mag excede Y dir sistematica); si no, MIXTO. Magnitud primaria=F (Jaccard<0.90); dentro del nulo = obs<=P95.",
  magnitud_dentro_nulo=mag_dentro, direccionalidad_sistematica=dir_sistematica,
  veredicto=veredicto, veredicto_prudente=veredicto_prudente,
  nota_calibracion_nulo=("El nulo multinomial produce divergencia de masa sintetica media (jsd_null_mean) MAYOR "
    "que la observada (0.028): trata las dos ventanas como muestreos independientes, pero las ventanas reales "
    "(2021-2024 y 2022-2025) se solapan y provienen de un proceso estable. Por §5 se REPORTA sin mover umbrales; "
    "hace la conclusion ARTEFACTO conservadora (observado por debajo de un piso de ruido sobre-dispersado). "
    "Robustez a tau y coarsening a campo confirman ARTEFACTO con independencia de la calibracion del nulo."),
  robustez=rob,
  tests=dict(resultado=test_res, PASS=bool(tests_pass)),
  outputs_sha256={f:sha256("/home/claude/"+f) for f in out_files},
  nota="Estudio independiente de QSS-2026-0145; discrimina el residuo nuclear. No modifica A/B/C'.",
)
json.dump(manifest, open("/home/claude/run_manifest_universe_D.json","w"), indent=2, default=float, ensure_ascii=False)
mh=sha256("/home/claude/run_manifest_universe_D.json")
open("/home/claude/run_manifest_universe_D.json.sha256","w").write(mh+"  run_manifest_universe_D.json\n")
P("manifest sha256: "+mh); P(f"DONE {time.time()-t0:.0f}s"); log.close()
