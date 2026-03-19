# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

멀티 에이전트 웹 개발 오케스트레이터. Python (claude-code-sdk) 기반의 터미널 REPL 시스템으로,
오케스트레이터가 6개의 하위 에이전트(planner, design, database, backend, frontend, qa)를 조율하여 웹 프로젝트를 자동으로 구축합니다.

## 실행 방법

```bash
# 의존성 설치
pip install -r requirements.txt

# .env.local에 API 키 설정
# ANTHROPIC_API_KEY=sk-ant-...

# 대화형 REPL
python main.py

# 직접 태스크 실행
python main.py --task "로그인 페이지 만들어줘"
```

## 주요 파일

- `main.py` — 진입점, REPL 루프
- `agents/orchestrator.py` — 오케스트레이터 (query() 호출, claude-opus-4-6)
- `agents/tools/progress_tracker.py` — SDK 메시지 → 태스크 상태 추적 (rich 기반 UI)
- `agents/sub_agents/*.py` — 6개 하위 에이전트 설정 (ALLOWED_TOOLS, MODEL, 프롬프트)
- `config/agents.yaml` — 에이전트별 모델/도구 설정
- `config/prompts/*.md` — 에이전트별 시스템 프롬프트

## Supabase 연동

- 기본: database 에이전트가 `supabase/migrations/*.sql` 파일 생성, 사용자가 `npx supabase db push` 실행
- 직접 적용 옵션: `config/agents.yaml`의 database.allowed_tools에서 MCP 도구 주석 해제

---

## 얼굴상 분석 웹사이트

Teachable Machine 모델을 활용한 정적 웹사이트. 얼굴 사진을 업로드하면 아랍상/두부상을 AI로 판정합니다.

### 파일 구조

```
index.html       — 메인 페이지 (CDN 로드, 업로드 UI, 결과 섹션)
css/style.css    — 다크 테마 스타일 (드래그 피드백, 결과 카드, 신뢰도 바)
js/app.js        — 모델 로드 및 예측 로직
```

### 모델 정보

- **URL**: `https://teachablemachine.withgoogle.com/models/id9fnVeCr/`
- **클래스**: 아랍상, 두부상 (이진 분류)
- **라이브러리**: TensorFlow.js + `@teachablemachine/image` (CDN)

### 실행 방법

`index.html`을 브라우저에서 직접 열기 (별도 서버 불필요)

### 클래스별 설명

- **아랍상**: 뚜렷하고 강한 이목구비, 높은 콧대, 짙은 눈썹, 이국적인 매력
- **두부상**: 사각형에 가까운 얼굴형, 넓은 이마, 안정적이고 신뢰감 있는 인상

### 주요 구현

- 드래그 앤 드롭 / 클릭 업로드
- 모델 lazy loading (첫 분석 시 로드)
- 신뢰도 바 애니메이션
- 전체 클래스 점수 표시
- 아랍상: 주황-빨강 그라디언트 / 두부상: 파란 그라디언트
