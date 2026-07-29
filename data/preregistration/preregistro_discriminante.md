# Pre-registro — Validez discriminante de JCA

**Congelado: 2026-07-22.** Ejecutado en `scripts/validez_discriminante_jca.py`.  
Cualquier desviación = enmienda fechada, no reinterpretación silenciosa.

## Pregunta

¿JCA es un constructo con información propia, o se reduce a `|E|`, `log(N)`, entropía temática?

## Umbrales (no retocar)

| Condición | Estatus |
|---|---|
| R² base ≤ 0.40 **y** JCA aporta a M (ΔAIC≥2 o LR p<0.05 **y** mejora AUC CV) | Sobrevive (eje propio) |
| R² base ∈ (0.40, 0.80) o aporte marginal | Parcial (descriptor con caveat) |
| R² base ≥ 0.80 **y** sin aporte a M | Absorbido |
| Signo de β_JCA cambia entre campos n≥30 | Inestable → por disciplina |

Convención: `ΔAIC := AIC_sin_JCA − AIC_con_JCA` (>0 favorece CON JCA).

## Enmiendas interpretativas post-corrida (fechadas, no cambian umbrales)

1. El residuo (1−R²) = *variación no explicada por los controles*, **no** “señal propia” validada.
2. M con M0&lt;10 → **no estimable**; no cuenta como prueba superada ni evidencia negativa.
3. Robustez TCI obligatoria (H vs TCI vs ambas + VIF).
4. M/D centrales solo sobre `J_complete` (núcleo ∈ Path1) hasta completar Path1.

## Resultado ejecutado (〖congelado〗)

Ver `paper2_v3_esqueleto.md` §4.3–4.4 y `logs/validez_discriminante_jca_2024.log`.
