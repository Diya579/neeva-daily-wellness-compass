// Aggregate-only analytics rules for the employer portal: no individual can be singled out.

/** Smallest group whose metrics may be shown to an organisation. */
export const MIN_COHORT_SIZE = 10;

export type Cohort = { name: string; size: number; stress: number; engagement: number };
export type SafeCohort = {
  name: string;
  size: number;
  suppressed: boolean;
  stress: number | null;
  engagement: number | null;
};

/** Hide metrics for any cohort smaller than MIN_COHORT_SIZE (k-anonymity). */
export function anonymizeCohorts(rows: Cohort[]): SafeCohort[] {
  return rows.map((r) =>
    r.size < MIN_COHORT_SIZE
      ? { name: r.name, size: r.size, suppressed: true, stress: null, engagement: null }
      : {
          name: r.name,
          size: r.size,
          suppressed: false,
          stress: r.stress,
          engagement: r.engagement,
        },
  );
}
