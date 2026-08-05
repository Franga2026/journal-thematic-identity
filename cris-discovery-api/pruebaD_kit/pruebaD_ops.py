# Operadores de la Prueba D (importables por el runner y los tests).
# nucleo_counts reproduce E.nucleo (orden (-masa, subfield_id), acumula a tau).
import numpy as np

def nucleo_counts(sfs, cnts, tau=0.50):
    """Núcleo por conteos (o masa): subcampos en orden decreciente hasta acumular tau."""
    cnts = np.asarray(cnts, float); tot = cnts.sum()
    if tot <= 0: return set()
    order = sorted(range(len(sfs)), key=lambda i: (-cnts[i], sfs[i]))
    acc = 0.0; out = set(); thr = tau * tot
    for i in order:
        out.add(sfs[i]); acc += cnts[i]
        if acc >= thr: break
    return out

def jaccard(a, b):
    u = a | b
    return len(a & b) / len(u) if u else 1.0

def jsd(p, q):
    """Jensen-Shannon divergence (log2) sobre la unión de subcampos."""
    keys = sorted(set(p) | set(q))   # orden determinista (evita deriva de suma por hash-seed)
    pv = np.array([p.get(k, 0.0) for k in keys]); qv = np.array([q.get(k, 0.0) for k in keys])
    m = 0.5 * (pv + qv)
    def kl(a, b):
        mask = a > 0; return float(np.sum(a[mask] * np.log2(a[mask] / b[mask])))
    return 0.5 * kl(pv, m) + 0.5 * kl(qv, m)

def norm_entropy(counts):
    v = np.array([x for x in counts if x > 0], float)
    if len(v) <= 1: return 0.0
    p = v / v.sum(); return float(-np.sum(p * np.log(p)) / np.log(len(v)))

def field_of(subfield):
    """Mapa congelado subcampo→campo: primeros 2 dígitos del código ASJC."""
    return str(subfield)[:2]
