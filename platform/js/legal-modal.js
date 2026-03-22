// legal-modal.js — 법적 문서 모달 (모든 페이지 공통)
// 의존성 없음. supabase.js/auth.js 없어도 단독 동작.
(function () {
  const LEGAL_FILES = {
    terms:      'legal/terms.txt',
    privacy:    'legal/privacy.txt',
    guidelines: 'legal/guidelines.txt',
  };
  const LEGAL_TITLES = {
    terms:      '이용약관',
    privacy:    '개인정보처리방침',
    guidelines: '커뮤니티 가이드라인',
  };

  // ── 모달 HTML 삽입 ───────────────────────────────────────────────
  const modalHtml = `
<div class="lm-overlay" id="legalModalOverlay" role="dialog" aria-modal="true" style="display:none">
  <div class="lm-box">
    <div class="lm-header">
      <h3 id="lmTitle"></h3>
      <button class="lm-close" id="lmClose" type="button" aria-label="닫기">✕</button>
    </div>
    <div class="lm-body">
      <div id="lmLoading" class="lm-loading">불러오는 중...</div>
      <pre id="lmContent" style="display:none"></pre>
    </div>
  </div>
</div>`;

  const styleHtml = `<style>
.lm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}
.lm-box {
  background: var(--surface, #1e1e2a);
  border: 1px solid var(--border, #2e2e3a);
  border-radius: 12px;
  width: 100%;
  max-width: 580px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.lm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #2e2e3a);
}
.lm-header h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text, #fff);
  margin: 0;
}
.lm-close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px;
  background: none;
  border: 1px solid var(--border, #2e2e3a);
  color: var(--text-muted, #888);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: border-color 0.15s, color 0.15s;
}
.lm-close:hover { border-color: var(--text-muted, #888); color: var(--text, #fff); }
.lm-body {
  overflow-y: auto;
  padding: 20px;
  flex: 1;
}
.lm-body pre {
  font-family: var(--font, 'Pretendard', sans-serif);
  font-size: 0.82rem;
  color: var(--text-muted, #aaa);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.75;
  margin: 0;
}
.lm-loading {
  text-align: center;
  color: var(--text-muted, #888);
  font-size: 0.85rem;
  padding: 30px 0;
}
</style>`;

  document.head.insertAdjacentHTML('beforeend', styleHtml);
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay  = document.getElementById('legalModalOverlay');
  const title    = document.getElementById('lmTitle');
  const content  = document.getElementById('lmContent');
  const loading  = document.getElementById('lmLoading');
  const closeBtn = document.getElementById('lmClose');

  // ── 캐시 ─────────────────────────────────────────────────────────
  const cache = {};

  // ── 공개 API ─────────────────────────────────────────────────────
  async function openLegal(type) {
    title.textContent     = LEGAL_TITLES[type] || type;
    content.style.display = 'none';
    loading.style.display = 'block';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (cache[type]) {
      content.textContent   = cache[type];
      content.style.display = 'block';
      loading.style.display = 'none';
      return;
    }

    try {
      const res  = await fetch(LEGAL_FILES[type]);
      const text = await res.text();
      cache[type]           = text;
      content.textContent   = text;
      content.style.display = 'block';
      loading.style.display = 'none';
    } catch {
      content.textContent   = '내용을 불러올 수 없습니다.';
      content.style.display = 'block';
      loading.style.display = 'none';
    }
  }

  function closeLegal() {
    overlay.style.display        = 'none';
    document.body.style.overflow = '';
  }

  window.openLegal = openLegal;

  // ── 닫기 이벤트 ──────────────────────────────────────────────────
  closeBtn.addEventListener('click', closeLegal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeLegal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLegal(); });

  // ── 푸터 링크 자동 연결 (data-legal 속성) ────────────────────────
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-legal]');
    if (!el) return;
    e.preventDefault();
    openLegal(el.dataset.legal);
  });
})();
