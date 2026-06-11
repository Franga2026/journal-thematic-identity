import { parseOpenAlexAuthorId } from './openAlexAuthorId';

type AuthorshipLike = {
  author?: { id?: string };
};

/** author.id → co-autores (author.id) en la misma obra. */
export function buildCoAuthorIndex(
  works: Array<{ authorships?: AuthorshipLike[] }>,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const work of works) {
    const authorships = work.authorships || [];
    const ids = authorships
      .map((a) => parseOpenAlexAuthorId(a.author?.id))
      .filter(Boolean);

    for (let i = 0; i < ids.length; i += 1) {
      const a = ids[i];
      const set = index.get(a) || new Set<string>();
      for (let j = 0; j < ids.length; j += 1) {
        if (i !== j) set.add(ids[j]);
      }
      index.set(a, set);
    }
  }

  return index;
}

export function sharedCoAuthorCount(
  index: Map<string, Set<string>>,
  authorA: string,
  peerIds: Set<string>,
): number {
  const co = index.get(authorA);
  if (!co || !peerIds.size) return 0;
  let n = 0;
  for (const id of peerIds) {
    if (co.has(id)) n += 1;
  }
  return n;
}
