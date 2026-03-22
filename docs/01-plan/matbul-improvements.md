# 맞불 플랫폼 개선 계획

> 출처: `계획서.txt` (2026-03-22)
> 담당: 이지원

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | matbul-improvements |
| 작성일 | 2026-03-22 |
| 즉시 구현 | 3개 (정렬 순서, 커뮤니티 UI, 투표 표시) |
| 설계 필요 | 2개 (탈퇴 처리, 크레딧 시스템) |

---

## 요구사항 분류

### ✅ 즉시 구현 (이번 세션)

#### 1. 정렬 순서 변경
- **현재**: 최신순 / 인기순
- **변경**: 인기순 / 최신순 (인기순이 기본)
- **파일**: `platform/index.html`, `platform/js/home.js`
- **작업**: sort-btn 순서 교체, `currentSort` 기본값 `view_count`로 변경

#### 2. 커뮤니티 게시글 UI 개선 (리스트형)
- **현재**: 카드 그리드 (썸네일 + 카드)
- **변경**: 에브리타임/에브리원 스타일 리스트 — 제목 + 본문 미리보기 + 댓글수·시간·작성자
- **파일**: `platform/index.html`, `platform/js/home.js`, `platform/css/style.css`
- **작업**: `#communityList` 요소 추가, `loadCommunityListPage()` + `renderCommunityListItem()` 구현

#### 3. 밸런스게임 목록에서 내 투표 선택 표시
- **현재**: 투표 여부를 목록에서 확인 불가
- **변경**: 내가 투표한 항목에 "A선택" / "B선택" 뱃지 표시
- **파일**: `platform/js/home.js`
- **작업**: 로그인 유저의 votes 조회 후 debate-bar-item에 인디케이터 렌더

---

### 📋 설계 필요 (이번 세션 문서 작성, 구현은 별도)

#### 4. 탈퇴 시 데이터 처리 정책
- **질문**: 탈퇴 유저의 좋아요·팔로잉·투표·게시물은 어떻게 처리?
- **결정**: 아래 정책 적용
  - `posts`, `comments`: `user_id = NULL` (익명화, 게시물 유지)
  - `likes`, `votes`, `follows`, `comment_likes`: CASCADE 삭제
  - `profiles`: 삭제 (트리거로 처리)
- **DB 작업**: `posts.user_id`, `comments.user_id` FK에 `ON DELETE SET NULL` 적용
  현재 기본값(CASCADE) → 마이그레이션으로 변경 필요
- **파일**: `supabase/migrations/20260322_withdrawal_policy.sql`

#### 5. 크레딧 시스템 (v2 — 단순화)
- **소비 2가지만**: 밸런스게임 생성 (-10) / 투표 변경 (-5)
- **획득 2가지만**:
  - 참여자: 승리 진영 투표 시 **+10 크레딧**
  - 제작자: `근접도 × 로그인_참여자_수 × 0.5` 크레딧
    (근접도 = 최종 비율이 5:5에 가까울수록 1에 수렴)
- **블라인드 투표 폐지**: 투표율은 항상 공개 (판단도 전략의 일부)
- **베팅 폐지**: 복잡성 대비 효과 불명확 → 제거
- **DB 설계**: `credits`, `post_results`, `posts.expires_at`
- **파일**: `docs/02-design/credit-system.md`

---

---

### 🆕 신규 요구사항 (2026-03-22 추가) — 구현 대기

#### 6. 모달 즉시투표 폐지 → 댓글 열람 후 투표
- **현재**: 홈/토론 탭에서 밸런스게임 클릭 → 투표 모달에서 바로 A/B 선택
- **변경**: 투표 모달에서 바로 투표 불가 → post.html로 이동하여 댓글을 읽은 후 투표
- **근거**: 댓글을 읽었다 = 충분히 고민한 상태 → 더 의미 있는 투표
- **파일**: `platform/js/vote-modal.js`, `platform/js/post.js`, `platform/post.html`
- **설계**: `docs/02-design/vote-flow.md`

#### 7. 투표 변경: 설득됨 필수 + 설득됨 포인트 시스템
- **현재**: 투표 변경 시 "내 생각이 바뀜" / "설득됨" 두 가지 선택
- **변경**: "내 생각이 바뀜" 옵션 완전 삭제
  → 상대 진영 댓글 목록에서 **반드시 하나를 선택**해야 투표 변경 가능
- **설득됨 포인트**: 선택받은 댓글 작성자에게 **+1 포인트 (비공개)**
  - 포인트 수치는 어디에도 표시하지 않음
  - 밸런스게임 만료 시 승리 크레딧 가중치 계산에만 사용
- **승리 크레딧 지급**: 기본 +5 (균등) + 가중 보너스 (설득됨 포인트×3 + 좋아요×1 비율로 분배)
- **파일**: `platform/js/post.js`, `platform/post.html`
- **설계**: `docs/02-design/vote-flow.md`, `docs/02-design/credit-system.md`

#### 8. 투표 변경 시 크레딧 소비
- **규칙**: 한 번 투표 후 변경하려면 **크레딧 소비** 필수
- **비용**: 변경 1회당 **5 크레딧** 차감 (크레딧 잔액 부족 시 변경 불가)
- **근거**: 충분히 고민하고 투표했으므로 변경은 비용을 수반해야 함
- **예외**: 투표 후 **1분 이내** 취소는 무료 (실수 방지용 버퍼)
- **파일**: `platform/js/post.js`, Supabase credits 테이블
- **설계**: `docs/02-design/vote-flow.md`, `docs/02-design/credit-system.md`

#### 9. 제작자 크레딧 베팅
- **규칙**: 밸런스게임 생성 시 제작자가 크레딧을 베팅 (필수 or 선택)
- **정산**:
  - 제작자가 A 팀에 베팅 → A 팀 승리: 베팅액 2배 획득 / B 팀 승리: 베팅액 몰수
  - 베팅은 A/B 중 자신이 생각하는 승리 진영에 걸기
- **효과**: 제작자가 한쪽 편을 들면 해당 게시물의 논쟁이 더 달아오름 (게임성 강화)
- **최소/최대 베팅**: 최소 5크레딧, 최대 보유 크레딧의 50%
- **파일**: `platform/js/create.js`, `platform/create.html`, Supabase posts/credits 테이블
- **설계**: `docs/02-design/credit-system.md`

#### 10. 마감 1시간 전 — 블라인드 + A/B 랜덤 순서
- **근거**: 마지막 참가자가 현재 투표율을 보고 전략적으로 투표하면 불공정 → 마감 1시간 전 정보 차단
- **변경사항**:
  1. **투표율 비공개**: A%/B% 수치 및 바 그래프 모두 숨김 ("마감 전 블라인드" 안내 문구 표시)
  2. **A/B 순서 랜덤 교체**: 게시물 생성 시 `ab_flipped` 필드를 랜덤 설정, 마감 1시간 전부터 적용
  3. **댓글 진영 레이블 교체**: ab_flipped 적용 시 A진영 댓글 ↔ B진영 댓글 표시 순서도 교체
  4. **홈/토론 목록도 동일**: 목록의 바 그래프 % 숨김
- **DB**: `posts.ab_flipped BOOLEAN DEFAULT false` — 게시물 생성 시 `random() > 0.5`로 자동 설정
- **클라이언트 로직**: `expires_at - now() < 1h` 조건 시 flip 적용 (투표 기록은 DB 원본 기준)
- **파일**: `platform/js/post.js`, `platform/js/home.js`, `platform/js/create.js`, Supabase posts 테이블
- **설계**: `docs/02-design/vote-flow.md`

---

## 구현 순서

```
[완료] PDCA 계획 문서 작성
[완료] 정렬 순서 변경 (index.html + home.js)
[완료] 커뮤니티 리스트 UI (style.css + home.js + index.html)
[완료] 내 투표 표시 (home.js — 홈/토론 탭)
[완료] 탈퇴 처리 마이그레이션 SQL 작성 + Supabase 적용
[대기] 크레딧 시스템 기반 구현 (credits, post_results, ab_flipped 컬럼)
  ↓
[대기] 모달 즉시투표 폐지 → post.html 리다이렉트
  ↓
[대기] 투표 변경: 설득됨 필수 + 크레딧 차감
  ↓
[대기] 마감 1시간 전 블라인드 + A/B 랜덤 순서 (post.js + home.js)
  ↓
[대기] 만료 처리 Edge Function (승리 정산)
```
