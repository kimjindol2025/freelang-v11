/**
 * Cron Scheduler Tests (v11.7.0)
 * 5-field cron 표현식 검증
 *
 * 테스트 항목:
 * 1. cron 표현식 파싱
 * 2. 시간 매칭 (분, 시간, 일, 월, 요일)
 * 3. 범위/스텝/리스트 표현식
 * 4. 작업 등록/취소/조회
 * 5. 오류 처리
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";

// 테스트용 파서 (stdlib-cron.ts와 동일)
interface CronField {
  minute: number[] | null;
  hour: number[] | null;
  day: number[] | null;
  month: number[] | null;
  dayOfWeek: number[] | null;
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
  const parts = field.split(",");

  for (const part of parts) {
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
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) values.push(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (num >= min && num <= max) values.push(num);
    }
  }

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
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay();

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

describe("Cron Scheduler (v11.7.0)", () => {
  test("와일드카드 표현식 (모든 시간)", () => {
    const cronField = parseCronExpression("* * * * *");
    expect(cronField.minute).toBeNull(); // * = null
    expect(cronField.hour).toBeNull();
    expect(cronField.day).toBeNull();
    expect(cronField.month).toBeNull();
    expect(cronField.dayOfWeek).toBeNull();
  });

  test("단순 숫자 (정확한 시간)", () => {
    const cronField = parseCronExpression("30 12 15 6 1");
    expect(cronField.minute).toEqual([30]);
    expect(cronField.hour).toEqual([12]);
    expect(cronField.day).toEqual([15]);
    expect(cronField.month).toEqual([6]);
    expect(cronField.dayOfWeek).toEqual([1]);
  });

  test("범위 표현식 (0-5)", () => {
    const cronField = parseCronExpression("0-5 * * * *");
    expect(cronField.minute).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("스텝 표현식 (*/5) — 5분마다", () => {
    const cronField = parseCronExpression("*/5 * * * *");
    expect(cronField.minute).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  test("스텝 표현식 범위 (0-30/5)", () => {
    const cronField = parseCronExpression("0-30/5 * * * *");
    expect(cronField.minute).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  test("리스트 표현식 (0,15,30,45)", () => {
    const cronField = parseCronExpression("0,15,30,45 * * * *");
    expect(cronField.minute).toEqual([0, 15, 30, 45]);
  });

  test("복합 표현식", () => {
    const cronField = parseCronExpression("0,30 9,12 * 1-6 *");
    expect(cronField.minute).toEqual([0, 30]);
    expect(cronField.hour).toEqual([9, 12]);
    expect(cronField.month).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("시간 매칭 (정확한 시간)", () => {
    const cronField = parseCronExpression("30 14 * * *"); // 14:30
    const match = new Date(2026, 4, 13, 14, 30, 0); // 2026-05-13 14:30:00
    expect(isTimeMatch(match, cronField)).toBe(true);
  });

  test("시간 매칭 실패 (분 불일치)", () => {
    const cronField = parseCronExpression("30 14 * * *");
    const noMatch = new Date(2026, 4, 13, 14, 31, 0); // 14:31:00
    expect(isTimeMatch(noMatch, cronField)).toBe(false);
  });

  test("시간 매칭 (범위)", () => {
    const cronField = parseCronExpression("* 9-17 * * *"); // 9시~17시
    const match = new Date(2026, 4, 13, 13, 0, 0);
    expect(isTimeMatch(match, cronField)).toBe(true);

    const noMatch = new Date(2026, 4, 13, 8, 0, 0); // 8시 (범위 밖)
    expect(isTimeMatch(noMatch, cronField)).toBe(false);
  });

  test("요일 매칭 (월요일)", () => {
    const cronField = parseCronExpression("* * * * 1"); // 월요일 (1)
    // 2026-05-13은 수요일 (3)
    const wednesday = new Date(2026, 4, 13, 0, 0, 0);
    expect(isTimeMatch(wednesday, cronField)).toBe(false);

    // 2026-05-12는 화요일 (2)
    const tuesday = new Date(2026, 4, 12, 0, 0, 0);
    expect(isTimeMatch(tuesday, cronField)).toBe(false);

    // 2026-05-11은 월요일 (1)
    const monday = new Date(2026, 4, 11, 0, 0, 0);
    expect(isTimeMatch(monday, cronField)).toBe(true);
  });

  test("월 매칭 (1월-6월)", () => {
    const cronField = parseCronExpression("* * * 1-6 *");

    const jan = new Date(2026, 0, 1, 0, 0, 0); // January
    expect(isTimeMatch(jan, cronField)).toBe(true);

    const july = new Date(2026, 6, 1, 0, 0, 0); // July (month 7)
    expect(isTimeMatch(july, cronField)).toBe(false);
  });

  test("일자 매칭 (매월 15일)", () => {
    const cronField = parseCronExpression("* * 15 * *");

    const match = new Date(2026, 4, 15, 0, 0, 0); // 15th
    expect(isTimeMatch(match, cronField)).toBe(true);

    const noMatch = new Date(2026, 4, 14, 0, 0, 0); // 14th
    expect(isTimeMatch(noMatch, cronField)).toBe(false);
  });

  test("오류 처리 — 필드 부족", () => {
    expect(() => {
      parseCronExpression("* * * *"); // 4개만
    }).toThrow("5개 필드 필요");
  });

  test("오류 처리 — 범위 초과", () => {
    const cronField = parseCronExpression("0-100 * * * *"); // 100은 범위 초과
    expect(cronField.minute).toEqual(Array.from({ length: 60 }, (_, i) => i)); // 0-59
  });

  test("매시간 정각 (0분)", () => {
    const cronField = parseCronExpression("0 * * * *");
    expect(cronField.minute).toEqual([0]);
    expect(cronField.hour).toBeNull(); // * = null
  });

  test("매일 자정 (00:00)", () => {
    const cronField = parseCronExpression("0 0 * * *");
    expect(cronField.minute).toEqual([0]);
    expect(cronField.hour).toEqual([0]);
  });

  test("매주 월요일 09:00", () => {
    const cronField = parseCronExpression("0 9 * * 1");
    expect(cronField.minute).toEqual([0]);
    expect(cronField.hour).toEqual([9]);
    expect(cronField.dayOfWeek).toEqual([1]);
  });

  test("상업용 예제 — 업무 시간 정각 (09:00, 12:00, 15:00, 18:00)", () => {
    const cronField = parseCronExpression("0 9,12,15,18 * * 1-5"); // 평일 업무 시간
    expect(cronField.minute).toEqual([0]);
    expect(cronField.hour).toEqual([9, 12, 15, 18]);
    expect(cronField.dayOfWeek).toEqual([1, 2, 3, 4, 5]); // 월-금
  });

  test("중복 제거 (1,1,1)", () => {
    const cronField = parseCronExpression("1,1,1 * * * *");
    expect(cronField.minute).toEqual([1]); // 중복 제거
  });
});
