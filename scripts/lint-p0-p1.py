#!/usr/bin/env python3
"""
FreeLang v11 P0 + P1 Linter — 11가지 필수 + 권장 코딩규칙 통합 검증

P0 Rules (필수, 5개):
  P0-1: $ 파라미터
  P0-2: try-catch 검증
  P0-3: Bearer 토큰 보안
  P0-4: let 바인딩
  P0-5: json-stringify

P1 Rules (권장, 6개):
  P1-1: DB 절대경로
  P1-2: HTTP 응답 json-parse
  P1-3: 라우트 params 구조
  P1-4: 문자열 보간
  P1-5: 타입 안전성 (nil 체크)
  P1-6: 에러 처리 패턴
"""

import sys
import subprocess
from pathlib import Path
from typing import List

def run_linter(script: str, filepath: str) -> List[str]:
    """lint-p0.py 또는 lint-p1.py 실행"""
    try:
        result = subprocess.run(
            ['python3', script, filepath],
            capture_output=True,
            text=True,
            timeout=10
        )
        # stderr 무시, stdout 리턴 (lint 결과는 stdout)
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except Exception as e:
        return [f"❌ {script} 실행 오류: {e}"]

def main():
    if len(sys.argv) < 2:
        print("Usage: lint-p0-p1.py <file.fl> [--verbose]")
        sys.exit(1)

    filepath = sys.argv[1]
    verbose = '--verbose' in sys.argv

    if not Path(filepath).exists():
        print(f"❌ 파일 없음: {filepath}")
        sys.exit(1)

    # lint-p0, lint-p1 실행
    script_dir = Path(__file__).parent
    p0_script = script_dir / 'lint-p0.py'
    p1_script = script_dir / 'lint-p1.py'

    p0_violations = run_linter(str(p0_script), filepath)
    p1_violations = run_linter(str(p1_script), filepath)

    # 결과 통합
    all_violations = [v for v in p0_violations if v.strip()]
    all_violations += [v for v in p1_violations if v.strip()]
    all_violations = [v for v in all_violations if not v.startswith('✅')]

    if all_violations:
        for v in all_violations:
            print(v)
        sys.exit(1)
    else:
        if verbose:
            print(f"✅ {filepath} (P0+P1 규칙 11/11 준수)")
        sys.exit(0)

if __name__ == '__main__':
    main()
