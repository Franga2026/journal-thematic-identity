import { COLORS } from './constants.js';

/**
 * Simple string hash for deterministic color assignment
 */
export function hash(s) {
  let h = 0;
  const v = String(s || '');
  for (let i = 0; i < v.length; i++) {
    h = v.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

/**
 * Get a deterministic color based on name
 */
export function getColor(name) {
  return COLORS[hash(name) % COLORS.length];
}

/**
 * Get initials from first and last name
 */
export function getInitials(first, last) {
  return (
    ((first || '').charAt(0) + (last || '').charAt(0)).toUpperCase() || '?'
  );
}

/**
 * Shorten department name by removing common prefixes
 */
export function shortDept(d) {
  return (d || '')
    .replace('Departamento de ', '')
    .replace('Escuela de ', '')
    .replace('Escuela ', '');
}

/**
 * Strip HTML tags from a string
 */
export function stripTags(s) {
  return (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean ORCID identifier by removing URL prefix
 */
export function cleanOrcid(o) {
  return (o || '').replace(/https?:\/\/orcid\.org\//i, '').trim();
}

/** Normaliza nombres de autor para emparejar con investigadores UTA */
export function normalizeAuthorName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identificador principal del investigador en autores_uta (RUT o ORCID) */
export function getResearcherUtaId(person) {
  if (!person) return '';
  const id = (person.id || '').trim();
  if (id) return id;
  return cleanOrcid(person.o);
}

/**
 * Safely format a number with locale
 */
export function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString();
}

/**
 * Calculate percentage safely
 */
export function pct(part, total) {
  if (!total || total === 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Clamp a value between min and max
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Debounce function for search inputs
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
