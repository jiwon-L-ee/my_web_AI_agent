# platform/ CLAUDE.md

**맞불** — 밸런스게임·토론·퀴즈 커뮤니티. 슬로건: "사소한 고집의 끝".
정적 HTML/CSS/JS + Supabase(Auth · DB · Storage).

### 네비게이션 카테고리 (전 페이지 동일)
`홈(밸런스게임) / 토론 / 퀴즈 / 커뮤니티 / 정보`

### 게시물 카테고리 (DB 저장값)
`밸런스게임 / OX퀴즈 / 테스트 / 커뮤니티 / 정보`

### 카테고리 → 탭 매핑
| 탭 | DB 카테고리 | 표시 방식 |
|----|------------|---------|
| 홈 | 밸런스게임 | 히어로 + 바형 리스트(5) + 퀴즈·커뮤니티 프리뷰 |
| 토론 | 밸런스게임 | 바형 리스트 전체 (인기순/최신순 정렬) |
| 퀴즈 | OX퀴즈 + 테스트 | 카드 그리드 |
| 커뮤니티 | 커뮤니티 | 카드 그리드 |
| 정보 | 정보 | 카드 그리드 |

> 세부 내용은 `docs/` 참조:
> - [`docs/db.md`](docs/db.md) — DB 스키마, 마이그레이션, 쿼리 패턴
> - [`docs/patterns.md`](docs/patterns.md) — 보안 규칙, 이벤트 처리, 인증 패턴
> - [`docs/ui.md`](docs/ui.md) — 히어로, 투표 모달, 카드, 파티클 등 UI 구조
> - [`docs/history.md`](docs/history.md) — 변경 이력

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `js/supabase.js` | `window.db` 초기화. 모든 페이지 JS의 전제조건 |
| `js/auth.js` | `getUser`, `requireAuth`, `escapeHtml`, `relativeTime`, `safeRedirectUrl` |
| `js/home.js` | 카드 그리드, 히어로 섹션, 바형 리스트, 프리뷰 섹션, 파티클 |
| `js/vote-modal.js` | 밸런스게임 투표 모달 (IIFE). index.html 전용 |
| `js/create.js` | 게시물 작성, 썸네일 업로드, `toggleCategoryFields()` |
| `js/post.js` | 투표UI/TM플레이어 조건부 렌더링, 좋아요, 댓글 CRUD |
| `js/mypage.js` | 통계 집계, 게시물 삭제 |
| `js/profile.js` | 팔로우/언팔로우, 유저 게시물 그리드 |
| `infographic.html` | 첫 방문 인트로 (Black Han Sans, 불씨 파티클) |

## 홈 페이지 구조 (밸런스게임 탭)

```
히어로 (밸런스게임 votes 합산 top 1)
"다른 뜨거운 논쟁" 바형 리스트 (2~6위, 5개)
─── 구분선 (#quizDivider) ───
퀴즈 & 테스트 프리뷰 (OX퀴즈+테스트 최신 4개) — 없으면 섹션 전체 숨김
─── 구분선 (#communityDivider) ───
커뮤니티 프리뷰 (최신 4개) — 없으면 섹션 전체 숨김
```

**show/hide 원칙**: divider는 반드시 해당 프리뷰 헤더와 함께 show/hide.
```js
// 보이기
if (quizDivider)       quizDivider.style.display       = '';
if (quizPreviewHeader) quizPreviewHeader.style.display = '';
// 숨기기
if (quizDivider)       quizDivider.style.display       = 'none';
if (quizPreviewHeader) quizPreviewHeader.style.display = 'none';
```

## home.js 주요 함수

| 함수 | 역할 |
|------|------|
| `loadBalanceGameHome()` | 홈 탭 — 히어로 + 바형5 + 프리뷰 병렬 로드 |
| `loadDebateBarPage(reset)` | 토론 탭 — 바형 리스트 전체 (currentSort 사용) |
| `loadQuizPreview()` | OX퀴즈+테스트 최신 4개, 없으면 섹션 숨김 |
| `loadCommunityPreview()` | 커뮤니티 최신 4개, 없으면 섹션 숨김 |
| `renderDebateBarList(posts, votesByPost, bestByPost)` | 바형 아이템 HTML 생성 |
| `renderPreviewItem(post)` | 프리뷰 아이템 HTML — PREVIEW_ICONS 사용 |

**퀴즈 탭 필터**: `.in('category', ['OX퀴즈', '테스트'])` 사용

## 아이콘 원칙

**이모지 절대 금지** — 카테고리 아이콘은 `PREVIEW_ICONS` 상수의 inline SVG 사용.
새 카테고리 추가 시 `PREVIEW_ICONS` 객체에 SVG 추가 후 `renderPreviewItem`에서 참조.

## 히어로 배틀 아레나 — CSS 변수 & 불꽃 강도

`.hero-battle` 요소에 JS로 설정하는 CSS custom properties:

| 변수 | 설명 |
|------|------|
| `--divide` | 배경 분할 위치 (예: `60%`) |
| `--pct-a` / `--pct-b` | 투표율 숫자 |
| `--flame-a-opacity` / `--flame-b-opacity` | 불꽃 투명도 |
| `--flame-a-sat` / `--flame-b-sat` | 채도 (CSS `%` 단위 포함) |
| `--flame-a-bright` / `--flame-b-bright` | 밝기 |
| `--flame-a-scale` / `--flame-b-scale` | 불꽃 높이 scaleY 값 |

**투표율 → 강도 계산식** (`pct` = 0~100):
```js
opacity = 0.25 + (pct / 100) * 0.75   // 0.25 ~ 1.0
sat     = (60 + pct * 1.4) + '%'       // 60% ~ 200%
bright  = 0.6 + (pct / 100) * 0.5     // 0.6 ~ 1.1
scale   = 0.65 + (pct / 100) * 0.5    // 0.65 ~ 1.15
```

## 레이아웃 & 트랜스폼 트랩

**`flex` 쏠림 효과 금지**: 투표율에 따라 `element.style.flex = pct`로 패널 크기를 조절하면
패배 측 텍스트가 극도로 찌그러짐. CSS custom property로 불꽃 강도·opacity를 대신 조절할 것.

**`scaleX(-1) + transform-origin` 트랩**: `scaleX(-1)`로 수평 미러링 + `scaleY()`를 함께
쓸 때 `transform-origin: bottom right`는 요소를 화면 밖으로 밀어냄.
반드시 `transform-origin: bottom center` 사용:
```css
/* ✅ */
.hero-flame-b {
  transform: scaleX(-1) scaleY(var(--flame-b-scale, 1));
  transform-origin: bottom center;
}
/* ❌ bottom right → scaleX(-1)과 함께 쓰면 요소가 우측으로 밀려 비표시됨 */
```

## 절대 규칙 (항상 준수)

**스크립트 로드 순서**: `supabase.js` → `auth.js` → (index만: `vote-modal.js` →) `home.js` or `[페이지].js`

**XSS 방지**: `innerHTML` 삽입 시 반드시 `escapeHtml()` — class 속성값도 포함
```js
`<span class="badge badge-${escapeHtml(post.category)}">`  // ✅
`<span class="badge badge-${post.category}">`              // ❌
```

**이벤트**: inline `onclick` 금지 (정적 버튼 포함) → `addEventListener` 또는 이벤트 위임

**리다이렉트**: `?next=` 파라미터는 반드시 `safeRedirectUrl()` 경유

**Promise.all**: 내부에서 `await` 혼용 금지 → 사전 resolve 후 전달

**RLS**: 댓글/투표 DELETE 시 반드시 `.eq('user_id', currentUser.id)` 포함

## Supabase

- **프로젝트 URL**: `https://mwsfzxhblboskdlffsxi.supabase.co`
- **테이블**: profiles, posts, likes, comments, comment_likes, follows, votes
- **Storage**: thumbnails 버킷 (public)
- **DB 함수**: `increment_view_count(post_id uuid)` (RPC)
- **트리거**: `on_auth_user_created` (구글 로그인 시 profiles 자동 생성)

## 실행

```bash
python -m http.server 8080
# → http://localhost:8080/          첫 방문: infographic → 플랫폼
# → http://localhost:8080/?reset    infographic 재확인 (QA)
# file:// 불가 — OAuth 미지원
```
