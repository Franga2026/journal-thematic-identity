import { describe, it, expect } from 'vitest';
import {
  buildWorkPrompt,
  buildResearcherPrompt,
  buildChatPrompt,
  compactWorkForPrompt,
} from '../services/ai/promptBuilders';
import { limitPayloadSize } from '../services/ai/sanitize';

describe('promptBuilders', () => {
  it('buildWorkPrompt no incluye arrays masivos', () => {
    const prompt = buildWorkPrompt({
      t: 'Estudio de prueba',
      a: ['Autor A'],
      y: 2024,
      d: '10.1234/test',
    });
    expect(prompt).toContain('Estudio de prueba');
    expect(prompt.length).toBeLessThan(8000);
    expect(prompt).not.toMatch(/9127/);
  });

  it('compactWorkForPrompt trunca título largo', () => {
    const long = 'x'.repeat(5000);
    const c = compactWorkForPrompt({ t: long });
    expect(c.title!.length).toBeLessThanOrEqual(221);
  });

  it('buildResearcherPrompt limita muestra de obras', () => {
    const works = Array.from({ length: 50 }, (_, i) => ({ t: `Paper ${i}`, y: 2020 + i }));
    const prompt = buildResearcherPrompt(
      { f: 'Ana', l: 'García', o: '0000-0001-1111-1111' },
      works,
      { works_count: 50, h_index: 10 }
    );
    const matches = prompt.match(/Paper /g) || [];
    expect(matches.length).toBeLessThanOrEqual(15);
    limitPayloadSize({ prompt: prompt.slice(0, 20000) });
  });

  it('buildChatPrompt sanitiza mensaje', () => {
    const prompt = buildChatPrompt('<script>x</script>Pregunta', [], {
      investigators_count: 10,
      publications_count: 100,
    });
    expect(prompt).not.toContain('<script>');
    expect(prompt).toContain('investigators_count');
  });
});
