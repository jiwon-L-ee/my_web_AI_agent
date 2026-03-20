// post.js — post detail, test player, comments

let currentUser = null;
let post = null;
let tmModel = null;
let uploadedImg = null;
let isLiked = false;
let likeId = null;

let voteCountA = 0;
let voteCountB = 0;
let userVote = null; // null | 'A' | 'B'
let isVoting = false;

const postId = new URLSearchParams(location.search).get('id');

async function init() {
  if (!postId) { location.href = 'index.html'; return; }

  currentUser = await getUser();
  initAuth();

  await loadPost();
  await incrementView();
  if (currentUser) await checkLike();
  loadComments();
}

async function loadPost() {
  const { data, error } = await db
    .from('posts')
    .select('*,profiles(id,username,avatar_url),likes(count),comments(count)')
    .eq('id', postId)
    .single();

  if (error || !data) {
    document.getElementById('postLoading').style.display = 'none';
    document.getElementById('postContent').innerHTML = '<p style="text-align:center;padding:60px;color:var(--text-muted)">게시물을 찾을 수 없습니다.</p>';
    document.getElementById('postContent').style.display = '';
    return;
  }

  post = data;
  await renderPost(post);
}

async function renderPost(p) {
  const likeCount = p.likes?.[0]?.count ?? 0;
  const commentCount = p.comments?.[0]?.count ?? 0;
  const author = p.profiles;

  document.title = `${p.title} | 맞불`;

  document.getElementById('postBadge').innerHTML = `<span class="badge badge-${escapeHtml(p.category)}" style="position:static">${escapeHtml(p.category)}</span>`;
  document.getElementById('postTitle').textContent = p.title;

  const avatarEl = document.getElementById('authorAvatar');
  if (author?.avatar_url) {
    avatarEl.src = author.avatar_url;
    avatarEl.alt = `${escapeHtml(author.username ?? '유저')} 아바타`;
    avatarEl.style.display = '';
  } else {
    avatarEl.style.display = 'none';
    document.getElementById('authorAvatarPlaceholder').textContent = (author?.username ?? '?')[0];
    document.getElementById('authorAvatarPlaceholder').style.display = 'flex';
  }

  document.getElementById('authorName').textContent = author?.username ?? '익명';
  document.getElementById('postTime').textContent = relativeTime(p.created_at);
  document.getElementById('viewCount').textContent = p.view_count;
  document.getElementById('likeCount').textContent = likeCount;
  document.getElementById('commentCount').textContent = commentCount;

  document.getElementById('authorLink').href = `profile.html?id=${author?.id}`;

  if (p.description) {
    document.getElementById('postDescription').textContent = p.description;
    document.getElementById('postDescription').style.display = '';
  }

  if (currentUser && currentUser.id === p.user_id) {
    document.getElementById('deleteBtn').style.display = '';
    document.getElementById('deleteBtn').addEventListener('click', deletePost);
  }

  document.getElementById('postContent').style.display = '';
  document.getElementById('postLoading').style.display = 'none';

  const likeBtn = document.getElementById('likeBtn');
  likeBtn.addEventListener('click', toggleLike);

  const isVote = ['밸런스게임', 'OX퀴즈'].includes(p.category);
  document.getElementById('voteSection').style.display = isVote ? '' : 'none';
  document.getElementById('playerSection').style.display = isVote ? 'none' : '';

  if (isVote) {
    await loadVotes(postId);
    renderVoteUI(p);
  } else {
    setupPlayer(p.model_url);
  }
}

async function incrementView() {
  await db.rpc('increment_view_count', { post_id: postId });
}

async function checkLike() {
  const { data } = await db.from('likes').select('id').eq('user_id', currentUser.id).eq('post_id', postId).maybeSingle();
  isLiked = !!data;
  likeId = data?.id ?? null;
  updateLikeBtn();
}

function updateLikeBtn() {
  const btn = document.getElementById('likeBtn');
  btn.classList.toggle('liked', isLiked);
  btn.innerHTML = `${isLiked ? '❤️' : '🤍'} <span id="likeCount">${document.getElementById('likeCount')?.textContent ?? 0}</span>`;
}

async function toggleLike() {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  const countEl = document.getElementById('likeCount');
  const count = parseInt(countEl?.textContent ?? '0');

  if (isLiked) {
    await db.from('likes').delete().eq('id', likeId);
    isLiked = false;
    likeId = null;
    if (countEl) countEl.textContent = Math.max(0, count - 1);
  } else {
    const { data } = await db.from('likes').insert({ user_id: currentUser.id, post_id: postId }).select('id').single();
    isLiked = true;
    likeId = data?.id ?? null;
    if (countEl) countEl.textContent = count + 1;
  }
  updateLikeBtn();
}

async function deletePost() {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await db.from('posts').delete().eq('id', postId);
  location.href = 'index.html';
}

// ── Vote ──
async function loadVotes(pid) {
  const countAQuery = db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', pid).eq('choice', 'A');
  const countBQuery = db.from('votes').select('*', { count: 'exact', head: true }).eq('post_id', pid).eq('choice', 'B');

  const [resA, resB] = await Promise.all([countAQuery, countBQuery]);
  voteCountA = resA.count ?? 0;
  voteCountB = resB.count ?? 0;

  if (currentUser) {
    const { data } = await db.from('votes').select('choice').eq('post_id', pid).eq('user_id', currentUser.id).maybeSingle();
    userVote = data?.choice ?? null;
  }
}

function renderVoteUI(p) {
  document.getElementById('voteChoiceA').textContent = p.option_a || 'A';
  document.getElementById('voteChoiceB').textContent = p.option_b || 'B';

  updateVoteBar();

  // 이벤트 위임: 투표 버튼
  document.getElementById('voteSection').addEventListener('click', e => {
    const btn = e.target.closest('.vote-btn');
    if (!btn) return;
    toggleVote(btn.dataset.choice);
  });
}

async function toggleVote(choice) {
  if (isVoting) return;
  isVoting = true;
  if (!currentUser) {
    isVoting = false;
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }

  try {
    if (userVote === choice) {
      // 같은 선택 재클릭 → 취소
      const { error } = await db.from('votes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
      if (error) { console.error(error); return; }
      if (choice === 'A') voteCountA = Math.max(0, voteCountA - 1);
      else voteCountB = Math.max(0, voteCountB - 1);
      userVote = null;
    } else if (userVote !== null) {
      // 다른 선택으로 변경 → UPDATE
      const { error } = await db.from('votes').update({ choice }).eq('post_id', postId).eq('user_id', currentUser.id);
      if (error) { console.error(error); return; }
      if (choice === 'A') { voteCountA++; voteCountB = Math.max(0, voteCountB - 1); }
      else { voteCountB++; voteCountA = Math.max(0, voteCountA - 1); }
      userVote = choice;
    } else {
      // 신규 투표 → INSERT
      const { error } = await db.from('votes').insert({ post_id: postId, user_id: currentUser.id, choice });
      if (error) { console.error(error); return; }
      if (choice === 'A') voteCountA++;
      else voteCountB++;
      userVote = choice;
    }
    updateVoteBar();
  } finally {
    isVoting = false;
  }
}

function updateVoteBar() {
  const total = voteCountA + voteCountB;
  const pctA = total > 0 ? (voteCountA / total) * 100 : 50;
  const pctB = total > 0 ? (voteCountB / total) * 100 : 50;

  document.getElementById('voteBarA').style.width = pctA + '%';
  document.getElementById('voteBarB').style.width = pctB + '%';
  document.getElementById('voteCountA').textContent = voteCountA + '표';
  document.getElementById('voteCountB').textContent = voteCountB + '표';

  document.querySelector('.vote-btn-a')?.classList.toggle('active', userVote === 'A');
  document.querySelector('.vote-btn-b')?.classList.toggle('active', userVote === 'B');
}

// ── Test Player ──
function setupPlayer(modelUrl) {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const previewArea = document.getElementById('previewArea');
  const previewImg = document.getElementById('previewImg');
  const resetBtn = document.getElementById('resetImgBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingEl = document.getElementById('playerLoading');
  const resultSection = document.getElementById('resultSection');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadImgFile(f, previewImg, uploadArea, previewArea, analyzeBtn, resultSection);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImgFile(fileInput.files[0], previewImg, uploadArea, previewArea, analyzeBtn, resultSection);
  });
  resetBtn.addEventListener('click', () => {
    uploadedImg = null;
    previewImg.src = '';
    fileInput.value = '';
    previewArea.style.display = 'none';
    uploadArea.style.display = '';
    analyzeBtn.disabled = true;
    resultSection.style.display = 'none';
  });

  analyzeBtn.addEventListener('click', async () => {
    if (!uploadedImg) return;
    analyzeBtn.disabled = true;
    loadingEl.style.display = '';
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
      analyzeBtn.disabled = false;
    }
  });
}

function loadImgFile(file, img, uploadArea, previewArea, analyzeBtn, resultSection) {
  const reader = new FileReader();
  reader.onload = e => {
    img.src = e.target.result;
    uploadedImg = img;
    uploadArea.style.display = 'none';
    previewArea.style.display = '';
    analyzeBtn.disabled = false;
    resultSection.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function showResult(preds) {
  const top = preds[0];
  const colorClass = preds.indexOf(top) === 0 ? 'grad-a' : 'grad-b';
  const barClass = preds.indexOf(top) === 0 ? 'conf-a' : 'conf-b';

  document.getElementById('resultClass').textContent = top.className;
  document.getElementById('resultClass').className = `result-class ${colorClass}`;

  const bar = document.getElementById('confidenceBar');
  bar.style.width = '0%';
  bar.className = `confidence-bar ${barClass}`;
  setTimeout(() => { bar.style.width = `${(top.probability * 100).toFixed(1)}%`; }, 50);

  document.getElementById('confidenceText').textContent = `신뢰도 ${(top.probability * 100).toFixed(1)}%`;

  const scoresEl = document.getElementById('allScores');
  scoresEl.innerHTML = preds.map((p, i) => `
    <div class="score-row">
      <span class="score-name" title="${escapeHtml(p.className)}">${escapeHtml(p.className)}</span>
      <div class="score-bar-wrap">
        <div class="score-bar${i === 0 ? ' top' : ''}" style="width:${(p.probability*100).toFixed(1)}%"></div>
      </div>
      <span class="score-pct">${(p.probability*100).toFixed(1)}%</span>
    </div>`).join('');

  document.getElementById('resultSection').style.display = '';
}

// ── Comments ──
async function loadComments() {
  const { data, error } = await db
    .from('comments')
    .select('*,profiles(username,avatar_url),comment_likes(count)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('commentList');
  if (error || !data?.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;text-align:center;padding:20px 0">아직 댓글이 없습니다.</p>';
    return;
  }

  // 내 댓글 좋아요 목록
  let myLikedCommentIds = new Set();
  if (currentUser) {
    const commentIds = data.map(c => c.id);
    const { data: myLikes } = await db
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', currentUser.id)
      .in('comment_id', commentIds);
    if (myLikes) myLikes.forEach(l => myLikedCommentIds.add(l.comment_id));
  }

  const isVotePost = ['밸런스게임', 'OX퀴즈'].includes(post?.category);

  list.innerHTML = data.map(c => {
    const author   = c.profiles;
    const isOwn    = currentUser?.id === c.user_id;
    const likeCount = c.comment_likes?.[0]?.count ?? 0;
    const liked    = myLikedCommentIds.has(c.id);

    const sideBadge = isVotePost && c.side
      ? `<span class="side-badge side-badge-${escapeHtml(c.side.toLowerCase())}">${c.side === 'A' ? '🔵 A진영' : '🟠 B진영'}</span>`
      : '';

    return `
      <div class="comment-item" data-id="${c.id}">
        ${author?.avatar_url
          ? `<img class="comment-avatar" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username ?? '유저')} 아바타">`
          : `<div class="comment-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--surface2);font-size:0.75rem;font-weight:700;">${escapeHtml((author?.username ?? '?')[0])}</div>`
        }
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-author">${escapeHtml(author?.username ?? '익명')}</span>
            ${sideBadge}
            <span class="comment-time">${relativeTime(c.created_at)}</span>
            ${isOwn ? `<button class="btn-del-comment" data-comment-id="${c.id}" aria-label="댓글 삭제">삭제</button>` : ''}
          </div>
          <div class="comment-text">${escapeHtml(c.content)}</div>
          <div style="margin-top:6px">
            <button class="comment-like-btn${liked ? ' liked' : ''}" data-comment-id="${c.id}" aria-label="댓글 좋아요">
              ${liked ? '❤️' : '🤍'} <span class="clk-count">${likeCount}</span>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// 이벤트 위임 — 댓글 좋아요
document.getElementById('commentList')?.addEventListener('click', async e => {
  const likeBtn = e.target.closest('.comment-like-btn');
  if (likeBtn) {
    await toggleCommentLike(likeBtn);
    return;
  }
});

async function toggleCommentLike(btn) {
  if (!currentUser) {
    location.href = 'login.html?next=' + encodeURIComponent(location.href);
    return;
  }
  const commentId = btn.dataset.commentId;
  if (!commentId) return;

  const isLiked  = btn.classList.contains('liked');
  const countEl  = btn.querySelector('.clk-count');
  const count    = parseInt(countEl?.textContent ?? '0');

  if (isLiked) {
    const { error } = await db.from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', currentUser.id);
    if (error) { console.error(error); return; }
    btn.classList.remove('liked');
    btn.innerHTML = `🤍 <span class="clk-count">${Math.max(0, count - 1)}</span>`;
  } else {
    const { error } = await db.from('comment_likes')
      .insert({ comment_id: commentId, user_id: currentUser.id });
    if (error) { console.error(error); return; }
    btn.classList.add('liked');
    btn.innerHTML = `❤️ <span class="clk-count">${count + 1}</span>`;
  }
  btn.dataset.commentId = commentId; // 재삽입 후에도 유지
}

// 이벤트 위임 — 댓글 삭제
document.getElementById('commentList')?.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-del-comment');
  if (!btn) return;
  const id = btn.dataset.commentId;
  if (!id || !confirm('댓글을 삭제하시겠습니까?')) return;
  const { error } = await db.from('comments').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('삭제에 실패했습니다.'); return; }
  loadComments();
});

async function submitComment() {
  const textarea = document.getElementById('commentInput');
  const content = textarea.value.trim();
  if (!content) return;

  const btn = document.getElementById('commentSubmitBtn');
  btn.disabled = true;

  // 밸런스게임/OX퀴즈 — 투표 진영을 side로 자동 태깅
  const side = (['밸런스게임', 'OX퀴즈'].includes(post?.category) && userVote)
    ? userVote
    : null;

  const insertData = { user_id: currentUser.id, post_id: postId, content };
  if (side) insertData.side = side;

  const { error } = await db.from('comments').insert(insertData);
  if (error) {
    alert('댓글 작성에 실패했습니다. 다시 시도해주세요.');
  } else {
    textarea.value = '';
    await loadComments();
  }

  btn.disabled = false;
}

// 이벤트 위임 — 댓글 작성 폼 (비동기로 삽입되므로 부모에 위임)
document.getElementById('commentFormArea')?.addEventListener('click', e => {
  if (e.target.id === 'commentSubmitBtn') submitComment();
});
document.getElementById('commentFormArea')?.addEventListener('keydown', e => {
  if (e.target.id === 'commentInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment();
});

init();
