#!/usr/bin/env python3
"""
check-parens.py — FreeLang .fl 파일 괄호/브래킷 균형 검증기

사용법:
  python3 scripts/check-parens.py app/server.fl
  python3 scripts/check-parens.py app/*.fl
  python3 scripts/check-parens.py app/server.fl --verbose
"""

import sys
import argparse


def check_file(path: str, verbose: bool = False) -> bool:
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ {path}: 파일 없음")
        return False

    # 열린 브래킷 스택 추적 (paren + bracket)
    stack = []         # (char, line, col)
    paren_depth = 0
    bracket_depth = 0
    line = 1
    col = 0
    in_string = False
    in_comment = False

    for i, ch in enumerate(content):
        col += 1
        if ch == '\n':
            line += 1
            col = 0
            in_comment = False
            continue

        if in_comment:
            continue

        if ch == ';' and not in_string:
            in_comment = True
            continue

        if ch == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if ch == '(':
            paren_depth += 1
            stack.append(('(', line, col))
        elif ch == ')':
            paren_depth -= 1
            if paren_depth < 0:
                print(f"❌ {path}:{line}:{col} — ')' 가 열린 '(' 없이 등장")
                if verbose and stack:
                    print("   마지막 열린 괄호 스택:")
                    for c, l, co in stack[-5:]:
                        print(f"     '{c}' at line {l}:{co}")
                return False
            if stack and stack[-1][0] == '(':
                stack.pop()
        elif ch == '[':
            bracket_depth += 1
            stack.append(('[', line, col))
        elif ch == ']':
            bracket_depth -= 1
            if bracket_depth < 0:
                print(f"❌ {path}:{line}:{col} — ']' 가 열린 '[' 없이 등장")
                return False
            if stack and stack[-1][0] == '[':
                stack.pop()

    ok = True
    if paren_depth != 0:
        print(f"❌ {path}: 괄호 불균형 (미닫힘 '(' = {paren_depth}개)")
        ok = False
    if bracket_depth != 0:
        print(f"❌ {path}: 브래킷 불균형 (미닫힘 '[' = {bracket_depth}개)")
        ok = False

    if not ok and verbose and stack:
        print(f"   미닫힘 스택 (최대 10개):")
        for c, l, co in stack[-10:]:
            print(f"     '{c}' at {path}:{l}:{co}")

    if ok:
        lines = content.count('\n') + 1
        print(f"✅ {path} ({lines}줄, depth=0)")

    return ok


def main():
    parser = argparse.ArgumentParser(description="FreeLang .fl 파일 괄호 검증기")
    parser.add_argument("files", nargs="+", help=".fl 파일 경로")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="미닫힘 스택 상세 출력")
    args = parser.parse_args()

    results = [check_file(f, args.verbose) for f in args.files]
    passed = sum(results)
    total = len(results)

    if total > 1:
        print(f"\n결과: {passed}/{total} 통과")

    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
