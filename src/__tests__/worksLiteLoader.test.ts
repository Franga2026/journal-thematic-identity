import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearWorksLite,
  getWorksLite,
  isWorksLiteReady,
  setWorksLiteForTests,
} from '../services/worksLiteLoader';
import type { Work } from '../shared/types';

describe('worksLiteLoader', () => {
  beforeEach(() => {
    clearWorksLite();
  });

  it('empieza vacío', () => {
    expect(getWorksLite()).toBe(null);
    expect(isWorksLiteReady()).toBe(false);
  });

  it('setWorksLiteForTests hidrata el corpus', () => {
    const sample = [{ t: 'Demo', y: 2024 }] as Work[];
    setWorksLiteForTests(sample);
    expect(isWorksLiteReady()).toBe(true);
    expect(getWorksLite()).toBe(sample);
  });
});
