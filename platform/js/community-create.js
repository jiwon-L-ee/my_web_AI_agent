// community-create.js

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_MB = 10;

let currentUser = null;
const imgFileMap = new Map();   // blobUrl → File
let selectedImg  = null;        // 현재 클릭 선택된 img 요소

(async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();
  setupEditor();
  setupForm();
})();

// ── 에디터 ────────────────────────────────────────────────────────
function setupEditor() {
  const editor   = document.getElementById('ccEditor');
  const imgInput = document.getElementById('ccImgInput');
  const floatDel = document.getElementById('imgFloatDel');

  // ① 파일 선택
  imgInput.addEventListener('change', e => {
    Array.from(e.target.files).forEach(insertFile);
    e.target.value = '';
  });

  // ② 드래그앤드롭
  editor.addEventListener('dragover', e => { e.preventDefault(); editor.classList.add('drag-over'); });
  editor.addEventListener('dragleave', () => editor.classList.remove('drag-over'));
  editor.addEventListener('drop', e => {
    e.preventDefault();
    editor.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(insertFile);
  });

  // ③ 클립보드 붙여넣기
  editor.addEventListener('paste', e => {
    const imgItem = Array.from(e.clipboardData?.items ?? []).find(it => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      insertFile(imgItem.getAsFile());
    }
    // 텍스트 붙여넣기는 기본 동작 허용 (plain text만)
  });

  // ④ 이미지 클릭 → floating × 버튼 표시
  editor.addEventListener('click', e => {
    if (e.target.tagName === 'IMG') {
      selectImg(e.target);
    } else {
      deselectImg();
    }
  });

  // ⑤ floating × 버튼
  floatDel.addEventListener('mousedown', e => e.preventDefault()); // 에디터 포커스 유지
  floatDel.addEventListener('click', () => {
    if (selectedImg) {
      selectedImg.remove();
      deselectImg();
      checkReady();
    }
  });

  // ⑥ Delete/Backspace 키로도 삭제
  editor.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImg) {
      e.preventDefault();
      selectedImg.remove();
      deselectImg();
      checkReady();
    }
  });

  // ⑦ 스크롤/리사이즈 시 × 버튼 위치 재조정
  window.addEventListener('scroll', updateFloatDel, { passive: true });
  window.addEventListener('resize', updateFloatDel, { passive: true });

  // 내용 변경 감지
  editor.addEventListener('input', checkReady);
}

function insertFile(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) { alert('JPG·PNG·GIF·WebP만 가능합니다.'); return; }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`${MAX_MB}MB 이하 이미지만 가능합니다.`); return; }

  const blobUrl = URL.createObjectURL(file);
  imgFileMap.set(blobUrl, file);

  // execCommand로 커서 위치에 이미지 삽입 (가장 안정적)
  const editor = document.getElementById('ccEditor');
  editor.focus();
  document.execCommand('insertHTML', false,
    `<img src="${blobUrl}" data-local="1" alt="첨부 이미지">`
  );
  checkReady();
}

function selectImg(img) {
  document.getElementById('ccEditor').querySelectorAll('img').forEach(i => i.classList.remove('img-sel'));
  img.classList.add('img-sel');
  selectedImg = img;
  updateFloatDel();
}

function deselectImg() {
  if (selectedImg) selectedImg.classList.remove('img-sel');
  selectedImg = null;
  const floatDel = document.getElementById('imgFloatDel');
  floatDel.classList.remove('visible');
}

function updateFloatDel() {
  const floatDel = document.getElementById('imgFloatDel');
  if (!selectedImg || !document.getElementById('ccEditor').contains(selectedImg)) {
    floatDel.classList.remove('visible');
    return;
  }
  const rect = selectedImg.getBoundingClientRect();
  floatDel.style.top   = (rect.top  + 6) + 'px';
  floatDel.style.right = (window.innerWidth - rect.right + 6) + 'px';
  floatDel.classList.add('visible');
}

// ── 제출 버튼 활성화 ─────────────────────────────────────────────
function checkReady() {
  const title  = document.getElementById('ccTitle').value.trim();
  const editor = document.getElementById('ccEditor');
  const t1     = document.getElementById('ccTerms1').checked;
  const t2     = document.getElementById('ccTerms2').checked;
  const hasContent = editor.innerText.trim() || editor.querySelector('img[data-local]');
  document.getElementById('ccSubmitBtn').disabled = !(title && hasContent && t1 && t2);
}

// ── 폼 ───────────────────────────────────────────────────────────
function setupForm() {
  document.getElementById('ccTitle').addEventListener('input', checkReady);
  document.getElementById('ccTerms1').addEventListener('change', checkReady);
  document.getElementById('ccTerms2').addEventListener('change', checkReady);
  document.getElementById('ccCancelBtn').addEventListener('click', () => {
    location.href = 'index.html?cat=커뮤니티';
  });
  document.getElementById('ccSubmitBtn').addEventListener('click', handleSubmit);
}

async function handleSubmit() {
  const btn = document.getElementById('ccSubmitBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '게시 중...';

  try {
    const title = document.getElementById('ccTitle').value.trim();
    const { description, contentImgs } = await buildContent();

    const payload = { user_id: currentUser.id, title, description, category: '커뮤니티' };
    if (contentImgs.length) {
      payload.content_images = contentImgs;
      payload.thumbnail_url  = contentImgs[0];
    }

    const { data, error } = await db.from('posts').insert(payload).select('id').single();
    if (error) throw error;
    location.href = `post.html?id=${data.id}`;

  } catch (err) {
    console.error(err);
    alert('게시에 실패했습니다. 다시 시도해 주세요.');
    btn.disabled = false;
    btn.textContent = '게시하기';
  }
}

// ── 에디터 내용 파싱 ──────────────────────────────────────────────
async function buildContent() {
  const editor    = document.getElementById('ccEditor');
  const clone     = editor.cloneNode(true);
  const origImgs  = Array.from(editor.querySelectorAll('img[data-local="1"]'));
  const cloneImgs = Array.from(clone.querySelectorAll('img[data-local="1"]'));
  const contentImgs = [];

  for (let i = 0; i < origImgs.length; i++) {
    const file = imgFileMap.get(origImgs[i].src);
    if (file) {
      const url = await uploadImage(file);
      contentImgs.push(url);
      cloneImgs[i].replaceWith(`[img:${i}]`);
    } else {
      cloneImgs[i].remove();
    }
  }

  // innerHTML → 텍스트 변환
  let html = clone.innerHTML;
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/p>/gi,   '\n');
  html = html.replace(/<[^>]+>/g,  '');

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const description = tmp.textContent.replace(/\n{3,}/g, '\n\n').trim();

  return { description, contentImgs };
}

async function uploadImage(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/community/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from('thumbnails').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = db.storage.from('thumbnails').getPublicUrl(path);
  return data.publicUrl;
}
