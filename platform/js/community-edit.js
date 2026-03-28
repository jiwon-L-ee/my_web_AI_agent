// community-edit.js

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_MB = 10;

let currentUser = null;
let postId = null;
const imgFileMap = new Map();   // blobUrl → File
let selectedImg  = null;

(async () => {
  const params = new URLSearchParams(location.search);
  postId = params.get('id');
  if (!postId) { location.href = 'index.html?cat=커뮤니티'; return; }

  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  await loadPost();
  setupEditor();
  setupForm();
})();

// ── 기존 게시물 로드 ──────────────────────────────────────────────
async function loadPost() {
  const { data, error } = await db
    .from('posts')
    .select('id,title,description,content_images,user_id,category')
    .eq('id', postId)
    .single();

  if (error || !data || data.category !== '커뮤니티') {
    location.href = 'index.html?cat=커뮤니티';
    return;
  }
  if (data.user_id !== currentUser.id) {
    alert('수정 권한이 없습니다.');
    location.href = `post.html?id=${postId}`;
    return;
  }

  // 제목 채우기
  document.getElementById('ceTitle').value = data.title ?? '';

  // 에디터에 기존 내용 복원: [img:N] → 실제 이미지
  const editor = document.getElementById('ceEditor');
  const contentImages = data.content_images ?? [];
  const desc = data.description ?? '';

  if (desc) {
    const parts = desc.split(/(\[img:\d+\])/g);
    let html = '';
    for (const part of parts) {
      const m = part.match(/^\[img:(\d+)\]$/);
      if (m) {
        const url = contentImages[parseInt(m[1], 10)];
        if (url) {
          html += `<img src="${escapeHtml(url)}" data-existing="1" alt="첨부 이미지">`;
        }
      } else if (part) {
        html += escapeHtml(part).replace(/\n/g, '<br>');
      }
    }
    editor.innerHTML = html;
  }

  checkReady();
}

// ── 에디터 ────────────────────────────────────────────────────────
function setupEditor() {
  const editor   = document.getElementById('ceEditor');
  const imgInput = document.getElementById('ceImgInput');
  const floatDel = document.getElementById('imgFloatDel');

  imgInput.addEventListener('change', e => {
    Array.from(e.target.files).forEach(insertFile);
    e.target.value = '';
  });

  editor.addEventListener('dragover', e => { e.preventDefault(); editor.classList.add('drag-over'); });
  editor.addEventListener('dragleave', () => editor.classList.remove('drag-over'));
  editor.addEventListener('drop', e => {
    e.preventDefault();
    editor.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(insertFile);
  });

  editor.addEventListener('paste', e => {
    const imgItem = Array.from(e.clipboardData?.items ?? []).find(it => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      insertFile(imgItem.getAsFile());
    }
  });

  editor.addEventListener('click', e => {
    if (e.target.tagName === 'IMG') selectImg(e.target);
    else deselectImg();
  });

  floatDel.addEventListener('mousedown', e => e.preventDefault());
  floatDel.addEventListener('click', () => {
    if (selectedImg) {
      selectedImg.remove();
      deselectImg();
      checkReady();
    }
  });

  editor.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImg) {
      e.preventDefault();
      selectedImg.remove();
      deselectImg();
      checkReady();
    }
  });

  window.addEventListener('scroll', updateFloatDel, { passive: true });
  window.addEventListener('resize', updateFloatDel, { passive: true });

  editor.addEventListener('input', checkReady);
}

function insertFile(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) { alert('JPG·PNG·GIF·WebP만 가능합니다.'); return; }
  if (file.size > MAX_MB * 1024 * 1024) { alert(`${MAX_MB}MB 이하 이미지만 가능합니다.`); return; }

  const blobUrl = URL.createObjectURL(file);
  imgFileMap.set(blobUrl, file);

  const editor = document.getElementById('ceEditor');
  editor.focus();
  document.execCommand('insertHTML', false,
    `<img src="${blobUrl}" data-local="1" alt="첨부 이미지">`
  );
  checkReady();
}

function selectImg(img) {
  document.getElementById('ceEditor').querySelectorAll('img').forEach(i => i.classList.remove('img-sel'));
  img.classList.add('img-sel');
  selectedImg = img;
  updateFloatDel();
}

function deselectImg() {
  if (selectedImg) selectedImg.classList.remove('img-sel');
  selectedImg = null;
  document.getElementById('imgFloatDel').classList.remove('visible');
}

function updateFloatDel() {
  const floatDel = document.getElementById('imgFloatDel');
  if (!selectedImg || !document.getElementById('ceEditor').contains(selectedImg)) {
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
  const title  = document.getElementById('ceTitle').value.trim();
  const editor = document.getElementById('ceEditor');
  const hasContent = editor.innerText.trim() || editor.querySelector('img');
  document.getElementById('ceSubmitBtn').disabled = !(title && hasContent);
}

// ── 폼 ───────────────────────────────────────────────────────────
function setupForm() {
  document.getElementById('ceTitle').addEventListener('input', checkReady);
  document.getElementById('ceCancelBtn').addEventListener('click', () => {
    location.href = `post.html?id=${postId}`;
  });
  document.getElementById('ceSubmitBtn').addEventListener('click', handleSubmit);
}

async function handleSubmit() {
  const btn = document.getElementById('ceSubmitBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '수정 중...';

  try {
    const title = document.getElementById('ceTitle').value.trim();
    const { description, contentImgs } = await buildContent();

    const payload = {
      title,
      description,
      edited_at: new Date().toISOString(),
    };

    if (contentImgs.length) {
      payload.content_images = contentImgs;
      payload.thumbnail_url  = contentImgs[0];
    } else {
      payload.content_images = null;
      payload.thumbnail_url  = null;
    }

    const { error } = await db
      .from('posts')
      .update(payload)
      .eq('id', postId)
      .eq('user_id', currentUser.id);

    if (error) throw error;
    location.href = `post.html?id=${postId}`;

  } catch (err) {
    console.error(err);
    alert('수정에 실패했습니다. 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '수정하기';
  }
}

// ── 에디터 내용 파싱 ──────────────────────────────────────────────
async function buildContent() {
  const editor    = document.getElementById('ceEditor');
  const clone     = editor.cloneNode(true);
  // 에디터 순서대로 모든 img 처리 (기존 + 신규)
  const origImgs  = Array.from(editor.querySelectorAll('img'));
  const cloneImgs = Array.from(clone.querySelectorAll('img'));
  const contentImgs = [];

  for (let i = 0; i < origImgs.length; i++) {
    const orig = origImgs[i];
    if (orig.dataset.local === '1') {
      // 새로 추가한 이미지 → 업로드
      const file = imgFileMap.get(orig.src);
      if (file) {
        const url = await uploadImage(file);
        contentImgs.push(url);
        cloneImgs[i].replaceWith(`[img:${contentImgs.length - 1}]`);
      } else {
        cloneImgs[i].remove();
      }
    } else if (orig.dataset.existing === '1') {
      // 기존 이미지 → URL 그대로 유지
      contentImgs.push(orig.src);
      cloneImgs[i].replaceWith(`[img:${contentImgs.length - 1}]`);
    } else {
      cloneImgs[i].remove();
    }
  }

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
