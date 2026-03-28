// create.js — 게시물 작성 (밸런스게임 / 퀴즈 / 테스트 / 커뮤니티)

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_THUMB_SIZE_MB   = 2;
const OPTION_LABELS       = ['A', 'B', 'C', 'D'];

let currentUser      = null;
let thumbnailFile    = null;        // 퀴즈/테스트 썸네일
let currentQuizType  = 'ox';        // ox | multiple | short | subjective
let communityImages  = [];          // 커뮤니티 드래그앤드롭 이미지 배열
let selectedDays     = 3;           // [BALANCE:GAME_MAX_DAYS] 밸런스게임 기간 (기본 3일, 최대 7일) → docs/balance.md 참고

// [BALANCE:GAME_CREATE_BASE] 기본 비용: 3일 = 20 크레딧
// [BALANCE:GAME_CREATE_PER_DAY] 기간 추가 1일당 비용: 5 크레딧
// ※ 변경 시 create.html #durationRow 버튼 텍스트도 함께 수정 → docs/balance.md 참고
function calcDurationCost(days) {
  return 20 + (days - 3) * 5;
}

// [BALANCE:QUIZ_CREATE_COST] 퀴즈 생성 비용: 20 크레딧
// [BALANCE:TEST_CREATE_COST] 테스트 생성 비용: 20 크레딧
const QUIZ_CREATE_COST = 20;
const TEST_CREATE_COST = 20;

// 각 문제 객체: { questionText, correctAnswer(ox), options(multiple), answers(short/subjective), imageFile? }
let questions = [];

// ── 카테고리 탭 토글 (IIFE — init() 전 즉시 실행) ──────────────
(function () {
  const catTabs        = document.getElementById('catTabs');
  const categorySelect = document.getElementById('categorySelect');
  const formTitle      = document.getElementById('formTitle');
  const balanceFields  = document.getElementById('balanceFields');
  const quizFields     = document.getElementById('quizFields');
  const testFields     = document.getElementById('testFields');
  const simpleFields   = document.getElementById('simpleFields');
  const communityImg   = document.getElementById('communityImgGroup');
  const infoThumb      = document.getElementById('infoThumbGroup');

  const titles = {
    밸런스게임: '밸런스게임 만들기',
    퀴즈:       '퀴즈 만들기',
    테스트:     '테스트 만들기',
    커뮤니티:   '커뮤니티 글 작성',
  };

  function toggleCategoryFields() {
    const cat         = categorySelect.value;
    const isBalance   = cat === '밸런스게임';
    const isQuiz      = cat === '퀴즈';
    const isTest      = cat === '테스트';
    const isCommunity = cat === '커뮤니티';
    const isSimple    = isCommunity;

    if (balanceFields) balanceFields.style.display = isBalance ? '' : 'none';
    if (quizFields)    quizFields.style.display    = isQuiz    ? '' : 'none';
    if (testFields)    testFields.style.display    = isTest    ? '' : 'none';
    if (simpleFields)  simpleFields.style.display  = isSimple  ? '' : 'none';

    // 커뮤니티: 이미지 첨부
    if (communityImg) communityImg.style.display = isCommunity ? '' : 'none';
    if (infoThumb)    infoThumb.style.display    = 'none';

    // 테스트 URL 필수
    const modelUrlInput = document.getElementById('modelUrlInput');
    if (modelUrlInput) modelUrlInput.required = isTest;

    formTitle.textContent = titles[cat] ?? '새 게시물 만들기';
  }

  // 탭 클릭 이벤트
  catTabs.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    catTabs.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    categorySelect.value = tab.dataset.cat;
    toggleCategoryFields();
    updateCreditReceipt();
    // 썸네일 파일 초기화
    thumbnailFile = null;
  });

  toggleCategoryFields();
})();

// ── 퀴즈 유형 버튼 ───────────────────────────────────────────────
(function () {
  const quizTypeRow = document.getElementById('quizTypeRow');
  if (!quizTypeRow) return;

  quizTypeRow.addEventListener('click', e => {
    const btn = e.target.closest('.quiz-type-btn');
    if (!btn) return;
    quizTypeRow.querySelectorAll('.quiz-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentQuizType = btn.dataset.type;
    questions = [];
    renderQuestionList();
  });
})();

// ── 썸네일 드롭존 이벤트 설정 ─────────────────────────────────────
function setupThumbZone(zoneId, inputId) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

// ── init ─────────────────────────────────────────────────────────
async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  // 썸네일 change 이벤트
  const thumbInputTest = document.getElementById('thumbInputTest');
  if (thumbInputTest) {
    thumbInputTest.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImgTest', 'thumbPreviewTest'));
  }
  const thumbInputQuiz = document.getElementById('thumbInputQuiz');
  if (thumbInputQuiz) {
    thumbInputQuiz.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImgQuiz', 'thumbPreviewQuiz'));
  }
  const thumbInputInfo = document.getElementById('thumbInputInfo');
  if (thumbInputInfo) {
    thumbInputInfo.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImgInfo', 'thumbPreviewInfo'));
  }

  // 썸네일 드롭존 이벤트 (클릭/드래그앤드롭)
  setupThumbZone('thumbZoneQuiz', 'thumbInputQuiz');
  setupThumbZone('thumbZoneTest', 'thumbInputTest');

  // 썸네일 삭제 버튼
  document.querySelectorAll('.thumb-preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      thumbnailFile = null;
      const inputEl = document.getElementById(btn.dataset.input);
      if (inputEl) inputEl.value = '';
      const box = btn.closest('.thumb-preview-box');
      if (box) {
        box.style.display = 'none';
        const img = box.querySelector('img');
        if (img) img.src = '';
      }
    });
  });

  document.getElementById('createForm').addEventListener('submit', handleSubmit);
  document.getElementById('cancelBtn').addEventListener('click', () => history.back());

  const modelUrlInput = document.getElementById('modelUrlInput');
  if (modelUrlInput) modelUrlInput.addEventListener('blur', validateModelUrl);

  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  setupQuestionListEvents();
  setupCommunityImgEvents();
  setupDurationButtons();
  updateCreditReceipt();

  // 약관 체크박스
  ['termsCheck1', 'termsCheck2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateSubmitBtn);
  });
}

function updateSubmitBtn() {
  const t1 = document.getElementById('termsCheck1')?.checked;
  const t2 = document.getElementById('termsCheck2')?.checked;
  const btn = document.getElementById('submitBtn');
  if (btn) btn.disabled = !(t1 && t2);
}

// ── 크레딧 계산서 ────────────────────────────────────────────────
function updateCreditReceipt() {
  const receipt   = document.getElementById('creditReceipt');
  const rowsEl    = document.getElementById('creditReceiptRows');
  const totalEl   = document.getElementById('creditReceiptTotal');
  if (!receipt || !rowsEl || !totalEl) return;

  const cat = document.getElementById('categorySelect')?.value;
  let rows  = [];
  let total = 0;

  if (cat === '밸런스게임') {
    const base  = 20;
    const extra = (selectedDays - 3) * 5;
    rows.push({ label: `기본 (3일)`, val: base });
    if (extra > 0) rows.push({ label: `추가 기간 (+${selectedDays - 3}일)`, val: extra });
    total = base + extra;
  } else if (cat === '퀴즈') {
    rows.push({ label: '퀴즈 생성', val: QUIZ_CREATE_COST });
    total = QUIZ_CREATE_COST;
  } else if (cat === '테스트') {
    rows.push({ label: '테스트 생성', val: TEST_CREATE_COST });
    total = TEST_CREATE_COST;
  } else {
    receipt.classList.remove('visible');
    return;
  }

  rowsEl.innerHTML = rows.map(r =>
    `<div class="credit-receipt-row">
      <span class="row-label">${r.label}</span>
      <span class="row-val">${r.val} 크레딧</span>
    </div>`
  ).join('<hr class="credit-receipt-divider">');
  totalEl.textContent = `${total} 크레딧`;
  receipt.classList.add('visible');
}

// ── 밸런스게임 기간 선택 ───────────────────────────────────────────
function setupDurationButtons() {
  const row = document.getElementById('durationRow');
  if (!row) return;

  // 기본값(3일) 활성화
  const defaultBtn = row.querySelector('[data-days="3"]');
  if (defaultBtn) defaultBtn.classList.add('active');

  row.addEventListener('click', e => {
    const btn = e.target.closest('.duration-btn');
    if (!btn) return;
    row.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDays = parseInt(btn.dataset.days, 10);
    updateCreditReceipt();
  });
}

// ── 커뮤니티 이미지 ───────────────────────────────────────────────
function setupCommunityImgEvents() {
  const dropZone  = document.getElementById('communityImgDrop');
  const fileInput = document.getElementById('communityImgInput');
  if (!dropZone) return;

  dropZone.addEventListener('click', () => fileInput?.click());
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleCommunityFiles(e.dataTransfer.files);
  });
  fileInput?.addEventListener('change', e => handleCommunityFiles(e.target.files));

  document.getElementById('communityImgPreview')?.addEventListener('click', e => {
    const btn = e.target.closest('.img-preview-remove');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    communityImages.splice(idx, 1);
    renderCommunityPreview();
  });
}

function handleCommunityFiles(files) {
  Array.from(files).forEach(f => {
    if (!f.type.startsWith('image/')) return;
    communityImages.push(f);
  });
  renderCommunityPreview();
}

function renderCommunityPreview() {
  const preview = document.getElementById('communityImgPreview');
  if (!preview) return;
  preview.innerHTML = communityImages.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="img-preview-item">
      <img src="${escapeHtml(url)}" alt="">
      <button type="button" class="img-preview-remove" data-idx="${i}" aria-label="삭제">×</button>
    </div>`;
  }).join('');
}

// ── 썸네일 ────────────────────────────────────────────────────────
function handleThumbChange(e, previewImgId, previewContainerId) {
  const file = e.target.files[0];
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    alert('JPG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.');
    e.target.value = '';
    return;
  }
  if (file.size > MAX_THUMB_SIZE_MB * 1024 * 1024) {
    alert(`썸네일은 ${MAX_THUMB_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
    e.target.value = '';
    return;
  }

  thumbnailFile = file;
  const reader  = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById(previewImgId);
    const box = document.getElementById(previewContainerId);
    if (img) img.src = ev.target.result;
    if (box) box.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function validateModelUrl() {
  const val  = document.getElementById('modelUrlInput')?.value.trim();
  const hint = document.getElementById('modelUrlHint');
  if (!val || !hint) return;
  if (!val.includes('teachablemachine.withgoogle.com/models/')) {
    hint.textContent = '⚠️ Teachable Machine 모델 URL 형식이 아닙니다.';
    hint.style.color = 'var(--accent)';
  } else {
    hint.textContent = '✓ 올바른 형식입니다.';
    hint.style.color = '#4caf50';
  }
}

async function uploadThumbnail(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from('thumbnails').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = db.storage.from('thumbnails').getPublicUrl(path);
  return data.publicUrl;
}

// ── 문제 빌더 ─────────────────────────────────────────────────────
function addQuestion() {
  questions.push(buildEmptyQuestion());
  renderQuestionList();
}

function buildEmptyQuestion() {
  if (currentQuizType === 'ox')         return { questionText: '', correctAnswer: 'O' };
  if (currentQuizType === 'multiple')   return { questionText: '', options: ['', '', '', ''], correctIndex: 0 };
  if (currentQuizType === 'short')      return { questionText: '', answers: [] };
  if (currentQuizType === 'subjective') return { questionText: '', answers: [] };
  return { questionText: '' };
}

function renderQuestionList() {
  const list = document.getElementById('questionList');
  if (!list) return;
  if (!questions.length) { list.innerHTML = ''; return; }
  list.innerHTML = questions.map((q, i) => buildQuestionCardHTML(q, i)).join('');
}

function buildQuestionCardHTML(q, i) {
  const num     = `문제 ${i + 1}`;
  const content = buildQuestionContent(q, i);
  const imgUrl  = q.imageFile ? escapeHtml(URL.createObjectURL(q.imageFile)) : '';
  const imgSection = imgUrl
    ? `<div class="question-img-thumb">
         <img src="${imgUrl}" alt="">
         <button type="button" class="question-img-thumb-del" data-imgdel="${i}" aria-label="이미지 삭제">×</button>
       </div>`
    : `<div class="question-img-zone" data-qidx="${i}">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
         문항 이미지 추가 (선택)
       </div>`;
  return `
    <div class="q-card" data-index="${i}">
      <div class="q-card-header">
        <span class="q-card-num">${num}</span>
        <button type="button" class="q-card-del" data-del="${i}">삭제</button>
      </div>
      <input class="q-text-input" type="text" placeholder="문제를 입력하세요 *"
        value="${escapeHtml(q.questionText)}" data-field="questionText" data-qindex="${i}">
      ${content}
      <div class="question-img-section">
        ${imgSection}
        <input type="file" class="question-img-input" accept="image/*" style="display:none" data-qidx="${i}">
      </div>
    </div>`;
}

function buildQuestionContent(q, i) {
  if (currentQuizType === 'ox') {
    return `
      <div class="ox-answer-row">
        <button type="button" class="ox-answer-btn${q.correctAnswer === 'O' ? ' active-o' : ''}"
          data-ox="O" data-qindex="${i}">O (정답)</button>
        <button type="button" class="ox-answer-btn${q.correctAnswer === 'X' ? ' active-x' : ''}"
          data-ox="X" data-qindex="${i}">X (정답)</button>
      </div>`;
  }
  if (currentQuizType === 'multiple') {
    const opts = q.options ?? ['', '', '', ''];
    return `
      <p class="form-sublabel">선택지를 입력하고 정답에 체크하세요</p>
      <div class="mc-options">
        ${opts.map((opt, oi) => `
          <div class="mc-option-row">
            <span class="mc-option-label">${OPTION_LABELS[oi]}</span>
            <input class="mc-option-input" type="text" placeholder="${OPTION_LABELS[oi]}번 선택지"
              value="${escapeHtml(opt)}" data-option="${oi}" data-qindex="${i}">
            <input class="mc-correct-radio" type="radio" name="correct_${i}"
              value="${oi}" ${q.correctIndex === oi ? 'checked' : ''} data-qindex="${i}">
            <span class="mc-correct-label">정답</span>
          </div>`).join('')}
      </div>
      <p class="correct-hint">정답란에 체크된 항목이 정답으로 저장됩니다.</p>`;
  }
  const label       = currentQuizType === 'short' ? '정답 (복수 가능)' : '모범답안 (복수 가능)';
  const placeholder = currentQuizType === 'short' ? '정답 입력 후 추가' : '모범답안 입력 후 추가';
  const answers     = q.answers ?? [];
  return `
    <p class="form-sublabel">${label}</p>
    <div class="answers-tag-list" data-taglist="${i}">
      ${answers.map((a, ai) => `
        <span class="answer-tag">
          ${escapeHtml(a)}
          <button type="button" class="answer-tag-del" data-tagdel="${ai}" data-qindex="${i}" aria-label="삭제">×</button>
        </span>`).join('')}
    </div>
    <div class="answer-add-row">
      <input class="answer-add-input" type="text" placeholder="${placeholder}" data-answerinput="${i}">
      <button type="button" class="btn-add-answer" data-addanswer="${i}">추가</button>
    </div>`;
}

// questionList 이벤트 위임 — 한 번만 등록
function setupQuestionListEvents() {
  const list = document.getElementById('questionList');
  if (!list) return;

  list.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      questions.splice(parseInt(delBtn.dataset.del, 10), 1);
      renderQuestionList();
      return;
    }
    const oxBtn = e.target.closest('[data-ox]');
    if (oxBtn) {
      const idx = parseInt(oxBtn.dataset.qindex, 10);
      questions[idx].correctAnswer = oxBtn.dataset.ox;
      renderQuestionList();
      return;
    }
    const tagDel = e.target.closest('[data-tagdel]');
    if (tagDel) {
      const qi = parseInt(tagDel.dataset.qindex, 10);
      questions[qi].answers.splice(parseInt(tagDel.dataset.tagdel, 10), 1);
      renderQuestionList();
      return;
    }
    const addAns = e.target.closest('[data-addanswer]');
    if (addAns) {
      const qi    = parseInt(addAns.dataset.addanswer, 10);
      const input = list.querySelector(`[data-answerinput="${qi}"]`);
      addAnswerTag(qi, input);
      return;
    }
    const imgDrop = e.target.closest('.question-img-zone');
    if (imgDrop) {
      list.querySelector(`.question-img-input[data-qidx="${imgDrop.dataset.qidx}"]`)?.click();
      return;
    }
    const imgDel = e.target.closest('.question-img-thumb-del');
    if (imgDel) {
      const qi = parseInt(imgDel.dataset.imgdel, 10);
      if (questions[qi]) questions[qi].imageFile = null;
      renderQuestionList();
      return;
    }
  });

  list.addEventListener('input', e => {
    const qi = e.target.dataset.qindex;
    if (qi === undefined) return;
    const idx = parseInt(qi, 10);
    if (e.target.matches('[data-field="questionText"]')) {
      if (questions[idx]) questions[idx].questionText = e.target.value;
    }
    if (e.target.matches('[data-option]')) {
      if (questions[idx]) questions[idx].options[parseInt(e.target.dataset.option, 10)] = e.target.value;
    }
  });

  list.addEventListener('change', e => {
    const radio = e.target.closest('.mc-correct-radio');
    if (radio) {
      const qi = parseInt(radio.dataset.qindex, 10);
      if (questions[qi]) questions[qi].correctIndex = parseInt(radio.value, 10);
    }
    const imgInput = e.target.closest('.question-img-input');
    if (imgInput) {
      const qi   = parseInt(imgInput.dataset.qidx, 10);
      const file = imgInput.files?.[0];
      if (file && file.type.startsWith('image/') && questions[qi]) {
        questions[qi].imageFile = file;
        renderQuestionList();
      }
    }
  });

  list.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('[data-answerinput]');
    if (!input) return;
    e.preventDefault();
    addAnswerTag(parseInt(input.dataset.answerinput, 10), input);
  });
}

function addAnswerTag(qi, input) {
  const val = input?.value?.trim();
  if (!val) return;
  if (!questions[qi].answers) questions[qi].answers = [];
  questions[qi].answers.push(val);
  input.value = '';
  renderQuestionList();
}

// ── 제출 ──────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const t1 = document.getElementById('termsCheck1');
  const t2 = document.getElementById('termsCheck2');
  if (!t1?.checked || !t2?.checked) {
    alert('게시하려면 모든 약관에 동의해야 합니다.');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled    = true;
  btn.textContent = '저장 중...';

  // 30초 타임아웃 — 네트워크 지연으로 버튼이 무한 멈춤 방지
  const timeoutId = setTimeout(() => {
    btn.disabled    = false;
    btn.textContent = '게시하기';
    alert('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.');
  }, 30000);

  try {
    const title    = document.getElementById('titleInput').value.trim();
    const category = document.getElementById('categorySelect').value;

    // 카테고리별 description input
    let description = '';
    if (category === '밸런스게임') {
      description = document.getElementById('descInput')?.value.trim() || '';
    } else if (category === '테스트') {
      description = document.getElementById('descInputTest')?.value.trim() || '';
    } else {
      // 커뮤니티, 정보
      description = document.getElementById('descInputSimple')?.value.trim() || '';
    }

    // 퀴즈 검증
    if (category === '퀴즈') {
      const resetBtn = () => { clearTimeout(timeoutId); btn.disabled = false; btn.textContent = '게시하기'; };
      if (!questions.length) {
        alert('문제를 최소 1개 이상 추가해주세요.');
        resetBtn(); return;
      }
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].questionText.trim()) {
          alert(`문제 ${i + 1}의 문제 텍스트를 입력해주세요.`);
          resetBtn(); return;
        }
        if (currentQuizType === 'multiple' && (questions[i].options ?? []).some(o => !o.trim())) {
          alert(`문제 ${i + 1}의 모든 선택지를 입력해주세요.`);
          resetBtn(); return;
        }
        if (currentQuizType === 'short' && !(questions[i].answers?.length)) {
          alert(`문제 ${i + 1}의 정답을 최소 1개 추가해주세요.`);
          resetBtn(); return;
        }
      }
    }

    let modelUrl = null;
    if (category === '테스트') {
      modelUrl = document.getElementById('modelUrlInput')?.value.trim() || '';
      if (!modelUrl.endsWith('/')) modelUrl += '/';
    }

    let thumbnailUrl = null;
    if (thumbnailFile) thumbnailUrl = await uploadThumbnail(thumbnailFile);

    // 커뮤니티 이미지 업로드 (병렬)
    let contentImages = [];
    if (category === '커뮤니티' && communityImages.length) {
      contentImages = await Promise.all(communityImages.map(async imgFile => {
        const ext  = imgFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/community/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from('thumbnails').upload(path, imgFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from('thumbnails').getPublicUrl(path);
        return urlData.publicUrl;
      }));
      if (!thumbnailUrl && contentImages.length) thumbnailUrl = contentImages[0];
    }

    let optionA = null;
    let optionB = null;
    if (category === '밸런스게임') {
      optionA = document.getElementById('optionAInput')?.value.trim() || null;
      optionB = document.getElementById('optionBInput')?.value.trim() || null;

      // 크레딧 잔액 확인 (기간별 비용: 3일=20, +1일당 +5 크레딧)
      const requiredCredits = calcDurationCost(selectedDays);
      const { data: balData } = await db.from('credit_balances')
        .select('balance')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      const balance = Number(balData?.balance ?? 0);
      if (balance < requiredCredits) {
        alert(`크레딧이 부족합니다. ${selectedDays}일 게임 생성에 ${requiredCredits} 크레딧이 필요합니다. (현재: ${Math.floor(balance)} 크레딧)`);
        resetBtn(); return;
      }
    }

    if (category === '퀴즈' || category === '테스트') {
      const cost = category === '퀴즈' ? QUIZ_CREATE_COST : TEST_CREATE_COST;
      const { data: balData } = await db.from('credit_balances')
        .select('balance')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      const balance = Number(balData?.balance ?? 0);
      if (balance < cost) {
        alert(`크레딧이 부족합니다. ${category} 생성에 ${cost} 크레딧이 필요합니다. (현재: ${Math.floor(balance)} 크레딧)`);
        resetBtn(); return;
      }
    }

    const postPayload = {
      user_id:       currentUser.id,
      title,
      description,
      category,
      model_url:     modelUrl,
      thumbnail_url: thumbnailUrl,
      option_a:      optionA,
      option_b:      optionB,
    };
    if (contentImages.length) postPayload.content_images = contentImages;
    if (category === '퀴즈') postPayload.quiz_type = currentQuizType;

    // 밸런스게임: 만료일(선택 기간) + AB 랜덤 플립
    if (category === '밸런스게임') {
      postPayload.expires_at = new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000).toISOString();
      postPayload.ab_flipped = Math.random() > 0.5;
    }

    const { data, error } = await db.from('posts').insert(postPayload).select('id').single();
    if (error) throw error;

    // 생성 비용 차감 (RPC 사용) — 실패해도 이미 생성된 post로 이동 (중복 생성 방지)
    try {
      if (category === '밸런스게임') {
        const cost = calcDurationCost(selectedDays);
        await db.rpc('spend_credits', { p_amount: cost, p_reason: 'post_create', p_post_id: data.id });
      } else if (category === '퀴즈') {
        await db.rpc('spend_credits', { p_amount: QUIZ_CREATE_COST, p_reason: 'post_create', p_post_id: data.id });
      } else if (category === '테스트') {
        await db.rpc('spend_credits', { p_amount: TEST_CREATE_COST, p_reason: 'post_create', p_post_id: data.id });
      }
    } catch (creditErr) {
      console.error('spend_credits 실패 (post 생성은 완료됨):', creditErr);
    }

    // 퀴즈 문항 저장
    if (category === '퀴즈' && questions.length) {
      // 퀴즈 문항 이미지 병렬 업로드
      const questionImageUrls = await Promise.all(questions.map(async q => {
        if (!q.imageFile) return null;
        const ext  = q.imageFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/quiz/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from('thumbnails').upload(path, q.imageFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from('thumbnails').getPublicUrl(path);
        return urlData.publicUrl;
      }));

      const questionRows = questions.map((q, i) => {
        const row = {
          post_id:       data.id,
          order_num:     i,
          question_text: q.questionText.trim(),
        };
        if (questionImageUrls[i]) row.image_url = questionImageUrls[i];
        if (currentQuizType === 'ox') {
          row.correct_answers = [q.correctAnswer ?? 'O'];
        } else if (currentQuizType === 'multiple') {
          row.options = (q.options ?? []).map((text, oi) => ({
            text,
            is_correct: oi === (q.correctIndex ?? 0),
          }));
        } else {
          row.correct_answers = (q.answers ?? []).map(a => a.trim()).filter(Boolean);
        }
        return row;
      });

      const { error: qErr } = await db.from('quiz_questions').insert(questionRows);
      if (qErr) throw qErr;
    }

    clearTimeout(timeoutId);
    location.href = `post.html?id=${data.id}`;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(err);
    alert('게시물 저장에 실패했습니다. 다시 시도해주세요.');
    btn.disabled    = false;
    btn.textContent = '게시하기';
  }
}

init();
