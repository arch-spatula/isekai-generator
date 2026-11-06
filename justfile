default:
    @just --list

# 사용 가능한 명령과 설명을 표시합니다.
help:
    @just --list

# Nix 개발 셸에 진입합니다.
shell:
    nix develop 'path:.'

# JavaScript 의존성을 설치합니다.
install:
    nix develop 'path:.' --command bun install

# 전달한 출생정보의 전체 명식 보고서를 출력합니다.
report *args:
    nix develop 'path:.' --command bun scripts/chart-report.ts {{ args }}

# 자동화 테스트를 실행합니다.
test:
    nix develop 'path:.' --command bun run test

# Nix에서 제공하는 개발 도구의 버전을 표시합니다.
versions:
    @nix develop 'path:.' --command sh -c 'printf "codex="; codex --version; printf "node="; node --version; printf "npm="; npm --version; printf "bun="; bun --version; printf "just="; just --version; printf "lua="; lua -v 2>&1; printf "love="; love --version'
