// test.js — Teachable Machine 테스트 플레이어 (test.html 전용)

const postId = new URLSearchParams(location.search).get('id');
let tmModel     = null;
let uploadedImg = null;

async function init() {
  if (!postId) { location.href = 'index.html'; return; }

  initAuth();

  const { data, error } = await db
    .from('posts')
    .select('id,title,description,model_url')
    .eq('id', postId)
    .eq('category', '테스트')
    .single();

  document.getElementById('testLoading').style.display = 'none';

  if (error || !data) {
    document.getElementById('testMain').innerHTML =
      '<p style="text-align:center;padding:60px;color:var(--text-muted)">테스트를 찾을 수 없습니다.</p>';
    document.getElementById('testMain').style.display = '';
    return;
  }

  document.title = `${data.title} | 맞불`;
  document.getElementById('testTitle').textContent = data.title;

  if (data.description) {
    document.getElementById('testDesc').textContent = data.description;
    document.getElementById('testDesc').style.display = '';
  }

  document.getElementById('backToPost').href = `post.html?id=${postId}`;
  document.getElementById('testMain').style.display = '';

  setupPlayer(data.model_url);
}

function setupPlayer(modelUrl) {
  const uploadArea  = document.getElementById('uploadArea');
  const fileInput   = document.getElementById('fileInput');
  const previewArea = document.getElementById('previewArea');
  const previewImg  = document.getElementById('previewImg');
  const resetBtn    = document.getElementById('resetImgBtn');
  const analyzeBtn  = document.getElementById('analyzeBtn');
  const loadingEl   = document.getElementById('playerLoading');
  const resultSection = document.getElementById('resultSection');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadImgFile(f);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImgFile(fileInput.files[0]);
  });

  resetBtn.addEventListener('click', () => {
    uploadedImg         = null;
    previewImg.src      = '';
    fileInput.value     = '';
    previewArea.style.display   = 'none';
    uploadArea.style.display    = '';
    analyzeBtn.disabled         = true;
    resultSection.style.display = 'none';
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedImg) return;
    analyzeBtn.disabled         = true;
    loadingEl.style.display     = '';
    resultSection.style.display = 'none';

    try {
      if (!tmModel) {
        const url = modelUrl.endsWith('/') ? modelUrl : modelUrl + '/';
        tmModel = await window.tmImage.load(url + 'model.json', url + 'metadata.json');
      }
      const preds = await tmModel.predict(previewImg);
      preds.sort((a, b) => b.probability - a.probability);
      showResult(preds);
    } catch (err) {
      console.error(err);
      alert('분석 중 오류가 발생했습니다. 모델 URL을 확인해주세요.');
    } finally {
      loadingEl.style.display = 'none';
      analyzeBtn.disabled     = false;
    }
  });

  function loadImgFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src              = e.target.result;
      uploadedImg                 = previewImg;
      uploadArea.style.display    = 'none';
      previewArea.style.display   = '';
      analyzeBtn.disabled         = false;
      resultSection.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

function showResult(preds) {
  const top        = preds[0];
  const colorClass = 'grad-a';
  const barClass   = 'conf-a';

  document.getElementById('resultClass').textContent = top.className;
  document.getElementById('resultClass').className   = `result-class ${colorClass}`;

  const bar = document.getElementById('confidenceBar');
  bar.style.width = '0%';
  bar.className   = `confidence-bar ${barClass}`;
  setTimeout(() => { bar.style.width = `${(top.probability * 100).toFixed(1)}%`; }, 50);

  document.getElementById('confidenceText').textContent =
    `신뢰도 ${(top.probability * 100).toFixed(1)}%`;

  const scoresEl = document.getElementById('allScores');
  scoresEl.innerHTML = preds.map((p, i) => `
    <div class="score-row">
      <span class="score-name" title="${escapeHtml(p.className)}">${escapeHtml(p.className)}</span>
      <div class="score-bar-wrap">
        <div class="score-bar${i === 0 ? ' top' : ''}" style="width:${(p.probability * 100).toFixed(1)}%"></div>
      </div>
      <span class="score-pct">${(p.probability * 100).toFixed(1)}%</span>
    </div>`).join('');

  document.getElementById('resultSection').style.display = '';
}

init();
