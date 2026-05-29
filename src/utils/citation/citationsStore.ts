import type { WorkCitationIndexEntry } from '../../shared/types';

let _index: Record<string, WorkCitationIndexEntry> = {};

export function setWorkCitationsIndex(index: Record<string, WorkCitationIndexEntry>): void {
  _index = index || {};
}

export function getWorkCitationsIndexStore(): Record<string, WorkCitationIndexEntry> {
  return _index;
}
