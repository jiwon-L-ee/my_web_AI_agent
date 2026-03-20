// create.js — post creation

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_THUMB_SIZE_MB = 2;

let currentUser = null;
let thumbnailFile = null;

// 카테고리 변경에 따른 필드 표시/숨김 — init() 밖에서 즉시 실행
(function() {
  const categorySelect = document.getElementById('categorySelect');
  const modelUrlGroup  = document.getElementById('modelUrlGroup');
  const modelUrlInput  = document.getElementById('modelUrlInput');
  const optionAGroup   = document.getElementById('optionAGroup');
  const optionBGroup   = document.getElementById('optionBGroup');
  const optionALabel   = document.getElementById('optionALabel');
  const optionBLabel   = document.getElementById('optionBLabel');

  function toggleCategoryFields() {
    const cat = categorySelect.value;
    const isTest = cat === '테스트';
    const isVote = cat === '밸런스게임' || cat === 'OX퀴즈';

    modelUrlGroup.style.display = isTest ? '' : 'none';
    modelUrlInput.required = isTest;
    if (!isTest) {
      modelUrlInput.value = '';
      document.getElementById('modelUrlHint').textContent = 'Teachable Machine에서 모델을 학습시킨 후 공유 링크를 붙여넣어 주세요.';
      document.getElementById('modelUrlHint').style.color = '';
    }

    optionAGroup.style.display = isVote ? '' : 'none';
    optionBGroup.style.display = isVote ? '' : 'none';

    if (cat === 'OX퀴즈') {
      optionALabel.textContent = 'O 주장';
      optionBLabel.textContent = 'X 주장';
    } else {
      optionALabel.textContent = 'A 선택지';
      optionBLabel.textContent = 'B 선택지';
    }
  }

  categorySelect.addEventListener('change', toggleCategoryFields);
  toggleCategoryFields(); // 초기 상태 적용
})();

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  document.getElementById('thumbInput').addEventListener('change', handleThumbChange);
  document.getElementById('createForm').addEventListener('submit', handleSubmit);
  document.getElementById('cancelBtn').addEventListener('click', () => history.back());
  document.getElementById('modelUrlInput').addEventListener('blur', validateModelUrl);
}

function handleThumbChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 파일 타입 검증
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    alert('JPG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.');
    e.target.value = '';
    return;
  }

  // 파일 크기 검증 (2MB)
  if (file.size > MAX_THUMB_SIZE_MB * 1024 * 1024) {
    alert(`썸네일은 ${MAX_THUMB_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
    e.target.value = '';
    return;
  }

  thumbnailFile = file;

  const preview = document.getElementById('thumbPreview');
  const img = document.getElementById('thumbPreviewImg');
  const reader = new FileReader();
  reader.onload = ev => {
    img.src = ev.target.result;
    preview.style.display = '';
  };
  reader.readAsDataURL(file);
}

function validateModelUrl() {
  const val = document.getElementById('modelUrlInput').value.trim();
  const hint = document.getElementById('modelUrlHint');
  if (!val) { hint.textContent = ''; return; }
  if (!val.includes('teachablemachine.withgoogle.com/models/')) {
    hint.textContent = '⚠️ Teachable Machine 모델 URL 형식이 아닙니다.';
    hint.style.color = 'var(--accent)';
  } else {
    hint.textContent = '✓ 올바른 형식입니다.';
    hint.style.color = '#4caf50';
  }
}

async function uploadThumbnail(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from('thumbnails').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = db.storage.from('thumbnails').getPublicUrl(path);
  return data.publicUrl;
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const title = document.getElementById('titleInput').value.trim();
    const description = document.getElementById('descInput').value.trim();
    const category = document.getElementById('categorySelect').value;
    let modelUrl = null;
    if (category === '테스트') {
      modelUrl = document.getElementById('modelUrlInput').value.trim();
      if (!modelUrl.endsWith('/')) modelUrl += '/';
    }

    let thumbnailUrl = null;
    if (thumbnailFile) thumbnailUrl = await uploadThumbnail(thumbnailFile);

    let optionA = null;
    let optionB = null;
    if (category === '밸런스게임' || category === 'OX퀴즈') {
      optionA = document.getElementById('optionAInput').value.trim() || null;
      optionB = document.getElementById('optionBInput').value.trim() || null;
    }

    const { data, error } = await db.from('posts').insert({
      user_id: currentUser.id,
      title,
      description,
      category,
      model_url: modelUrl,
      thumbnail_url: thumbnailUrl,
      option_a: optionA,
      option_b: optionB,
    }).select('id').single();

    if (error) throw error;
    location.href = `post.html?id=${data.id}`;
  } catch (err) {
    console.error(err);
    alert('게시물 저장에 실패했습니다. 다시 시도해주세요.');
    btn.disabled = false;
    btn.textContent = '게시하기';
  }
}

init();
