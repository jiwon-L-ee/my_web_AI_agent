# 실제 웹서버 배포 시 수정 체크리스트

로컬(localhost:8080) 개발 환경을 실제 도메인에 배포할 때 반드시 확인·수정해야 할 항목들입니다.

---

## 1. Supabase Dashboard 설정

### Authentication > URL Configuration
- [ ] **Site URL** 변경
  - 현재: `http://localhost:8080`
  - 변경: `https://yourdomain.com`

- [ ] **Redirect URLs** 추가
  - 현재 등록된 값: `http://localhost:8080/platform/signup-profile.html`
  - 추가할 값: `https://yourdomain.com/platform/signup-profile.html`
  - 경로: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

### Authentication > Email Templates
- [ ] 이메일 인증 링크의 도메인이 실제 도메인을 가리키는지 확인
  - 경로: Supabase Dashboard → Authentication → Email Templates → Confirm signup

---

## 2. Google OAuth Console 설정

- [ ] **승인된 JavaScript 원본** 추가
  - 현재: `http://localhost:8080`
  - 추가: `https://yourdomain.com`

- [ ] **승인된 리디렉션 URI** 추가
  - 현재: `https://mwsfzxhblboskdlffsxi.supabase.co/auth/v1/callback`
  - 추가 불필요 (Supabase 콜백 URL은 고정) — 단, 도메인 변경 시 재확인

- 경로: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 클라이언트 ID

---

## 3. HTTPS 필수 (중요)

- [ ] 실제 서버에 SSL 인증서 적용 (Let's Encrypt 등)
- **이유**: Google OAuth는 `http://` 에서 동작하지 않음 (localhost만 예외)
- nginx + certbot 또는 Cloudflare 등을 통해 HTTPS 강제 적용

---

## 4. HTTP 서버 교체

- [ ] `python -m http.server 8080` 은 개발용 — 프로덕션에 사용 금지
- 대안:
  - **nginx**: 정적 파일 서빙에 적합
  - **Cloudflare Pages**: 정적 사이트 무료 호스팅
  - **GitHub Pages**: 정적 사이트 무료 호스팅
  - **Vercel**: 정적 사이트 무료 호스팅

---

## 5. Supabase Storage

- [ ] `thumbnails` 버킷이 **public** 으로 설정되어 있는지 확인
  - 경로: Supabase Dashboard → Storage → thumbnails → 버킷 설정
- [ ] Storage 버킷 용량 제한 확인 (무료 플랜: 1GB)

---

## 6. 코드 내 하드코딩 확인

- [ ] `platform/js/supabase.js` — SUPABASE_URL, SUPABASE_ANON_KEY
  - anon key는 공개 가능하지만, RLS 정책이 올바르게 설정되어 있는지 재확인
  - 경로: Supabase Dashboard → Project Settings → API

- [ ] `platform/js/auth.js` — redirectTo, emailRedirectTo
  - 현재 `location.origin` 을 동적으로 사용하므로 별도 수정 불필요

---

## 7. 법적 문서 작성

- [ ] `platform/legal/terms.txt` — 이용약관 실제 내용 작성
- [ ] `platform/legal/privacy.txt` — 개인정보처리방침 실제 내용 작성
- 개인정보보호법 제30조에 따라 개인정보처리방침은 반드시 공개해야 합니다.

---

## 8. 환경별 설정 요약

| 항목 | 로컬(개발) | 프로덕션 |
|------|-----------|---------|
| 서버 | `python -m http.server 8080` | nginx / Cloudflare Pages 등 |
| 프로토콜 | HTTP 가능 | HTTPS 필수 |
| Site URL | `http://localhost:8080` | `https://yourdomain.com` |
| Redirect URL | `http://localhost:8080/platform/signup-profile.html` | `https://yourdomain.com/platform/signup-profile.html` |
| OAuth 원본 | `http://localhost:8080` | `https://yourdomain.com` |
