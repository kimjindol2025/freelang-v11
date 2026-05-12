/**
 * Cron Scheduler (v11.7.0)
 * 5-field cron 표현식 지원
 * minute hour day month day-of-week
 */

interface CronJob {
  id: string;
  expression: string;
  callback: () => any;
  createdAt: Date;
}

interface CronField {
  minute: number[] | null;
  hour: number[] | null;
  day: number[] | null;
  month: number[] | null;
  dayOfWeek: number[] | null;
}

const cronJobs = new Map<string, CronJob>();
let lastCheckTime = 0;
let checkInterval: NodeJS.Timeout | null = null;

function generateJobId(): string {
  return "cron-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

function parseField(
  field: string,
  min: number,
  max: number
): number[] | null {
  if (field === "*") {
    return null; // * = 모든 값 (null로 표현)
  }

  const values: number[] = [];

  // 쉼표로 구분된 항목 처리 (0,15,30,45)
  const parts = field.split(",");

  for (const part of parts) {
    // 스텝 처리 (*/5, 0-30/5)
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);

      if (range === "*") {
        for (let i = min; i <= max; i += step) {
          values.push(i);
        }
      } else if (range.includes("-")) {
        const [startStr, endStr] = range.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let i = start; i <= end; i += step) {
          if (i >= min && i <= max) values.push(i);
        }
      } else {
        const num = parseInt(range, 10);
        for (let i = num; i <= max; i += step) {
          if (i >= min && i <= max) values.push(i);
        }
      }
    } else if (part.includes("-")) {
      // 범위 처리 (0-5)
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) values.push(i);
      }
    } else {
      // 단순 숫자
      const num = parseInt(part, 10);
      if (num >= min && num <= max) values.push(num);
    }
  }

  // 중복 제거 및 정렬
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseCronExpression(expression: string): CronField {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `Cron 표현식 오류: 5개 필드 필요 (받은 값: ${fields.length}개)`
    );
  }

  const [minuteField, hourField, dayField, monthField, dayOfWeekField] = fields;

  return {
    minute: parseField(minuteField, 0, 59),
    hour: parseField(hourField, 0, 23),
    day: parseField(dayField, 1, 31),
    month: parseField(monthField, 1, 12),
    dayOfWeek: parseField(dayOfWeekField, 0, 6),
  };
}

function isTimeMatch(now: Date, cronField: CronField): boolean {
  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1; // 0-11 → 1-12
  const dayOfWeek = now.getDay(); // 0-6 (0=Sunday)

  // null = 모든 값과 일치
  const minuteMatch = cronField.minute === null || cronField.minute.includes(minute);
  const hourMatch = cronField.hour === null || cronField.hour.includes(hour);
  const monthMatch = cronField.month === null || cronField.month.includes(month);

  // day와 dayOfWeek는 cron 표준: 둘 다 제약되면 OR, 하나만 제약되면 해당값만
  let dayMatch = true;
  const dayConstrained = cronField.day !== null;
  const dayOfWeekConstrained = cronField.dayOfWeek !== null;

  if (dayConstrained && dayOfWeekConstrained) {
    // 둘 다 지정 → 하나라도 일치하면 true
    dayMatch =
      cronField.day!.includes(day) || cronField.dayOfWeek!.includes(dayOfWeek);
  } else if (dayConstrained) {
    // day만 지정
    dayMatch = cronField.day!.includes(day);
  } else if (dayOfWeekConstrained) {
    // dayOfWeek만 지정
    dayMatch = cronField.dayOfWeek!.includes(dayOfWeek);
  }
  // 둘 다 미지정 (둘 다 *) → dayMatch = true

  return minuteMatch && hourMatch && monthMatch && dayMatch;
}

function startScheduler() {
  if (checkInterval !== null) return;

  checkInterval = setInterval(() => {
    const now = Date.now();
    // 최소 60초(60000ms)마다만 체크 (분 단위이므로)
    if (now - lastCheckTime < 60000) return;

    lastCheckTime = now;
    const currentTime = new Date();

    for (const job of cronJobs.values()) {
      try {
        const cronField = parseCronExpression(job.expression);
        if (isTimeMatch(currentTime, cronField)) {
          // 비동기 실행 (에러 무시)
          Promise.resolve()
            .then(() => job.callback())
            .catch(() => {});
        }
      } catch (e) {
        // 파싱 에러는 무시
      }
    }
  }, 60000); // 1분마다 체크
}

function stopScheduler() {
  if (checkInterval !== null && cronJobs.size === 0) {
    clearInterval(checkInterval);
    checkInterval = null;
    lastCheckTime = 0;
  }
}

export function cron_schedule(expression: string, callback: any): string {
  // 표현식 검증 (파싱)
  parseCronExpression(expression);

  // 콜백 함수 확인
  if (typeof callback !== "function" && !callback?.__fl_function) {
    throw new Error(`Cron 오류: 콜백은 함수여야 합니다`);
  }

  const jobId = generateJobId();
  cronJobs.set(jobId, {
    id: jobId,
    expression,
    callback,
    createdAt: new Date(),
  });

  // 스케줄러 시작
  startScheduler();

  return jobId;
}

export function cron_cancel(jobId: string): boolean {
  const deleted = cronJobs.delete(jobId);
  stopScheduler();
  return deleted;
}

export function cron_list(): Array<{
  id: string;
  expression: string;
  created_at: string;
}> {
  return Array.from(cronJobs.values()).map((job) => ({
    id: job.id,
    expression: job.expression,
    created_at: job.createdAt.toISOString(),
  }));
}

export function cron_clear(): number {
  const count = cronJobs.size;
  cronJobs.clear();
  stopScheduler();
  return count;
}
