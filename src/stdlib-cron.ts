// FreeLang v11: cron expression parser + evaluator (Phase X3)
//
// 5-필드 cron: 분 시 일 월 요일 (0=일요일).
// 지원: '*', 'N', '*/N', 'N-M', 'N,M,P'.
// 미지원: '?', 'L', 'W', '#' (확장 syntax)
// 예: '*/5 * * * *', '0 3 * * 1-5', '0,15,30,45 9-17 * * *'

export function createCronModule() {
  return {
    // cron_validate expr -> bool
    "cron_validate": (expr: string): boolean => {
      try {
        parseCron(expr);
        return true;
      } catch { return false; }
    },

    // cron_match expr ts_ms -> bool  (해당 시각이 cron 식과 일치하는지)
    "cron_match": (expr: string, tsMs: number): boolean => {
      try {
        const fields = parseCron(expr);
        const d = new Date(tsMs);
        return fieldMatch(fields[0], d.getMinutes())
            && fieldMatch(fields[1], d.getHours())
            && fieldMatch(fields[2], d.getDate())
            && fieldMatch(fields[3], d.getMonth() + 1)
            && fieldMatch(fields[4], d.getDay());
      } catch { return false; }
    },

    // cron_next_match expr from_ms -> ms  (from 이후 다음 일치 시각, 최대 1년)
    "cron_next_match": (expr: string, fromMs: number): number => {
      const fields = parseCron(expr);
      let t = Math.floor(fromMs / 60000) * 60000 + 60000; // 다음 분 시작
      const limit = fromMs + 366 * 86400 * 1000;
      while (t < limit) {
        const d = new Date(t);
        if (fieldMatch(fields[0], d.getMinutes())
         && fieldMatch(fields[1], d.getHours())
         && fieldMatch(fields[2], d.getDate())
         && fieldMatch(fields[3], d.getMonth() + 1)
         && fieldMatch(fields[4], d.getDay())) {
          return t;
        }
        t += 60000;
      }
      return -1;
    },
  };
}

type CronField = { type: "any" } | { type: "values"; values: Set<number> };

function parseCron(expr: string): CronField[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron: need 5 fields, got ${parts.length}`);
  return [
    parseField(parts[0], 0, 59),    // minute
    parseField(parts[1], 0, 23),    // hour
    parseField(parts[2], 1, 31),    // day of month
    parseField(parts[3], 1, 12),    // month
    parseField(parts[4], 0, 6),     // day of week (0=Sun)
  ];
}

function parseField(s: string, min: number, max: number): CronField {
  if (s === "*") return { type: "any" };
  const values = new Set<number>();

  for (const part of s.split(",")) {
    // step: */N or N-M/N
    let stepBase = part;
    let step = 1;
    if (part.includes("/")) {
      const [base, stepStr] = part.split("/");
      stepBase = base;
      step = parseInt(stepStr, 10);
      if (!Number.isFinite(step) || step < 1) throw new Error(`cron: bad step ${part}`);
    }

    let rangeMin = min;
    let rangeMax = max;
    if (stepBase === "*") {
      // */step → min..max step
    } else if (stepBase.includes("-")) {
      const [a, b] = stepBase.split("-");
      rangeMin = parseInt(a, 10);
      rangeMax = parseInt(b, 10);
    } else {
      const v = parseInt(stepBase, 10);
      if (!Number.isFinite(v)) throw new Error(`cron: bad value ${stepBase}`);
      if (v < min || v > max) throw new Error(`cron: ${v} out of range [${min},${max}]`);
      values.add(v);
      continue;
    }

    if (rangeMin < min || rangeMax > max || rangeMin > rangeMax) {
      throw new Error(`cron: bad range ${rangeMin}-${rangeMax}`);
    }
    for (let v = rangeMin; v <= rangeMax; v += step) values.add(v);
  }

  return { type: "values", values };
}

function fieldMatch(f: CronField, v: number): boolean {
  if (f.type === "any") return true;
  return f.values.has(v);
}
