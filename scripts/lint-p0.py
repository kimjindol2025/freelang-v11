#!/usr/bin/env python3
"""
FreeLang v11 P0 Linter — 5가지 필수 코딩규칙 검증

Rules:
  P0-1: $ 파라미터 강제 (defn/fn/let)
  P0-2: try-catch 정확한 문법 (catch varname)
  P0-3: Bearer 토큰 (http-get-bearer)
  P0-4: let 바인딩 각 줄 분리
  P0-5: json-stringify 객체 변환
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple

# ============================================================
# Violation Record
# ============================================================

class Violation:
    def __init__(self, rule: str, file: str, line: int, col: int,
                 message: str, suggestion: str = ""):
        self.rule = rule
        self.file = file
        self.line = line
        self.col = col
        self.message = message
        self.suggestion = suggestion

    def __str__(self):
        result = f"❌ {self.rule} [{self.file}:{self.line}:{self.col}] {self.message}"
        if self.suggestion:
            result += f"\n   제안: {self.suggestion}"
        return result

# ============================================================
# Tokenizer
# ============================================================

def tokenize(code: str) -> List[Tuple[str, str, int]]:
    """토큰화: (token, type, line_number)"""
    tokens = []
    line = 1

    # 주석 제거
    code = re.sub(r';;.*?$', '', code, flags=re.MULTILINE)

    # 토큰 정의
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
# P0 Rules
# ============================================================

class P0Linter:
    def __init__(self, filepath: str):
        self.filepath = filepath
        with open(filepath, 'r', encoding='utf-8') as f:
            self.code = f.read()
        self.tokens = tokenize(self.code)
        self.lines = self.code.split('\n')
        self.violations = []

    def lint(self) -> List[Violation]:
        """모든 규칙 검증"""
        self._check_p0_1_dollar_param()
        self._check_p0_2_try_catch()
        self._check_p0_3_bearer_token()
        self._check_p0_4_let_binding()
        self._check_p0_5_json_stringify()
        return sorted(self.violations, key=lambda v: (v.line, v.col))

    # ============ P0-1: $ 파라미터 강제 ============
    def _check_p0_1_dollar_param(self):
        """defn/fn/let 파라미터에 $ 필수 확인"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            # defn/fn/let 패턴 찾기
            if kind == 'SYMBOL' and token in ('defn', 'fn', 'let'):
                keyword = token
                i += 1

                # defn name [params]
                if keyword == 'defn' and i + 1 < len(self.tokens):
                    name_token = self.tokens[i]
                    i += 1
                    if i < len(self.tokens) and self.tokens[i][0] == '[':
                        self._check_param_vector(keyword, name_token[2], i)

                # fn [params]
                elif keyword == 'fn' and i < len(self.tokens) and self.tokens[i][0] == '[':
                    self._check_param_vector(keyword, line, i)

                # let [[bindings]]
                elif keyword == 'let' and i < len(self.tokens) and self.tokens[i][0] == '[':
                    self._check_let_bindings(line, i)

            i += 1

    def _check_param_vector(self, keyword: str, line: int, vec_idx: int):
        """파라미터 벡터 내 $ 체크"""
        if vec_idx >= len(self.tokens) or self.tokens[vec_idx][0] != '[':
            return

        i = vec_idx + 1
        while i < len(self.tokens) and self.tokens[i][0] != ']':
            token, kind, token_line = self.tokens[i]

            # 파라미터 심볼 ($ 없음)
            if kind == 'SYMBOL' and not token.startswith('$') and \
               token not in ('&optional', '&rest', '&key'):
                col = self.lines[token_line - 1].find(token) + 1 if token_line <= len(self.lines) else 1
                self.violations.append(Violation(
                    'P0-1', self.filepath, token_line, col,
                    f'{keyword} 파라미터에 $ 필요: {token}',
                    f'{keyword} [${ token}]'
                ))

            i += 1

    def _check_let_bindings(self, line: int, vec_idx: int):
        """let 바인딩 벡터 검사"""
        if vec_idx >= len(self.tokens) or self.tokens[vec_idx][0] != '[':
            return

        i = vec_idx + 1
        while i < len(self.tokens) and self.tokens[i][0] != ']':
            token, kind, token_line = self.tokens[i]

            # let [[var val]] 또는 let [var val]
            # 각 바인딩을 검사
            if token == '[':
                i += 1
                if i < len(self.tokens):
                    bind_token, bind_kind, bind_line = self.tokens[i]
                    if bind_kind == 'SYMBOL' and not bind_token.startswith('$'):
                        col = self.lines[bind_line - 1].find(bind_token) + 1 if bind_line <= len(self.lines) else 1
                        self.violations.append(Violation(
                            'P0-1', self.filepath, bind_line, col,
                            f'let 바인딩에 $ 필요: {bind_token}',
                            f'[${bind_token} ...]'
                        ))

            i += 1

    # ============ P0-2: try-catch 문법 ============
    def _check_p0_2_try_catch(self):
        """try-catch 문법 검증"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'try':
                # try expr (catch ...)
                # 또는 try expr (fn [...] ...)
                # 다음 S-expr를 찾기 (2개)
                j = i + 1
                sexpr_count = 0

                while j < len(self.tokens) and sexpr_count < 2:
                    if self.tokens[j][0] == '(':
                        if sexpr_count == 1:  # 2번째 S-expr 시작
                            j += 1
                            if j < len(self.tokens):
                                handler_token, handler_kind, handler_line = self.tokens[j]

                                # (fn [...]) 패턴 감지
                                if handler_kind == 'SYMBOL' and handler_token == 'fn':
                                    col = self.lines[handler_line - 1].find('fn') + 1 if handler_line <= len(self.lines) else 1
                                    self.violations.append(Violation(
                                        'P0-2', self.filepath, handler_line, col,
                                        'try-catch: fn은 람다, catch 사용 필수',
                                        '(try expr (catch $e ...))'
                                    ))

                                # (catch ...) 확인
                                elif handler_kind == 'SYMBOL' and handler_token == 'catch':
                                    pass  # OK
                            break

                        sexpr_count += 1

                    j += 1

            i += 1

    # ============ P0-3: Bearer 토큰 ============
    def _check_p0_3_bearer_token(self):
        """http-get 헤더 경고"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'http-get':
                # http-get url [headers]
                if i + 2 < len(self.tokens):
                    # 2개 인자가 있으면 경고
                    j = i + 1
                    paren_depth = 0
                    arg_count = 0

                    while j < len(self.tokens):
                        if self.tokens[j][0] == '(':
                            paren_depth += 1
                        elif self.tokens[j][0] == ')':
                            paren_depth -= 1
                            if paren_depth < 0:
                                break

                        j += 1

                    # 간단한 휴리스틱: http-get 다음 심볼/문자열 2개 = 경고
                    symbols_after = 0
                    k = i + 1
                    while k < j and symbols_after < 3:
                        if self.tokens[k][1] in ('SYMBOL', 'STRING'):
                            symbols_after += 1
                        k += 1

                    if symbols_after >= 2:
                        col = self.lines[line - 1].find('http-get') + 1 if line <= len(self.lines) else 1
                        self.violations.append(Violation(
                            'P0-3', self.filepath, line, col,
                            'http-get 헤더 전달 불가',
                            'http-get-bearer 사용: (http-get-bearer url $token)'
                        ))

            i += 1

    # ============ P0-4: let 바인딩 각 줄 ============
    def _check_p0_4_let_binding(self):
        """let 바인딩이 같은 줄에 있으면 경고 (평면 벡터만)"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'let':
                if i + 1 < len(self.tokens) and self.tokens[i + 1][0] == '[':
                    vec_start_line = self.tokens[i + 1][2]
                    j = i + 2
                    binding_lines = []
                    has_nested_vec = False

                    # 벡터 내 토큰 수집
                    paren_depth = 0
                    while j < len(self.tokens):
                        t = self.tokens[j][0]
                        if t == '[':
                            has_nested_vec = True  # 중첩 벡터 있음
                        elif t == ']':
                            paren_depth -= 1
                            if paren_depth < 0:
                                break

                        if not has_nested_vec and self.tokens[j][1] in ('SYMBOL', 'STRING'):
                            binding_lines.append(self.tokens[j][2])

                        j += 1

                    # 평면 벡터에서만: 같은 줄에 2개 이상 심볼?
                    if not has_nested_vec and len(binding_lines) >= 4:  # 최소 2개 바인딩 (name val)
                        line_counts = {}
                        for l in binding_lines:
                            line_counts[l] = line_counts.get(l, 0) + 1

                        # 같은 줄에 4개 이상 토큰 = 2개 이상 바인딩
                        if any(count >= 4 for count in line_counts.values()):
                            col = self.lines[vec_start_line - 1].find('[') + 1 if vec_start_line <= len(self.lines) else 1
                            self.violations.append(Violation(
                                'P0-4', self.filepath, vec_start_line, col,
                                'let 바인딩: 각 줄 분리 필요',
                                '(let [[$x 1]\\n      [$y 2]])'
                            ))

            i += 1

    # ============ P0-5: json-stringify ============
    def _check_p0_5_json_stringify(self):
        """str 인자에 맵 또는 벡터 리터럴 있으면 경고"""
        i = 0
        while i < len(self.tokens):
            token, kind, line = self.tokens[i]

            if kind == 'SYMBOL' and token == 'str':
                # (str ... {:a 1} ...) 또는 (str ... [1 2 3] ...)
                # str 다음 토큰들을 스캔하여 인자 찾기
                j = i + 1
                paren_depth = 1  # 이미 ( 안에 있음
                has_map = False
                has_vec = False

                while j < len(self.tokens) and paren_depth > 0:
                    t = self.tokens[j][0]

                    # str 인자 중 { 또는 [ 찾기
                    if t == '{':
                        has_map = True
                        break
                    elif t == '[':
                        has_vec = True
                        break
                    elif t == ')':
                        paren_depth -= 1

                    j += 1

                if has_map or has_vec:
                    col = self.lines[line - 1].find('str') + 1 if line <= len(self.lines) else 1
                    self.violations.append(Violation(
                        'P0-5', self.filepath, line, col,
                        'str에 복합 타입: json-stringify 필요',
                        '(str "..." (json-stringify obj))'
                    ))

            i += 1

# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: lint-p0.py <file.fl> [--verbose]")
        sys.exit(1)

    filepath = sys.argv[1]
    verbose = '--verbose' in sys.argv

    if not Path(filepath).exists():
        print(f"❌ 파일 없음: {filepath}")
        sys.exit(1)

    linter = P0Linter(filepath)
    violations = linter.lint()

    if violations:
        for v in violations:
            print(v)
        sys.exit(1)
    else:
        if verbose:
            print(f"✅ {filepath} (P0 규칙 준수)")
        sys.exit(0)

if __name__ == '__main__':
    main()
