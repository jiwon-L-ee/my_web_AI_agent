# 변경 이력

## 2026-03-19 (1차 — 에이전트 QA)
planner / design / database / backend / frontend / qa 6개 에이전트 코드 검토.
- 수정: 오픈 리다이렉트, N+1 쿼리, inline onclick XSS, 모바일 필터 누락, DB 인덱스, 에러 메시지 노출

## 2026-03-19 (2차 — QA 재검증)
/qa → /orchestrate → QA PASS.
- 수정: badge CSS class 속성 `escapeHtml` 누락 (home/post/mypage/profile.js), mypage.html 정적 버튼 inline onclick 제거

## 2026-03-20 (리디자인 — 밸런스게임 커뮤니티 전환)
- 슬로건·카테고리 순서 확정, votes 테이블 추가, A/B 투표 UI, infographic.html 인트로, SVG 로고

## 2026-03-20 (밸런스게임 UI + 투표 모달)
- 추가: comment_likes 테이블 + comments.side 컬럼 (MCP 적용), vote-modal.js, 배너 카드, 댓글 좋아요
- 버그픽스: isHot ReferenceError, overflow:hidden + ::before 충돌, isVoting race condition, 댓글 삭제 user_id 필터 누락

## 2026-03-21 (홈 2차 리디자인 — 분할 패널 불꽃)
장풍 빔 애니메이션 → CSS clip-path 불꽃 + 소용돌이로 교체.
- 추가: hero-flame-a/b (flameBreathe), hero-vortex (vortexSpin), hero-stats-row 3열 그리드
- 추가: dbi-top-row, dbi-best-row, dbi-stats-row (바형 리스트 개선)
- nav 투표 탭 = 밸런스게임 전체 목록, 토론 탭 = 자유토론 확정

## 2026-03-21 (히어로 3차 리디자인 — 쏠림 효과)
무지개 소용돌이/맞불 로고 제거, 투표율 기반 쏠림 효과 도입.
- 제거: hero-vortex (conic-gradient), hero-logo-center (맞불 SVG)
- 추가: hero-divider (얇은 VS 구분선), hero-topic (주제 대형 표시 1.65rem)
- 쏠림: hero-side flex + hero-bg-a/b inset이 투표율에 따라 트랜지션
- 모달: vm-arena flex 전환, 투표 후 패널 flex 비율 + vm-winner/vm-loser 클래스
- 수정: "B 투표하기" → "B 투표" (버튼 대칭), hero-option이 pct 위에 표시
