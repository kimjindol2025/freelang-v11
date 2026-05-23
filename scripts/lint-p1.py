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
        ('BACKTICK', r'`[^`]*`'),  # 백틱 문자열 (단일 토큰으로 취급)
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
        """http-* 응답 직접 (get) 사용 감지: http-xxx → ... → (get) 패턴"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token in ('http-get', 'http-post', 'http-patch', 'http-delete'):
                http_name = token
                http_line = line

                # http-xxx 호출 후 범위 내 (get 사용 여부 확인
                j = i + 1
                paren_depth = 0
                http_call_end = i
                found_get = False
                found_json_parse = False
                get_line = 0

                # 1. http-xxx 호출의 끝 찾기
                while j < len(self.tokens) and j < i + 100:
                    if self.tokens[j][0] == '(':
                        paren_depth += 1
                    elif self.tokens[j][0] == ')':
                        paren_depth -= 1
                        if paren_depth < 0:
                            http_call_end = j
                            break
                    j += 1

                # 2. http-xxx 이후 다음 let/코드 블록 스캔
                k = http_call_end + 1
                depth = 0
                context_end = min(i + 300, len(self.tokens))  # 최대 300 토큰 스캔

                while k < context_end:
                    t = self.tokens[k][0]
                    tk = self.tokens[k][1]

                    if t == '(':
                        depth += 1
                    elif t == ')':
                        depth -= 1
                        if depth < 0:
                            break

                    # (json-parse ...) 패턴
                    if tk == 'SYMBOL' and t == 'json-parse':
                        found_json_parse = True
                        break  # json-parse 있으면 OK

                    # (get ... ) 패턴 - http 응답 변수 참조
                    if (tk == 'SYMBOL' and t == 'get' and k + 1 < len(self.tokens)):
                        # get 다음이 $로 시작하는 변수면 경고 (http 응답 변수로 추정)
                        next_token = self.tokens[k + 1][0]
                        if next_token.startswith('$'):
                            found_get = True
                            get_line = self.tokens[k][2]
                            break

                    k += 1

                # ❌ get은 있는데 json-parse는 없으면 경고
                if found_get and not found_json_parse:
                    col = self.lines[get_line - 1].find('get') + 1 if get_line <= len(self.lines) else 1
                    self.violations.append(Violation(
                        'P1-2', self.filepath, get_line, col,
                        f'{http_name} 응답을 파싱 없이 (get)로 접근',
                        f'(let [[$data (json-parse $resp)]] (get $data "key")) 또는 (http-get-json url)',
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
        """(str ...) 인자 5개 이상이면 백틱 사용 권장 (단, 백틱 자체는 제외)"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'str':
                # (str ...) 패턴: str 다음부터 괄호까지 인자 세기
                j = i + 1
                arg_count = 0
                paren_depth = 0
                has_backtick = False

                while j < len(self.tokens):
                    t = self.tokens[j][0]
                    tk = self.tokens[j][1]

                    if t == '(':
                        paren_depth += 1
                    elif t == ')':
                        paren_depth -= 1
                        if paren_depth < 0:  # str ( ... ) 종료
                            break
                    elif paren_depth == 0:
                        if tk == 'BACKTICK':
                            has_backtick = True
                        elif tk in ('STRING', 'SYMBOL'):
                            # str 인자: 문자열 또는 심볼
                            arg_count += 1

                    j += 1

                # 백틱 사용하지 않고 5개 이상이면 경고
                if arg_count > 4 and not has_backtick:
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
        # (let [[$var (db-get ...)]] ... (get $var ...) 패턴 검사
        i = 0
        while i < len(self.tokens):
            # let [ 패턴 찾기
            if (self.tokens[i][1] == 'SYMBOL' and self.tokens[i][0] == 'let' and
                i + 1 < len(self.tokens) and self.tokens[i + 1][0] == '['):

                # 바인딩 변수 추출: let [[$var ...] 또는 let [$var ...]
                j = i + 2
                if j < len(self.tokens) and self.tokens[j][0] == '[':
                    j += 1  # let [[ 형태

                # j는 이제 변수 위치 ($user 또는 다른 심볼)
                if j < len(self.tokens) and self.tokens[j][0].startswith('$'):
                    bound_var = self.tokens[j][0]

                    # j+1 이후에서 (db-get/db-post) 찾기 (json-parse는 제외 — 문자열 직렬화)
                    dangerous_fn = None
                    k = j + 1
                    paren_depth = 0

                    while k < len(self.tokens) and k < j + 60:
                        if self.tokens[k][0] == '(':
                            paren_depth += 1
                            if paren_depth == 1 and k + 1 < len(self.tokens):
                                if self.tokens[k + 1][0] in ['db-get', 'db-post']:
                                    dangerous_fn = self.tokens[k + 1][0]
                                    break
                        elif self.tokens[k][0] == ')':
                            paren_depth -= 1
                            if paren_depth < 0:
                                break
                        k += 1

                    # dangerous_fn이 있으면 forward search로 nil 체크 후 get 패턴 확인
                    if dangerous_fn:
                        m = j
                        nil_check_found = False
                        direct_get_found = False
                        get_line = 0
                        depth = 0

                        while m < len(self.tokens) and m < j + 200:
                            tok = self.tokens[m][0]

                            if tok == '(':
                                depth += 1
                            elif tok == ')':
                                depth -= 1
                                if depth < 0:  # let 블록 완료
                                    break

                            # nil 체크 먼저 감지
                            if self.tokens[m][1] == 'SYMBOL':
                                if (tok in ['if', 'or'] and m + 1 < len(self.tokens) and
                                    self.tokens[m + 1][0] == bound_var):
                                    nil_check_found = True

                                if (tok == 'safe-get' and m + 1 < len(self.tokens) and
                                    self.tokens[m + 1][0] == bound_var):
                                    nil_check_found = True

                                # (get $var) 감지
                                if (tok == 'get' and m + 1 < len(self.tokens) and
                                    self.tokens[m + 1][0] == bound_var and not nil_check_found):
                                    direct_get_found = True
                                    get_line = self.tokens[m][2]
                                    break

                            m += 1

                        # 위반: 직접 get이 있고 nil 체크가 없음
                        if direct_get_found:
                            col = self.lines[get_line - 1].find('get') + 1 if get_line <= len(self.lines) else 1
                            self.violations.append(Violation(
                                'P1-5', self.filepath, get_line, col,
                                f'{dangerous_fn} 결과 {bound_var}: nil 체크 없이 (get) 접근',
                                f'(if {bound_var} (get {bound_var} ...) nil)',
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
