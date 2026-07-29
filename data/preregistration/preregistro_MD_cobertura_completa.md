# Pre-registro — M/D con cobertura Path1 completa

### Reglas de interpretación FIJADAS antes de correr el análisis (opción A)

> Propósito: definir, *antes* de completar Path1 y recalcular M (equivalencia de cobertura) y D (divergencia de posición) sobre el universo completo, qué escribiremos según cada resultado posible. Así, ante "¿cómo decidieron interpretar ese resultado?", la respuesta es: las reglas estaban definidas antes de ejecutar. Complementa `preregistro_discriminante.md` (JCA, ya ejecutado).

---

## Contexto (lo que ya sabemos, congelado)

- Sobre la muestra comparable actual, **M no es estimable** (M=0 tiene n=2; comparabilidad ≈ M=1 por construcción).
- Las 122 revistas excluidas por núcleo sin Path1 tienen **JCA medio más bajo (0.38 vs 0.52)** → la cobertura incompleta subrepresenta el régimen desplazado.
- **D es nulo** frente a JCA (ΔAIC=−2.00, p=0.95). No se espera que eso cambie.

Completar Path1 hace dos cosas: (a) incorpora revistas cuyo núcleo real hoy no está rankeado — muchas de bajo JCA; (b) permite que M tenga variación real (entran solo_contenido con M=0).

---

## Métrica primaria y controles

- Resultados: `M` (logístico) y `D` (OLS, solo M=1). Distancia D en percentiles si están; cuartiles si no (declarar).
- Controles estructurales en todos los modelos: `|E_j|`, `log(N_j)`, `H_j` (y robustez con TCI).
- Universo: total con Path1 completo; reportar N total, N con núcleo cubierto, y características de cualquier resto excluido.
- Convención AIC (igual que en JCA): `ΔAIC := AIC_sin_JCA − AIC_con_JCA` (>0 favorece el modelo CON JCA).

---

## Reglas de decisión (si A → escribimos X)

### Sobre M (equivalencia de cobertura)

- **A1 · M gana variación y JCA aporta** (suficientes M=0; en modelo anidado ΔAIC≥2 a favor de CON JCA **y** mejora AUC en CV): escribimos que **JCA tiene utilidad incremental para distinguir cobertura**, con el caveat de semi-circularidad explícito (M y JCA comparten que "núcleo fuera del marco" ⇒ baja alineación). Se presenta como coherencia fuerte, no como validación externa.

- **A2 · M gana variación pero JCA NO aporta** (ΔAIC&lt;2 o sin mejora en CV): escribimos que **la cobertura es una dimensión descriptiva independiente**; JCA no la predice más allá de lo estructural. Refuerza la tesis de tres dimensiones separadas.

- **A3 · M sigue casi constante aun con Path1 completo** (M=0 marginal): escribimos que **la equivalencia de cobertura no es estimable en poblaciones de revistas comparables**; se caracteriza solo descriptivamente (conteos, Jaccard), y se marca como límite estructural — no fracaso del análisis.

### Sobre D (divergencia de posición)

- **B1 · D sigue nulo frente a JCA** (esperado): mantenemos *"JCA no predice la divergencia de posición"*; cierra la dimensión como ortogonal a la alineación. Es evidencia **a favor** de la tesis de tres dimensiones (son independientes).

- **B2 · D muestra relación con JCA que antes no se veía** (ΔAIC≥2, efecto estable por campo): **re-abrimos**. Se reporta como hallazgo condicional a cobertura completa, se verifica que no sea artefacto de las nuevas revistas de bajo JCA, y solo entonces se discute mecanismo — nunca antes.

### Sobre la estructura de dos regímenes

- **C1 · las nuevas revistas de bajo JCA se agrupan en M=0 (desplazadas):** evidencia **descriptiva** de los dos regímenes (alineado vs desplazado). Se reporta como descripción de poblaciones, **no** como mecanismo causal.

- **C2 · no hay separación limpia de regímenes:** retiramos la afirmación de "dos regímenes" y describimos una distribución continua. Reencuadre honesto.

### Regla transversal

Ningún resultado positivo sobre M se vende como validación **externa** de JCA. La validación externa sigue siendo cross-base (Scopus/WoS), estudio posterior. Este análisis solo distingue si cobertura, posición y alineación son **dimensiones separables** — que es la tesis del paper.

---

## Sensibilidad obligatoria a reportar

- Resultados sobre universo total vs solo núcleo cubierto (comparar).
- Características de las revistas incorporadas al completar Path1 (JCA, `|E|`, tamaño): ¿son sistemáticamente las desplazadas?
- Robustez H vs TCI en cualquier modelo de M/D, igual que en JCA.

---

## Umbrales operativos (checklist al correr)

| Chequeo | Criterio |
|---|---|
| M0 “suficiente” para A1/A2 | M0 ≥ 10 (mismo piso de fiabilidad que en discriminante JCA) |
| “Aporta a M” | ΔAIC ≥ 2 **y** ΔAUC_CV > 0 (o LR p&lt;0.05 con ΔAUC>0, coherente con preregistro JCA) |
| “D nulo” (B1) | ΔAIC &lt; 2 **o** p_JCA ≥ 0.05 **y** ΔR² ≈ 0 |
| “D reabre” (B2) | ΔAIC ≥ 2 **y** signo/magnitud de β_JCA estable en campos con n≥30 |
| Regímenes (C1) | Concentración de nuevas (bajo JCA) en M=0 vs M=1; reportar medias/deciles, no solo p |

---

## Salida esperada (rellena el esqueleto v3)

Tablas/cifras para `paper2_v3_esqueleto.md`:

- §4.1 M — conteos, Jaccard, por campo; disclaimer Path1 si aún queda resto.
- §4.2 D — percentiles/cuartiles, transición, por campo.
- §4.5 — proporción alineado vs desplazado **o** retiro de “dos regímenes” (C2).
- Decisión aplicada: A1 | A2 | A3 × B1 | B2 × C1 | C2 (una celda).

---

*Congelado: 2026-07-22. Desviaciones se anotan como enmiendas fechadas, no como reinterpretación.*
