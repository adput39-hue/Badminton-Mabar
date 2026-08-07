export interface PairingRecord {
  id: string;
  className: string;
  matchCount: number;
  arrival?: number;
}

export interface PairingSuggestion {
  team1: [string, string];
  team2: [string, string];
  team1Strength: number;
  team2Strength: number;
  diff: number;
}

export interface PairingLeftover {
  id: string;
  reason: string;
}

export interface PairingResult {
  suggestions: PairingSuggestion[];
  leftovers: PairingLeftover[];
  usedCount: number;
}

const CLASS_WEIGHT: Record<string, number> = { A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

const COMPATIBLE: Record<string, string[]> = {
  A: ["B", "C"],
  B: ["A", "C", "D"],
  C: ["A", "B", "D"],
  D: ["B", "C", "E", "F"],
  E: ["D", "F"],
  F: ["D", "E"],
};

function weight(cls: string): number {
  return CLASS_WEIGHT[cls] ?? 3;
}

export function isCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return (COMPATIBLE[a] || []).includes(b) || (COMPATIBLE[b] || []).includes(a);
}

function order(p: PairingRecord): number {
  return p.matchCount * 1000 + (p.arrival ?? 0);
}

function findOpponentPair(records: PairingRecord[], used: Set<string>, targetStrength: number): [string, string] | null {
  const arr = records.filter((p) => !used.has(p.id));
  let best: [string, string] | null = null;
  let bestScore = Infinity;
  for (let a = 0; a < arr.length; a++) {
    for (let b = a + 1; b < arr.length; b++) {
      const x = arr[a];
      const y = arr[b];
      if (!isCompatible(x.className, y.className)) continue;
      const str = weight(x.className) + weight(y.className);
      const diff = Math.abs(targetStrength - str);
      const sameTeam = x.className === y.className ? 1 : 0;
      const fair = Math.min(order(x), order(y));
      const score = sameTeam * 1000 + diff * 10 + fair;
      if (score < bestScore) {
        bestScore = score;
        best = [x.id, y.id];
      }
    }
  }
  return best;
}

export function buildPairingSuggestions(records: PairingRecord[]): PairingResult {
  const pool = records.slice().sort((a, b) => order(a) - order(b));
  const used = new Set<string>();
  const suggestions: PairingSuggestion[] = [];
  const leftovers: PairingLeftover[] = [];

  while (true) {
    const remaining = pool.filter((p) => !used.has(p.id));
    if (remaining.length < 4) break;

    let madeSuggestion = false;
    for (const seed of remaining) {
      const partners = remaining
        .filter((p) => p.id !== seed.id && !used.has(p.id) && isCompatible(seed.className, p.className))
        .sort((a, b) => {
          const sameA = seed.className === a.className ? 1 : 0;
          const sameB = seed.className === b.className ? 1 : 0;
          if (sameA !== sameB) return sameA - sameB;
          const da = Math.abs(weight(seed.className) - weight(a.className));
          const db = Math.abs(weight(seed.className) - weight(b.className));
          if (da !== db) return da - db;
          return order(a) - order(b);
        });

      for (const partner of partners) {
        const strength = weight(seed.className) + weight(partner.className);
        const teamUsed = new Set(used);
        teamUsed.add(seed.id);
        teamUsed.add(partner.id);
        const oppIds = findOpponentPair(remaining, teamUsed, strength);
        if (oppIds) {
          const opp = [pool.find((p) => p.id === oppIds[0])!, pool.find((p) => p.id === oppIds[1])!];
          const oppStrength = weight(opp[0].className) + weight(opp[1].className);
          suggestions.push({
            team1: [seed.id, partner.id],
            team2: oppIds,
            team1Strength: strength,
            team2Strength: oppStrength,
            diff: Math.abs(strength - oppStrength),
          });
          used.add(seed.id);
          used.add(partner.id);
          used.add(oppIds[0]);
          used.add(oppIds[1]);
          madeSuggestion = true;
          break;
        }
      }
      if (madeSuggestion) break;
    }

    if (!madeSuggestion) {
      for (const p of remaining) {
        if (!used.has(p.id)) leftovers.push({ id: p.id, reason: "Tidak ada pasangan yang cocok" });
      }
      break;
    }
  }

  for (const p of pool) {
    if (!used.has(p.id) && !leftovers.some((l) => l.id === p.id)) {
      leftovers.push({ id: p.id, reason: "Cadangan (kurang 4 orang)" });
    }
  }

  return { suggestions, leftovers, usedCount: used.size };
}