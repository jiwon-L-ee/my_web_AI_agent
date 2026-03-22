// create.js — 게시물 작성 (밸런스게임 / 퀴즈 / 테스트 / 커뮤니티 / 정보)

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_THUMB_SIZE_MB   = 2;
const OPTION_LABELS       = ['A', 'B', 'C', 'D'];

let currentUser      = null;
let thumbnailFile    = null;        // 밸런스게임/테스트/정보 썸네일
let currentQuizType  = 'ox';        // ox | multiple | short | subjective
let communityImages  = [];          // 커뮤니티 드래그앤드롭 이미지 배열

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
    정보:       '정보 글 작성',
  };

  function toggleCategoryFields() {
    const cat         = categorySelect.value;
    const isBalance   = cat === '밸런스게임';
    const isQuiz      = cat === '퀴즈';
    const isTest      = cat === '테스트';
    const isCommunity = cat === '커뮤니티';
    const isInfo      = cat === '정보';
    const isSimple    = isCommunity || isInfo;

    if (balanceFields) balanceFields.style.display = isBalance ? '' : 'none';
    if (quizFields)    quizFields.style.display    = isQuiz    ? '' : 'none';
    if (testFields)    testFields.style.display    = isTest    ? '' : 'none';
    if (simpleFields)  simpleFields.style.display  = isSimple  ? '' : 'none';

    // 커뮤니티: 이미지 첨부 / 정보: 썸네일
    if (communityImg) communityImg.style.display = isCommunity ? '' : 'none';
    if (infoThumb)    infoThumb.style.display    = isInfo      ? '' : 'none';

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

// ── init ─────────────────────────────────────────────────────────
async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  // 썸네일 이벤트 (밸런스게임)
  const thumbInput = document.getElementById('thumbInput');
  if (thumbInput) {
    thumbInput.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImg', 'thumbPreview'));
  }
  // 썸네일 이벤트 (테스트)
  const thumbInputTest = document.getElementById('thumbInputTest');
  if (thumbInputTest) {
    thumbInputTest.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImgTest', 'thumbPreviewTest'));
  }
  // 썸네일 이벤트 (정보)
  const thumbInputInfo = document.getElementById('thumbInputInfo');
  if (thumbInputInfo) {
    thumbInputInfo.addEventListener('change', e => handleThumbChange(e, 'thumbPreviewImgInfo', 'thumbPreviewInfo'));
  }

  document.getElementById('createForm').addEventListener('submit', handleSubmit);
  document.getElementById('cancelBtn').addEventListener('click', () => history.back());

  const modelUrlInput = document.getElementById('modelUrlInput');
  if (modelUrlInput) modelUrlInput.addEventListener('blur', validateModelUrl);

  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  setupQuestionListEvents();
  setupCommunityImgEvents();

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
    if (box) box.style.display = '';
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
        <div class="question-img-drop" data-qidx="${i}" style="cursor:pointer;font-size:0.82rem;color:var(--text-muted);margin-top:8px">
          📷 문항 이미지 추가 (선택사항)
        </div>
        <input type="file" class="question-img-input" accept="image/*" style="display:none" data-qidx="${i}">
        ${imgUrl ? `<img style="max-width:120px;border-radius:6px;margin-top:6px" src="${imgUrl}" alt="">` : ''}
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
    const imgDrop = e.target.closest('.question-img-drop');
    if (imgDrop) {
      list.querySelector(`.question-img-input[data-qidx="${imgDrop.dataset.qidx}"]`)?.click();
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
      if (!questions.length) {
        alert('문제를 최소 1개 이상 추가해주세요.');
        btn.disabled = false; btn.textContent = '게시하기';
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].questionText.trim()) {
          alert(`문제 ${i + 1}의 문제 텍스트를 입력해주세요.`);
          btn.disabled = false; btn.textContent = '게시하기';
          return;
        }
        if (currentQuizType === 'multiple' && (questions[i].options ?? []).some(o => !o.trim())) {
          alert(`문제 ${i + 1}의 모든 선택지를 입력해주세요.`);
          btn.disabled = false; btn.textContent = '게시하기';
          return;
        }
        if (currentQuizType === 'short' && !(questions[i].answers?.length)) {
          alert(`문제 ${i + 1}의 정답을 최소 1개 추가해주세요.`);
          btn.disabled = false; btn.textContent = '게시하기';
          return;
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

    // 커뮤니티 이미지 업로드
    let contentImages = [];
    if (category === '커뮤니티' && communityImages.length) {
      for (const imgFile of communityImages) {
        const ext  = imgFile.name.split('.').pop().toLowerCase();
        const path = `${currentUser.id}/community/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await db.storage.from('thumbnails').upload(path, imgFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from('thumbnails').getPublicUrl(path);
        contentImages.push(urlData.publicUrl);
      }
      if (!thumbnailUrl && contentImages.length) thumbnailUrl = contentImages[0];
    }

    let optionA = null;
    let optionB = null;
    if (category === '밸런스게임') {
      optionA = document.getElementById('optionAInput')?.value.trim() || null;
      optionB = document.getElementById('optionBInput')?.value.trim() || null;

      // 크레딧 잔액 확인 (밸런스게임 생성 비용: 10 크레딧)
      const { data: balData } = await db.from('credit_balances')
        .select('balance')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      const balance = Number(balData?.balance ?? 0);
      if (balance < 10) {
        alert(`크레딧이 부족합니다. 밸런스게임 생성에 10 크레딧이 필요합니다. (현재: ${Math.floor(balance)} 크레딧)`);
        btn.disabled = false; btn.textContent = '게시하기';
        return;
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

    // 밸런스게임: 만료일 + AB 랜덤 플립
    if (category === '밸런스게임') {
      postPayload.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      postPayload.ab_flipped = Math.random() > 0.5;
    }

    const { data, error } = await db.from('posts').insert(postPayload).select('id').single();
    if (error) throw error;

    // 밸런스게임 생성 비용 차감 (-10 크레딧, RPC 사용)
    if (category === '밸런스게임') {
      await db.rpc('spend_credits', { p_amount: 10, p_reason: 'post_create', p_post_id: data.id });
    }

    // 퀴즈 문항 저장
    if (category === '퀴즈' && questions.length) {
      const questionImageUrls = [];
      for (const q of questions) {
        if (q.imageFile) {
          const ext  = q.imageFile.name.split('.').pop().toLowerCase();
          const path = `${currentUser.id}/quiz/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await db.storage.from('thumbnails').upload(path, q.imageFile, { upsert: false });
          if (upErr) throw upErr;
          const { data: urlData } = db.storage.from('thumbnails').getPublicUrl(path);
          questionImageUrls.push(urlData.publicUrl);
        } else {
          questionImageUrls.push(null);
        }
      }

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

    location.href = `post.html?id=${data.id}`;
  } catch (err) {
    console.error(err);
    alert('게시물 저장에 실패했습니다. 다시 시도해주세요.');
    btn.disabled    = false;
    btn.textContent = '게시하기';
  }
}

init();
