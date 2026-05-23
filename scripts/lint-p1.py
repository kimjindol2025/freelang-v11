#!/usr/bin/env python3
"""
FreeLang v11 P1 Linter — 6가지 필수 코딩규칙 검증

Rules:
  P1-1: DB 절대경로 (db-query/db-get/db-post)
  P1-2: HTTP 응답 json-parse (http-get/post/patch/delete)
  P1-3: 라우트 params 구조 (req.fl 헬퍼 권장)
  P1-4: 문자열 보간 최적화 (str 인자 4개 이상)
  P1-5: 타입 안전성 (nil 체크, safe-get)
  P1-6: 에러 처리 패턴 (try-catch 또는 assert)
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Set

# ============================================================
# Violation Record (P0과 동일)
# ============================================================

class Violation:
    def __init__(self, rule: str, file: str, line: int, col: int,
                 message: str, suggestion: str = "", severity: str = "error"):
        self.rule = rule
        self.file = file
        self.line = line
        self.col = col
        self.message = message
        self.suggestion = suggestion
        self.severity = severity  # "error" or "warning"

    def __str__(self):
        symbol = "❌" if self.severity == "error" else "⚠️"
        result = f"{symbol} {self.rule} [{self.file}:{self.line}:{self.col}] {self.message}"
        if self.suggestion:
            result += f"\n   제안: {self.suggestion}"
        return result

# ============================================================
# Tokenizer (P0에서 재사용)
# ============================================================

def tokenize(code: str) -> List[Tuple[str, str, int]]:
    """토큰화: (token, type, line_number)"""
    tokens = []
    line = 1

    code = re.sub(r';;.*?$', '', code, flags=re.MULTILINE)

    token_spec = [
        ('LPAREN',   r'\('),
        ('RPAREN',   r'\)'),
        ('LBRACKET', r'\['),
        ('RBRACKET', r'\]'),
        ('LBRACE',   r'\{'),
        ('RBRACE',   r'\}'),
        ('STRING',   r'"(?:\\.|[^"])*"'),
        ('KEYWORD',  r':[a-zA-Z0-9_-]+'),
        ('SYMBOL',   r'[a-zA-Z_$][a-zA-Z0-9_?!*-]*'),
        ('NUMBER',   r'-?\d+(\.\d+)?'),
        ('WHITESPACE', r'\s+'),
    ]

    token_re = '|'.join(f'(?P<{name}>{pattern})' for name, pattern in token_spec)

    for match in re.finditer(token_re, code):
        kind = match.lastgroup
        value = match.group()

        if kind == 'WHITESPACE':
            line += value.count('\n')
        else:
            tokens.append((value, kind, line))

    return tokens

# ============================================================
# P1 Rules
# ============================================================

class P1Linter:
    def __init__(self, filepath: str):
        self.filepath = filepath
        with open(filepath, 'r', encoding='utf-8') as f:
            self.code = f.read()
        self.tokens = tokenize(self.code)
        self.lines = self.code.split('\n')
        self.violations = []

    def lint(self) -> List[Violation]:
        """모든 P1 규칙 검증"""
        self._check_p1_1_db_path()
        self._check_p1_2_http_json()
        self._check_p1_3_route_params()
        self._check_p1_4_string_interp()
        self._check_p1_6_error_handling()
        self._check_p1_5_type_safety()
        return sorted(self.violations, key=lambda v: (v.line, v.col))

    # ============ P1-1: DB 절대경로 ============
    def _check_p1_1_db_path(self):
        """db-query/db-get/db-post 절대경로 확인"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token in ('db-query', 'db-get', 'db-post'):
                # db-xxx "path" ... 패턴
                if i + 1 < len(self.tokens):
                    next_token, next_kind, next_line = self.tokens[i + 1]

                    if next_kind == 'STRING':
                        # 문자열 리터럴인 경우 경로 확인
                        path = next_token.strip('"')

                        # ❌ 상대경로 감지
                        if not path.startswith('/') and not path.startswith('$'):
                            col = self.lines[next_line - 1].find(next_token) + 1 if next_line <= len(self.lines) else 1
                            self.violations.append(Violation(
                                'P1-1', self.filepath, next_line, col,
                                f'{token} 상대경로 사용: "{path}"',
                                f'{token} "/home/..." 절대경로 사용',
                                severity="error"
                            ))

            i += 1

    # ============ P1-2: HTTP 응답 json-parse ============
    def _check_p1_2_http_json(self):
        """http-* → let 바인딩 → (get) 사용 패턴에서 json-parse 확인"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token in ('http-get', 'http-post', 'http-patch', 'http-delete'):
                http_name = token
                http_line = line

                # (let [$var (http-xxx ...)] ...) 패턴 찾기
                # i는 http-xxx의 위치
                # 역추적으로 let과 바인딩 변수 찾기

                found_var = None
                j = i - 1
                while j >= 0 and j > i - 50:
                    if self.tokens[j][0] == '[':
                        # 이전 토큰이 심볼인지 확인 (변수명)
                        if j - 1 >= 0 and self.tokens[j - 1][1] == 'SYMBOL' and self.tokens[j - 1][0].startswith('$'):
                            found_var = self.tokens[j - 1][0]
                            break
                    j -= 1

                if not found_var:
                    i += 1
                    continue

                # http-xxx 다음부터 끝까지 스캔하여:
                # 1. json-parse found_var 있으면 OK
                # 2. (get found_var) 있으면 ❌
                k = i + 1
                has_json_parse = False
                get_without_parse = False
                get_line = 0

                depth = 0
                while k < len(self.tokens) and k < i + 200:
                    if self.tokens[k][0] == '(':
                        depth += 1
                    elif self.tokens[k][0] == ')':
                        depth -= 1
                        if depth < 0:
                            break

                    # (json-parse found_var) 확인
                    if (self.tokens[k][1] == 'SYMBOL' and self.tokens[k][0] == 'json-parse' and
                        k + 1 < len(self.tokens) and found_var in self.tokens[k + 1][0]):
                        has_json_parse = True

                    # (get found_var) 확인
                    if (self.tokens[k][1] == 'SYMBOL' and self.tokens[k][0] == 'get' and
                        k + 1 < len(self.tokens) and self.tokens[k + 1][0] == found_var and
                        not has_json_parse):
                        get_without_parse = True
                        get_line = self.tokens[k][2]

                    k += 1

                if get_without_parse and not has_json_parse:
                    col = self.lines[get_line - 1].find('get') + 1 if get_line <= len(self.lines) else 1
                    self.violations.append(Violation(
                        'P1-2', self.filepath, get_line, col,
                        f'{http_name} 응답 파싱 없음: (get {found_var} ...) 사용',
                        f'(let [[$data (json-parse {found_var})]] (get $data ...))',
                        severity="error"
                    ))

            i += 1

    # ============ P1-3: 라우트 params 구조 ============
    def _check_p1_3_route_params(self):
        """(get (get $req "params") ...) 중첩 get 감지"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'get':
                # (get (get $req "params") "key") 패턴
                if i + 1 < len(self.tokens) and self.tokens[i + 1][0] == '(':
                    # 중첩 (get) 확인
                    j = i + 2
                    if (j < len(self.tokens) and self.tokens[j][1] == 'SYMBOL' and
                        self.tokens[j][0] == 'get'):
                        # 내부 get 확인
                        inner_get_line = self.tokens[j][2]

                        # (get $req "params") 패턴 확인
                        if (j + 1 < len(self.tokens) and self.tokens[j + 1][0].startswith('$') and
                            j + 3 < len(self.tokens) and 'params' in self.tokens[j + 2][0]):
                            # ❌ 중첩 get 감지
                            col = self.lines[line - 1].find('get') + 1 if line <= len(self.lines) else 1
                            self.violations.append(Violation(
                                'P1-3', self.filepath, line, col,
                                f'라우트 params 중첩 get: (get (get $req "params") ...)',
                                '(req-param $req "key") 또는 (let [{:key $key} (get $req "params")] ...)',
                                severity="warning"
                            ))

            i += 1

    # ============ P1-4: 문자열 보간 최적화 ============
    def _check_p1_4_string_interp(self):
        """(str ...) 인자 4개 이상 감지"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'str':
                # (str ...) 패턴: str 다음부터 괄호까지 인자 세기
                j = i + 1
                arg_count = 0
                paren_depth = 0

                while j < len(self.tokens):
                    t = self.tokens[j][0]
                    tk = self.tokens[j][1]

                    if t == '(':
                        paren_depth += 1
                    elif t == ')':
                        paren_depth -= 1
                        if paren_depth < 0:  # str ( ... ) 종료
                            break
                    elif paren_depth == 0 and tk in ('STRING', 'SYMBOL'):
                        # str 인자: 문자열 또는 심볼
                        arg_count += 1

                    j += 1

                # 4개 이상이면 경고
                if arg_count >= 4:
                    col = self.lines[line - 1].find('str') + 1 if line <= len(self.lines) else 1
                    self.violations.append(Violation(
                        'P1-4', self.filepath, line, col,
                        f'(str) 인자 {arg_count}개: 보간 고려',
                        '(str `...${...}...`) 백틱 문자열 사용',
                        severity="warning"
                    ))

            i += 1

    # ============ P1-6: 에러 처리 패턴 ============
    def _check_p1_6_error_handling(self):
        """위험한 함수(http-*, db-*, json-parse)의 try-catch 확인"""
        dangerous_funcs = {
            'http-get', 'http-post', 'http-patch', 'http-delete',
            'db-query', 'db-get', 'db-post',
            'json-parse', 'file-read', 'file-write'
        }

        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token in dangerous_funcs:
                # 이 토큰이 try 블록 내에 있는지 확인
                in_try = False

                # 역추적으로 try 찾기
                j = i - 1
                depth = 0
                while j >= 0 and j > i - 200:  # 최대 200 토큰 역추적
                    if self.tokens[j][0] == ')':
                        depth += 1
                    elif self.tokens[j][0] == '(':
                        depth -= 1
                        if depth < 0 and j > 0 and self.tokens[j - 1][0] == 'try':
                            in_try = True
                            break
                    j -= 1

                # try 블록 밖이면 경고
                if not in_try:
                    col = self.lines[line - 1].find(token) + 1 if line <= len(self.lines) else 1
                    self.violations.append(Violation(
                        'P1-6', self.filepath, line, col,
                        f'{token}: try-catch 에러 처리 없음',
                        f'(try ({token} ...) (catch $e (do (println "ERROR:" $e) nil)))',
                        severity="error"
                    ))

            i += 1

    # ============ P1-5: 타입 안전성 ============
    def _check_p1_5_type_safety(self):
        """db-get/json-parse 후 직접 (get) 사용, nil 체크 없음"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            # db-get / json-parse 호출 추적
            if kind == 'SYMBOL' and token in ('db-get', 'json-parse'):
                # let 바인딩 확인
                bound_var = None
                if i > 0 and self.tokens[i - 2][0] == '[' and self.tokens[i - 1][1] == 'SYMBOL':
                    bound_var = self.tokens[i - 1][0]

                if bound_var:
                    # 이후 (get bound_var ...) 확인
                    j = i + 1
                    depth = 0
                    found_if = False
                    found_safe_get = False

                    while j < len(self.tokens) and j < i + 150:
                        if self.tokens[j][0] == '(':
                            depth += 1
                        elif self.tokens[j][0] == ')':
                            depth -= 1
                            if depth < 0:
                                break

                        # (if bound_var ...) 패턴
                        if (self.tokens[j][1] == 'SYMBOL' and self.tokens[j][0] == 'if' and
                            j + 1 < len(self.tokens) and self.tokens[j + 1][0] == bound_var):
                            found_if = True

                        # (safe-get bound_var ...) 또는 (or bound_var ...)
                        if ((self.tokens[j][1] == 'SYMBOL' and self.tokens[j][0] == 'safe-get') or
                            (self.tokens[j][1] == 'SYMBOL' and self.tokens[j][0] == 'or' and
                             j + 1 < len(self.tokens) and self.tokens[j + 1][0] == bound_var)):
                            found_safe_get = True

                        j += 1

                    # ⚠️ nil 체크 없이 사용
                    if not found_if and not found_safe_get:
                        col = self.lines[line - 1].find(token) + 1 if line <= len(self.lines) else 1
                        self.violations.append(Violation(
                            'P1-5', self.filepath, line, col,
                            f'{token} 결과 {bound_var}: nil 체크 없음',
                            f'(if {bound_var} (get {bound_var} ...) default) 또는 (safe-get {bound_var} ...)',
                            severity="warning"
                        ))

            i += 1

# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: lint-p1.py <file.fl> [--verbose]")
        sys.exit(1)

    filepath = sys.argv[1]
    verbose = '--verbose' in sys.argv

    if not Path(filepath).exists():
        print(f"❌ 파일 없음: {filepath}")
        sys.exit(1)

    linter = P1Linter(filepath)
    violations = linter.lint()

    if violations:
        for v in violations:
            print(v)
        sys.exit(1)
    else:
        if verbose:
            print(f"✅ {filepath} (P1 규칙 준수)")
        sys.exit(0)

if __name__ == '__main__':
    main()
