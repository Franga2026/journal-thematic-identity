import { describe, it, expect } from 'vitest';
import {
  formatOrcidEducationLine,
  normalizeOrcidEducation,
} from '../utils/orcidEducationDisplay';

describe('formatOrcidEducationLine', () => {
  it('formatea varios grados con una institución', () => {
    expect(
      formatOrcidEducationLine([
        { degree: 'Doctorado en Ciencias', institution: 'Universidad de Chile' },
        { degree: 'Médico Cirujano', institution: 'Universidad de Chile' },
      ]),
    ).toBe('Doctorado en Ciencias · Médico Cirujano — Universidad de Chile');
  });

  it('usa department si falta degree', () => {
    expect(
      formatOrcidEducationLine([{ department: 'Ingeniería Mecánica', institution: 'UTFSM' }]),
    ).toBe('Ingeniería Mecánica — UTFSM');
  });

  it('prioriza institución del endYear más reciente', () => {
    expect(
      formatOrcidEducationLine([
        { degree: 'Psicopedagogo', institution: 'Universidad Catolica del Norte', endYear: '1999' },
        { degree: 'Especialista', institution: 'Universidad de Chile', endYear: '1978' },
      ]),
    ).toBe('Psicopedagogo · Especialista — Universidad Catolica del Norte');
  });

  it('recorta espacios en degree e institution', () => {
    expect(
      formatOrcidEducationLine([
        { degree: 'Magister ', institution: 'Universidad de Tarapaca ' },
      ]),
    ).toBe('Magister — Universidad de Tarapaca');
  });

  it('retorna null si no hay formación usable', () => {
    expect(formatOrcidEducationLine([])).toBeNull();
    expect(formatOrcidEducationLine([{ institution: '  ' }])).toBeNull();
    expect(formatOrcidEducationLine(undefined)).toBeNull();
  });
});

describe('normalizeOrcidEducation', () => {
  it('filtra entradas vacías', () => {
    expect(
      normalizeOrcidEducation([
        { degree: 'PhD', institution: 'MIT' },
        { institution: '' },
        { department: '   ' },
      ]),
    ).toHaveLength(1);
  });
});
