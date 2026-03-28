// quiz.js — 퀴즈 플레이어 (OX / 객관식 / 단답형 / 주관식)

const QUIZ_TYPE_LABELS = {
  ox:         'O/X 퀴즈',
  multiple:   '객관식',
  short:      '단답형',
  subjective: '주관식',
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const postId   = new URLSearchParams(location.search).get('id');
let post       = null;
let questions  = [];
let current    = 0;   // 현재 문제 인덱스
let answered   = false;

// 채점용 (주관식은 점수 미집계)
let correctCount = 0;
let wrongCount   = 0;
let subjectiveCount = 0;

async function init() {
  if (!postId) { location.href = 'index.html'; return; }

  initAuth();

  const [postRes, qRes] = await Promise.all([
    db.from('posts').select('*,profiles(id,username)').eq('id', postId).single(),
    db.from('quiz_questions').select('*').eq('post_id', postId).order('order_num'),
  ]);

  document.getElementById('quizLoading').style.display = 'none';

  if (postRes.error || !postRes.data) {
    document.getElementById('quizMain').innerHTML =
      '<p style="text-align:center;padding:60px;color:var(--text-muted)">퀴즈를 찾을 수 없습니다.</p>';
    document.getElementById('quizMain').style.display = '';
    return;
  }

  post      = postRes.data;
  questions = qRes.data ?? [];

  document.title = `${post.title} | 맞불 퀴즈`;

  if (!questions.length) {
    document.getElementById('quizMain').innerHTML =
      '<div class="quiz-empty"><p style="font-size:2rem">📭</p><p>등록된 문제가 없습니다.</p></div>';
    document.getElementById('quizMain').style.display = '';
    return;
  }

  // 헤더 세팅
  document.getElementById('quizTitle').textContent = post.title;
  const typeBadge = document.getElementById('quizTypeBadge');
  typeBadge.textContent   = QUIZ_TYPE_LABELS[post.quiz_type] ?? post.quiz_type ?? '퀴즈';
  typeBadge.className     = `quiz-type-badge type-${post.quiz_type ?? 'ox'}`;

  document.getElementById('quizMain').style.display = '';
  setupEventListeners();
  renderQuestion();
}

// ── 이벤트 리스너 ──
function setupEventListeners() {
  // OX 버튼 (이벤트 위임)
  document.getElementById('oxOptions').addEventListener('click', e => {
    const btn = e.target.closest('.ox-btn');
    if (!btn || answered) return;
    submitOX(btn.dataset.answer);
  });

  // 객관식 버튼 (이벤트 위임)
  document.getElementById('multipleOptions').addEventListener('click', e => {
    const btn = e.target.closest('.multiple-btn');
    if (!btn || answered) return;
    submitMultiple(btn.dataset.index);
  });

  // 단답형 제출
  document.getElementById('textSubmitBtn').addEventListener('click', () => {
    if (answered) return;
    submitText();
  });
  document.getElementById('textAnswer').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !answered) submitText();
  });

  // 주관식 제출
  document.getElementById('subjectiveSubmitBtn').addEventListener('click', () => {
    if (answered) return;
    submitSubjective();
  });

  // 다음 문제
  document.getElementById('nextBtn').addEventListener('click', () => {
    current++;
    answered = false;
    if (current >= questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  });
}

// ── 문제 렌더링 ──
function renderQuestion() {
  const q = questions[current];
  answered = false;

  // 진행도
  const pct = ((current) / questions.length) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent  = `${current + 1} / ${questions.length}`;
  document.getElementById('questionNumber').textContent = `문제 ${current + 1}`;
  document.getElementById('questionText').textContent   = q.question_text;

  // 문제 이미지 — src 속성으로만 제어 (CSS: [src]:not([src=""]) { display:block })
  const qImg = document.getElementById('questionImage');
  if (qImg) qImg.src = q.image_url ?? '';

  // 피드백 초기화
  const feedback = document.getElementById('answerFeedback');
  feedback.style.display = 'none';
  feedback.className     = 'answer-feedback';
  document.getElementById('feedbackIcon').textContent  = '';
  document.getElementById('feedbackText').textContent  = '';
  document.getElementById('correctAnswerReveal').style.display = 'none';
  document.getElementById('correctAnswerReveal').innerHTML = '';

  // 모든 �션 영역 숨김
  document.getElementById('oxOptions').style.display         = 'none';
  document.getElementById('multipleOptions').style.display   = 'none';
  document.getElementById('textOption').style.display        = 'none';
  document.getElementById('subjectiveOption').style.display  = 'none';

  // 유형별 렌더링
  const quizType = post.quiz_type;

  if (quizType === 'ox') {
    renderOX();
  } else if (quizType === 'multiple') {
    renderMultiple(q);
  } else if (quizType === 'short') {
    renderText();
  } else if (quizType === 'subjective') {
    renderSubjective();
  }
}

function renderOX() {
  const wrap = document.getElementById('oxOptions');
  wrap.style.display = '';
  wrap.querySelectorAll('.ox-btn').forEach(b => {
    b.classList.remove('selected');
    b.disabled = false;
  });
}

function renderMultiple(q) {
  const wrap = document.getElementById('multipleOptions');
  wrap.style.display = '';
  const opts = q.options ?? [];
  wrap.innerHTML = opts.map((o, i) => `
    <button class="multiple-btn" data-index="${i}">
      <span class="multiple-label">${OPTION_LABELS[i] ?? (i + 1)}</span>
      <span>${escapeHtml(o.text)}</span>
    </button>`).join('');
}

function renderText() {
  const wrap = document.getElementById('textOption');
  wrap.style.display = '';
  const input = document.getElementById('textAnswer');
  input.value = '';
  input.disabled = false;
  document.getElementById('textSubmitBtn').disabled = false;
  setTimeout(() => input.focus(), 50);
}

function renderSubjective() {
  const wrap = document.getElementById('subjectiveOption');
  wrap.style.display = '';
  const ta = document.getElementById('subjectiveAnswer');
  ta.value = '';
  ta.disabled = false;
  document.getElementById('subjectiveSubmitBtn').disabled = false;
  setTimeout(() => ta.focus(), 50);
}

// ── 제출 로직 ──
function submitOX(answer) {
  if (answered) return;
  answered = true;

  const q = questions[current];
  const correct = q.correct_answers ?? [];
  const isCorrect = correct.some(a => a.toUpperCase() === answer.toUpperCase());

  // 버튼 상태
  document.getElementById('oxOptions').querySelectorAll('.ox-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === answer) b.classList.add('selected');
  });

  showFeedback(isCorrect, correct, false);
}

function submitMultiple(indexStr) {
  if (answered) return;
  answered = true;

  const q    = questions[current];
  const opts = q.options ?? [];
  const idx  = parseInt(indexStr, 10);
  const isCorrect = opts[idx]?.is_correct === true;

  const wrap = document.getElementById('multipleOptions');
  wrap.querySelectorAll('.multiple-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === idx) btn.classList.add(isCorrect ? 'correct' : 'wrong');
    if (opts[i]?.is_correct) btn.classList.add('correct');
  });

  const correctTexts = opts.filter(o => o.is_correct).map(o => o.text);
  showFeedback(isCorrect, correctTexts, false);
}

function submitText() {
  const input   = document.getElementById('textAnswer');
  const userAns = input.value.trim();
  if (!userAns) return;
  if (answered) return;
  answered = true;

  input.disabled = true;
  document.getElementById('textSubmitBtn').disabled = true;

  const q      = questions[current];
  const correct = (q.correct_answers ?? []).map(a => a.trim().toLowerCase());
  const isCorrect = correct.includes(userAns.toLowerCase());

  showFeedback(isCorrect, q.correct_answers ?? [], false);
}

function submitSubjective() {
  const ta = document.getElementById('subjectiveAnswer');
  if (!ta.value.trim()) return;
  if (answered) return;
  answered = true;

  ta.disabled = true;
  document.getElementById('subjectiveSubmitBtn').disabled = true;

  const q = questions[current];
  subjectiveCount++;

  showFeedbackSubjective(q.correct_answers ?? []);
}

// ── 피드백 표시 ──
function showFeedback(isCorrect, correctAnswers, isSubjective) {
  if (isCorrect) correctCount++;
  else wrongCount++;

  const feedback = document.getElementById('answerFeedback');
  feedback.style.display = '';
  feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;

  document.getElementById('feedbackIcon').textContent = isCorrect ? '✓' : '✗';
  document.getElementById('feedbackText').textContent = isCorrect ? '정답입니다!' : '틀렸습니다';

  if (!isCorrect && correctAnswers.length) {
    const reveal = document.getElementById('correctAnswerReveal');
    reveal.style.display = '';
    reveal.innerHTML = `정답: <strong>${correctAnswers.map(a => escapeHtml(a)).join(' / ')}</strong>`;
  }

  updateNextBtn();
}

function showFeedbackSubjective(modelAnswers) {
  const feedback = document.getElementById('answerFeedback');
  feedback.style.display = '';
  feedback.className = 'answer-feedback subjective-reveal';

  document.getElementById('feedbackIcon').textContent = '📝';
  document.getElementById('feedbackText').textContent  = '모범답안';

  if (modelAnswers.length) {
    const reveal = document.getElementById('correctAnswerReveal');
    reveal.style.display = '';
    reveal.innerHTML = modelAnswers.map(a => `<div style="margin:4px 0">${escapeHtml(a)}</div>`).join('');
  }

  updateNextBtn();
}

function updateNextBtn() {
  const nextBtn = document.getElementById('nextBtn');
  const isLast  = current === questions.length - 1;
  nextBtn.textContent = isLast ? '결과 보기' : '다음 문제';
}

// ── 결과 화면 ──
function showResult() {
  document.getElementById('quizMain').style.display   = 'none';
  document.getElementById('quizResult').style.display = '';

  // 진행 바 100%
  document.getElementById('progressFill').style.width = '100%';

  const scored  = questions.length - subjectiveCount;
  const scorePct = scored > 0 ? Math.round((correctCount / scored) * 100) : 0;

  document.getElementById('resultScore').textContent      = `${scorePct}%`;
  document.getElementById('resultScoreDenom').textContent =
    subjectiveCount > 0
      ? `(${correctCount}/${scored}문제 정답, 주관식 ${subjectiveCount}문제 제외)`
      : `${correctCount} / ${scored} 정답`;

  const msg = scorePct === 100 ? '완벽합니다!' :
              scorePct >= 80  ? '훌륭해요!' :
              scorePct >= 60  ? '잘 했어요!' :
              scorePct >= 40  ? '조금 더 공부해볼까요?' : '다시 도전해봐요!';
  document.getElementById('resultMessage').textContent = msg;
  document.getElementById('resultSub').textContent     = `${questions.length}문제를 모두 풀었습니다.`;

  // 상세 집계
  const breakdown = document.getElementById('resultBreakdown');
  let html = `
    <div class="result-stat">
      <div class="result-stat-num correct-num">${correctCount}</div>
      <div class="result-stat-label">정답</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-num wrong-num">${wrongCount}</div>
      <div class="result-stat-label">오답</div>
    </div>`;
  if (subjectiveCount > 0) {
    html += `
    <div class="result-stat">
      <div class="result-stat-num" style="color:var(--text-muted)">${subjectiveCount}</div>
      <div class="result-stat-label">주관식</div>
    </div>`;
  }
  breakdown.innerHTML = html;

  document.getElementById('resultPostLink').href = `post.html?id=${postId}`;
}

init();
