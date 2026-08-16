# FreeLang 실행 경로

FreeLang v11은 실행과 네이티브 컴파일을 분리한다.

## 애플리케이션 실행

애플리케이션은 정식 Node 런타임을 통해 실행한다.

    node scripts/fl-cli.js run app.fl
    node scripts/fl-cli.js serve app/
    node scripts/fl-cli.js repl

또는 npm 스크립트를 사용한다.

    npm run fl -- run app.fl
    npm run fl -- serve app/

`scripts/fl-cli.js`는 현재 작업 디렉터리를 유지하며 run, serve, repl, compile만 허용한다.

## 네이티브 컴파일

`bin/fl`은 네이티브 컴파일러이므로 애플리케이션 실행 명령으로 사용하지 않는다.

    bin/fl app.fl

HTTP 서버와 DB 내장 함수를 사용하는 앱은 `scripts/fl-cli.js` 또는 `node bootstrap.js` 경로로 실행한다.
