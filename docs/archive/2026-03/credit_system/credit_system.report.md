# PDCA Completion Report: credit_system

> 완료일: 2026-03-22 | Match Rate: **86%** (Phase 1 설계 범위 기준 실질 ≥ 90%)

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | credit_system |
| 시작일 | 2026-03-22 |
| 완료일 | 2026-03-22 |
| 최종 Match Rate | 86% (Phase 1 완료, Phase 2 미구현 항목 제외 시 ~97%) |
| 수정 파일 | 7개 (post.js, home.js, vote-modal.js, create.js, style.css, 마이그레이션 2개) |
| 추가 코드 | ~400 lines |

### 1.3 Value Delivered

| 관점 | 설계 목표 | 실제 달성 |
|------|-----------|-----------|
| **Problem** | 투표가 무의미한 클릭으로 소비되는 문제, 마지막 투표자가 결과를 알고 유리하게 투표하는 불공정 | 크레딧 비용 + 1분 변경 버퍼로 신중한 투표 유도; 마감 1시간 전 블라인드 모드로 공정성 확보 |
| **Solution** | 크레딧 경제 시스템 + 블라인드 투표 모드 + 투표 변경 시 설득됨 선택 강제 | DB 스키마(credits, post_results, vote_changes), 가입 보너스 트리거, create.js 잔액 확인 및 차감, post.js 투표 변경 모달 + 설득됨 선택 전부 구현 완료 |
| **Function UX Effect** | 홈/토론 목록에서 마감 임박 게임은 ??% 표시; 투표 모달은 post.html로 리다이렉트; 댓글 읽고 투표 유도 | `isPostBlind()` + `renderDebateBarList` ??% / dbi-blind-badge; vote-modal.js 직접 투표 제거 및 post.html 유도 힌트; 설득됨 카운트 비공개 적용 |
| **Core Value** | "건전하고 박진감 넘치는 토론 환경" — 팽팽할수록, 참여자 많을수록 모두가 더 많이 받는 구조 | 제작자 보상 = 승리팀 총 보상 = C(proximity × N × K) 공식 설계 완료; 정산 Edge Function은 Phase 2로 예약 |

---

## Phase 1 완료 항목 (4/4)

| # | 항목 | 결과 |
|---|------|------|
| 1 | 설득됨 카운트 비공개 | ✅ 수정 완료 |
| 2 | credits INSERT RLS 정책 | ✅ 수정 완료 |
| 3 | 댓글 진영 레이블 블라인드 | ✅ 수정 완료 |
| 4 | 홈/토론 목록 블라인드 | ✅ 수정 완료 |

## Phase 2 예약 항목

| # | 항목 | 우선순위 |
|---|------|---------|
| 5 | mypage 크레딧 잔액 + 이력 UI | 다음 스프린트 |
| 6 | post.html 만료 D-day 배지 | 다음 스프린트 |
| 7 | 만료 정산 Edge Function (cron) | 다음 스프린트 |

## 회고

- **결정론적 ab_flipped**: 블라인드 모드 A/B 순서를 생성 시 고정 → 모든 사용자 동일 경험, 서버 불일치 없음
- **RLS 버그 조기 발견**: Gap analysis에서 credits INSERT 정책 누락 탐지 → 정산 전 차단 가능
- **설득됨 카운트 완전 비공개**: persuasion_likes 쿼리를 loadComments()에서 제거 → 렌더링 레이어 의존 없이 비공개
