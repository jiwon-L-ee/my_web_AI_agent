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

## 맞불 플랫폼 (platform/)

토론·밸런스게임·OX퀴즈를 공유하는 커뮤니티 플랫폼. 슬로건: "사소한 고집의 끝". 정적 HTML/CSS/JS + Supabase 백엔드.

### 진입 플로우

```
루트 index.html
  ├─ 첫 방문 (sessionStorage.matbulIntroSeen 없음) → platform/infographic.html
  └─ 재방문 → platform/index.html
infographic.html 로드 시 matbulIntroSeen 세팅
QA/개발: http://localhost:8080/?reset 으로 플래그 초기화 후 인포그래픽 재확인 가능
```

- **직접 접근 우회 방지**: `platform/index.html` 상단 (DOCTYPE 이전)에 sessionStorage 체크 삽입
  ```html
  <!DOCTYPE html>
  <script>
    if (!sessionStorage.getItem('matbulIntroSeen')) {
      location.replace('infographic.html');
    }
  </script>
  <html lang="ko">
  ```
  → `platform/` URL 직접 접근 시에도 인포그래픽이 먼저 표시됨

### 파일 구조

```
platform/
├── infographic.html    — 맞불 소개 인트로 페이지 (첫 방문 시 표시)
├── index.html / login.html / create.html / post.html / mypage.html / profile.html
├── quiz.html           — 퀴즈 플레이어 (OX/객관식/단답형/주관식)
├── test.html           — TM 테스트 플레이어 (Teachable Machine)
├── css/style.css       — 다크 테마 (CSS 변수 기반, --bg, --surface, --accent 등)
└── js/
    ├── supabase.js     — Supabase 클라이언트 초기화 (window.db)
    ├── auth.js         — getUser, requireAuth, signInWithGoogle, escapeHtml, relativeTime, safeRedirectUrl, getGuestId
    ├── home.js         — 카드 그리드, 카테고리 필터, 정렬, 페이지네이션
    ├── create.js       — 게시물 작성, 썸네일 업로드, 퀴즈 문항 빌더, toggleCategoryFields()
    ├── post.js         — 밸런스게임 투표UI, 퀴즈/테스트 CTA, 좋아요, 댓글 CRUD
    ├── quiz.js         — 퀴즈 플레이어 로직 (quiz.html 전용)
    ├── test.js         — TM 테스트 플레이어 로직 (test.html 전용)
    ├── mypage.js       — 통계 집계, 내 게시물 관리
    └── profile.js      — 타인 프로필, 팔로우 토글
```

### Supabase 구성

- **프로젝트 URL**: `https://mwsfzxhblboskdlffsxi.supabase.co`
- **테이블**: profiles, posts, likes, comments, comment_likes, follows, votes, quiz_questions, persuasion_likes (RLS 활성화)
- **votes**: `user_id` nullable + `guest_id TEXT` — 비로그인 익명 투표 지원 (`getGuestId()` localStorage UUID)
- **Storage**: thumbnails 버킷 (public)
- **DB 함수**: `increment_view_count(post_id uuid)` — RPC로 조회수 증가
- **트리거**: `on_auth_user_created` — 구글 로그인 시 profiles 자동 생성
- **마이그레이션**: `supabase/migrations/20260319_create_platform_tables.sql`, `20260320_balance_game.sql`, `20260322_quiz_types.sql`

### 실행 방법

```
python -m http.server 8080
→ http://localhost:8080/         첫 방문: 인포그래픽 → 플랫폼
→ http://localhost:8080/?reset   인포그래픽 재확인 (QA용)
→ http://localhost:8080/platform/ 플랫폼 직접 접근
file:// 불가 — OAuth 미지원
```

### Google OAuth 설정 (미완료 시)

Supabase Dashboard → Auth → Providers → Google → Client ID/Secret 입력
→ login.html의 `#setupNotice` div 제거

### 카테고리

**네비게이션 탭**: `홈(밸런스게임) | 토론 | 퀴즈 | 커뮤니티 | 정보` (전 페이지 동일)
**DB 저장 카테고리**: `밸런스게임 / 퀴즈 / 테스트 / 커뮤니티 / 정보`
- `퀴즈` 카테고리는 `posts.quiz_type` 컬럼으로 세분화: `ox | multiple | short | subjective`
- 기존 `OX퀴즈` → `category='퀴즈', quiz_type='ox'`로 마이그레이션 완료 (2026-03-22)

탭 동작:
- **홈**: 밸런스게임 히어로 + 바형5 + 퀴즈·커뮤니티 프리뷰
- **토론**: 밸런스게임 게시물을 바형 리스트로 표시 (인기순/최신순)
- **퀴즈**: 퀴즈 + 테스트 합산 카드 그리드 (`.in('category', ['퀴즈', '테스트'])`)

post.html 섹션 분기:
- 밸런스게임: `#voteSection` — A/B 투표 UI
- 퀴즈: `#quizSection` — "퀴즈 풀기" CTA → `quiz.html?id=`
- 테스트: `#testSection` — "테스트 시작" CTA → `test.html?id=`

### 코딩 패턴 & 주의사항

- **스크립트 로드 순서**: supabase.js → auth.js → 페이지별 JS (항상 준수)
- **XSS 방지**: innerHTML 삽입 시 반드시 `escapeHtml()` 사용 (auth.js 정의)
  - **class 속성값도 이스케이프 필수**: `class="badge badge-${escapeHtml(category)}"` — 텍스트 내용뿐 아니라 class 속성 내 동적 값도 반드시 escapeHtml 적용
- **오픈 리다이렉트 방지**: login.html의 `?next=` 파라미터는 반드시 `safeRedirectUrl()` 통해 처리
- **이벤트 위임**: 동적으로 삽입되는 버튼(삭제, 댓글)은 inline onclick 금지 → data-* + 부모 위임
  - HTML 파일의 정적 버튼도 inline onclick 금지 → JS에서 addEventListener 사용
  - 이벤트 위임 등록 시 `{ once: true }` **절대 금지** — 첫 이벤트 후 리스너 소멸로 이후 모든 상호작용 끊김
  - 동적 목록 컨테이너는 `setupXxxEvents()` 패턴으로 초기에 한 번만 등록, innerHTML 재생성 시 재등록 불필요
- **Supabase count 쿼리**: `Promise.all()` 내부에서 `await` 혼용 금지 → 사전 resolve 후 전달
- **모바일 카테고리**: `.nav-cats`는 768px 이하 숨김 → `#catSelectMobile` select로 대체

---

## 코딩 표준 (항상 적용)

코드 작성·수정 시 아래 규칙을 반드시 준수합니다.

### 보안
- innerHTML 삽입 시 항상 `escapeHtml()` 사용 — 텍스트뿐 아니라 class 속성값도 포함
- `?next=` 등 리다이렉트 파라미터는 반드시 `safeRedirectUrl()`로 검증

### 이벤트 처리
- 동적 삽입 요소의 inline `onclick` 금지 → `data-*` 속성 + 부모 요소 이벤트 위임
- HTML 정적 버튼도 inline onclick 금지 → JS에서 `addEventListener` 사용

### Supabase / 비동기
- `Promise.all()` 내부에서 `await` 혼용 금지 → 사전 resolve 후 전달
- RLS가 활성화된 테이블은 반드시 정책 확인 후 쿼리 작성

### 스크립트 로드 순서 (platform/)
`supabase.js` → `auth.js` → 페이지별 JS 순서 준수

### 모바일
- `.nav-cats`는 768px 이하 숨김 → `#catSelectMobile` select로 대체
