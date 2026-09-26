import type { EvalRow } from "@/services";

type Metrics = NonNullable<EvalRow["cleave"]>;

/** Counts over the diffs that have both a Cleave run and a B1 run. */
export function summarizeEval(rows: EvalRow[]) {
  const paired = rows.filter((r) => r.cleave && r.baseline);
  const count = (pick: (r: EvalRow) => Metrics | null, test: (m: Metrics) => boolean) =>
    paired.filter((r) => {
      const m = pick(r);
      return m ? test(m) : false;
    }).length;
  return {
    paired: paired.length,
    cleaveValid: count((r) => r.cleave, (m) => m.valid),
    baselineValid: count((r) => r.baseline, (m) => m.valid),
    cleaveClean: count((r) => r.cleave, (m) => m.foreignLines === 0),
    baselineClean: count((r) => r.baseline, (m) => m.foreignLines === 0),
  };
}
