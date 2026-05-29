import { SDG_ES, SDG_NAME_TO_NUMBER, SDG_NUMBER_TO_NAME } from './constants';

export interface SdgRouteContext {
  sdgNum: number;
  sdgName: string;
  sdgNameEs: string;
  /** Valor normalizado de ruta (solo dígitos 1–17) */
  normalizedSdg: string;
}

/** Normalizador único de parámetro de ruta / cache / queries */
export function normalizeSdgParam(value: unknown): string {
  return String(value ?? '')
    .replace(/^ODS\s*/i, '')
    .replace(/^SDG\s*/i, '')
    .trim();
}

export function normalizeSdgNumParam(raw: string | undefined): number | null {
  const cleaned = normalizeSdgParam(raw);
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 1 || n > 17) return null;
  return n;
}

export function resolveSdgFromRoute(sdgNumParam: string | undefined): SdgRouteContext | null {
  const normalizedSdg = normalizeSdgParam(sdgNumParam);
  const sdgNum = normalizeSdgNumParam(sdgNumParam);
  if (sdgNum == null) return null;
  const sdgName = SDG_NUMBER_TO_NAME[normalizedSdg] || SDG_NUMBER_TO_NAME[String(sdgNum)];
  if (!sdgName) return null;
  return {
    sdgNum,
    sdgName,
    sdgNameEs: SDG_ES[sdgName as keyof typeof SDG_ES] || sdgName,
    normalizedSdg: String(sdgNum),
  };
}

export function normalizeSdgId(sdgIdInput: number | string | undefined): number {
  if (sdgIdInput == null) {
    throw new Error('ODS no definido');
  }
  if (typeof sdgIdInput === 'number') {
    if (!Number.isFinite(sdgIdInput) || sdgIdInput < 1 || sdgIdInput > 17) {
      throw new Error(`ODS inválido: ${sdgIdInput}`);
    }
    return Math.floor(sdgIdInput);
  }
  const fromRoute = normalizeSdgNumParam(String(sdgIdInput));
  if (fromRoute == null) {
    throw new Error(`ODS inválido: ${sdgIdInput}`);
  }
  return fromRoute;
}

export function sdgNameFromNum(sdgNum: number): string | undefined {
  return SDG_NUMBER_TO_NAME[String(sdgNum)];
}

export function sdgNumFromName(name: string): number | undefined {
  return SDG_NAME_TO_NUMBER[name as keyof typeof SDG_NAME_TO_NUMBER];
}
