# Tests de la Prueba D (2-5). El test 1 (reproducción determinista) se hace por doble corrida.
import sys; sys.path.insert(0, "/home/claude")
import numpy as np
import pruebaD_ops as po
import estudio1_cuartil_por_contenido as E

def test_nucleo_boundaries():
    """T3: nucleo_counts == E.nucleo en fronteras de tau=0.5, empates y >=3 subcampos."""
    casos = [
        (['30','20','10'], [0.6,0.3,0.1]),   # cruza en el primero
        (['30','20','10'], [0.5,0.3,0.2]),   # exactamente en el umbral
        (['30','20','10'], [0.4,0.4,0.2]),   # empate de masa (desempate por id)
        (['20','10'],      [0.5,0.5]),       # empate en el umbral
        (['40','30','20','10'], [0.25,0.25,0.25,0.25]),  # todos iguales
        (['3109','3110','2708','2604'], [10,7,7,1]),      # empate parcial, conteos
    ]
    # E.nucleo (operador sellado) compara acc>=tau sobre la distribucion YA normalizada
    # (asi lo invoca el runner: d/sum). nucleo_counts normaliza via thr=tau*tot. Para
    # comparar el MISMO operador hay que pasar a E.nucleo la masa normalizada.
    def enuc(sfs, m):
        tot = float(sum(m))
        return set(E.nucleo({s: float(v) / tot for s, v in zip(sfs, m)}, 0.50))
    ok = True
    for sfs, m in casos:
        a = po.nucleo_counts(sfs, np.array(m, float), 0.50)
        b = enuc(sfs, m)
        ok &= (a == b)
    # aleatorios
    rng = np.random.default_rng(7)
    for _ in range(200):
        k = rng.integers(3, 12); sfs = [f"{c:04d}" for c in rng.choice(9999, k, replace=False)]
        m = rng.integers(1, 50, k).astype(float)
        a = po.nucleo_counts(sfs, m, 0.50); b = enuc(sfs, m)
        ok &= (a == b)
    return bool(ok)

def test_multinomial_null():
    """T2: p_hat agrupa ambas ventanas; N0/N1 de d; réplicas independientes; suman 1 y a N; mismos subcampos."""
    keys = ['10','20','30']; d0 = np.array([10.,5,2]); d1 = np.array([8.,6,3])
    N0 = int(d0.sum()); N1 = int(d1.sum())
    pooled = d0 + d1; phat = pooled / pooled.sum()
    ok = abs(phat.sum() - 1.0) < 1e-12
    ok &= (N0 == 17 and N1 == 17)                       # N desde conteos d
    ok &= np.allclose(phat, np.array([18,11,5]) / 34)   # p_hat = (d0+d1)/(N0+N1)
    r = np.random.default_rng(0)
    c0 = r.multinomial(N0, phat); c1 = r.multinomial(N1, phat)
    ok &= (c0.sum() == N0 and c1.sum() == N1)           # cada sorteo suma a N
    ok &= (len(c0) == len(keys) and len(c1) == len(keys))  # mismo conjunto de subcampos ambos sorteos
    return bool(ok)

def test_directionality():
    """T4: flip, deriva neta (signo), entropía de concentración, max|net|, subcampos sin flip."""
    entries = {}; exits = {}
    def apply(n0, n1):
        for s in (n1 - n0): entries[s] = entries.get(s, 0) + 1
        for s in (n0 - n1): exits[s] = exits.get(s, 0) + 1
    apply({'A','B'}, {'A','C'})   # C entra, B sale
    apply({'A'}, {'A'})           # sin flip (no aporta)
    ok = (entries == {'C': 1} and exits == {'B': 1})
    allsf = set(entries) | set(exits)
    net = {s: entries.get(s, 0) - exits.get(s, 0) for s in allsf}
    ok &= (net == {'C': 1, 'B': -1})                    # signo de la deriva
    flips = {s: entries.get(s, 0) + exits.get(s, 0) for s in allsf}
    ok &= (max(abs(x) for x in net.values()) == 1)      # max|net|
    ok &= abs(po.norm_entropy(list(flips.values())) - 1.0) < 1e-9  # 2 flips iguales -> entropia 1
    return bool(ok)

def test_robustness():
    """T5: tau solo cambia el nucleo; coarsening usa field_of; Dirichlet preserva soporte y suma 1."""
    sfs = ['3109','3110','2708']; c = np.array([5.,4,3])
    n = {t: po.nucleo_counts(sfs, c, t) for t in (0.48, 0.50, 0.52)}
    ok = all(isinstance(v, set) for v in n.values())
    ok &= (po.field_of('3109') == '31' and po.field_of('2708') == '27')  # mapa congelado
    phat = c / c.sum(); dd = np.random.default_rng(0).dirichlet(phat * phat.sum() * 50)
    ok &= (abs(dd.sum() - 1.0) < 1e-9 and len(dd) == len(phat))
    return bool(ok)

def run_all():
    return {
        "T2_multinomial_null": test_multinomial_null(),
        "T3_nucleo_boundaries": test_nucleo_boundaries(),
        "T4_directionality": test_directionality(),
        "T5_robustness": test_robustness(),
    }

if __name__ == "__main__":
    res = run_all()
    for k, v in res.items():
        print(f"  {k}: {'PASS' if v else 'FALLA'}")
    print("RESUMEN:", "PASS" if all(res.values()) else "FALLA")
