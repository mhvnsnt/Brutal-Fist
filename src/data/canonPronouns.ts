/**
 * Canon pronouns — mhvnsnt/Bannon books + canon/*.md.
 *
 * NEVER infer gender from a GLB, hair, clothes, voice, or generated portrait.
 * If a fighter is not in this table, use the name only (no he/she).
 *
 * Maime is male (he/him). Maime is Marquis Whitacre / Bannon's alter —
 * three facets of one man (canon/04_book4_core_unlocked.md).
 * Book 5: "Maime drew his machete. He looked at Iida."
 */
export type CanonPronouns = 'he/him' | 'she/her' | 'they/them';

export const CANON_PRONOUNS: Readonly<Record<string, CanonPronouns>> = {
  bannon: 'he/him',
  maime: 'he/him',
  cain_elias: 'he/him',
  finxsse: 'he/him',
  stick_up: 'he/him',
  cody: 'he/him',
  edwin_kennedy: 'he/him',
  stan_combs: 'he/him',
  pablo: 'he/him',
  master_sensei: 'he/him',
  jager: 'he/him',
  wreck_patterson: 'he/him',
  brutus: 'he/him',
  titan: 'he/him',
  tarzanian_devil: 'he/him',
  hall_nighter: 'he/him',
  aaron_ruben: 'he/him',
  el_toro_de_oro: 'he/him',
  triple_xxx: 'he/him',
  tyneshia: 'she/her',
};

export function pronounsForFighter(id: string): CanonPronouns | undefined {
  return CANON_PRONOUNS[id];
}

export function subjectPronoun(id: string, name: string): string {
  const p = CANON_PRONOUNS[id];
  if (p === 'he/him') return 'he';
  if (p === 'she/her') return 'she';
  if (p === 'they/them') return 'they';
  return name;
}
