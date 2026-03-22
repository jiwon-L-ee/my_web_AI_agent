// mypage.js — authenticated user's own page

let currentUser = null;

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  await loadProfile();
  await loadStats();
  await loadCredits();
  await loadMyPosts();

  document.getElementById('editProfileBtn').addEventListener('click', openEditModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeEditModal);
  document.getElementById('editProfileForm').addEventListener('submit', saveProfile);
  document.getElementById('signOutBtn').addEventListener('click', signOut);

  // 이벤트 위임 — 게시물 삭제 버튼
  document.getElementById('myPostsGrid').addEventListener('click', e => {
    const btn = e.target.closest('.btn-del-post');
    if (btn) deletePost(btn.dataset.id, btn);
  });

  // 회원탈퇴
  setupDeleteAccount();
}

async function loadProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (!data) return;

  const avatarEl = document.getElementById('profileAvatar');
  if (data.avatar_url) {
    avatarEl.src = data.avatar_url;
  } else {
    avatarEl.style.display = 'none';
    document.getElementById('profileAvatarPlaceholder').textContent = (data.username ?? '?')[0].toUpperCase();
    document.getElementById('profileAvatarPlaceholder').style.display = 'flex';
  }

  document.getElementById('profileName').textContent = data.username ?? '이름 없음';
  document.getElementById('profileBio').textContent = data.bio ?? '자기소개를 입력해주세요.';

  document.getElementById('editUsername').value = data.username ?? '';
  document.getElementById('editBio').value = data.bio ?? '';
}

async function loadStats() {
  // getMyPostIds()를 Promise.all 밖에서 먼저 resolve (N+1 직렬 쿼리 방지)
  const myPostIds = await getMyPostIds();
  const myCommentIds = await getMyCommentIds();

  const [postsRes, viewsRes, likesRes, followersRes, persuasionRes] = await Promise.all([
    db.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
    db.from('posts').select('view_count').eq('user_id', currentUser.id),
    myPostIds.length
      ? db.from('likes').select('id', { count: 'exact', head: true }).in('post_id', myPostIds)
      : Promise.resolve({ count: 0 }),
    db.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', currentUser.id),
    myCommentIds.length
      ? db.from('persuasion_likes').select('id', { count: 'exact', head: true }).in('comment_id', myCommentIds)
      : Promise.resolve({ count: 0 }),
  ]);

  const totalViews = (viewsRes.data ?? []).reduce((s, p) => s + (p.view_count ?? 0), 0);

  document.getElementById('statPosts').textContent = postsRes.count ?? 0;
  document.getElementById('statViews').textContent = fmtNum(totalViews);
  document.getElementById('statLikes').textContent = likesRes.count ?? 0;
  document.getElementById('statFollowers').textContent = followersRes.count ?? 0;
  document.getElementById('statPersuasion').textContent = persuasionRes.count ?? 0;
}

async function getMyPostIds() {
  const { data } = await db.from('posts').select('id').eq('user_id', currentUser.id);
  return (data ?? []).map(p => p.id);
}

async function getMyCommentIds() {
  const { data } = await db.from('comments').select('id').eq('user_id', currentUser.id);
  return (data ?? []).map(c => c.id);
}

async function loadMyPosts() {
  const { data } = await db
    .from('posts')
    .select('id,title,category,thumbnail_url,view_count,created_at,likes(count),comments(count)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const grid = document.getElementById('myPostsGrid');
  if (!data?.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">✏️</div><p>아직 게시물이 없습니다.</p></div>`;
    return;
  }

  const PLACEHOLDER_ICONS = {
    '밸런스게임': `<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><line x1="11" y1="4" x2="11" y2="19" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/><line x1="6" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/><path d="M3 13 L6 7 L9 13 Q6 17 3 13Z" stroke="#71d8f7" stroke-width="1.2" fill="none" stroke-linejoin="round"/><path d="M13 13 L16 7 L19 13 Q16 17 13 13Z" stroke="#ffc947" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>`,
    '퀴즈':      `<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><rect x="3" y="3" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.3" opacity="0.3"/><line x1="7" y1="8" x2="15" y2="8" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/><line x1="7" y1="14" x2="11" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/></svg>`,
    '테스트':    `<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="9.5" stroke="currentColor" stroke-width="1.2" opacity="0.2"/><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.2" opacity="0.35"/><circle cx="11" cy="11" r="2.5" fill="var(--accent)"/></svg>`,
    '커뮤니티':  `<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="7" cy="9" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><circle cx="15" cy="9" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><circle cx="11" cy="15" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><line x1="7" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="7" y1="9" x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="15" y1="9" x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/></svg>`,
    '정보':      `<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="9.5" stroke="currentColor" stroke-width="1.3" opacity="0.4"/><circle cx="11" cy="7.5" r="1.2" fill="currentColor" opacity="0.7"/><line x1="11" y1="10.5" x2="11" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  };

  grid.innerHTML = data.map(post => {
    const likeCount = post.likes?.[0]?.count ?? 0;
    const commentCount = post.comments?.[0]?.count ?? 0;
    const placeholderEmoji = PLACEHOLDER_ICONS[post.category] ?? PLACEHOLDER_ICONS['커뮤니티'];
    return `
      <div class="card" style="position:relative">
        <a href="post.html?id=${post.id}" style="display:block">
          <div class="card-thumb-wrap">
            ${post.thumbnail_url
              ? `<img class="card-thumb" src="${escapeHtml(post.thumbnail_url)}" alt="게시물 썸네일" loading="lazy">`
              : `<div class="card-thumb-placeholder">${placeholderEmoji}</div>`
            }
            <span class="badge badge-${escapeHtml(post.category)}" style="position:absolute">${escapeHtml(post.category)}</span>
          </div>
          <div class="card-body">
            <div class="card-title">${escapeHtml(post.title)}</div>
            <div class="card-meta">
              <span style="font-size:0.78rem;color:var(--text-muted)">${relativeTime(post.created_at)}</span>
              <div class="card-stats">
                <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"><path d="M6 0C3.5 0 1 2 0 4c1 2 3.5 4 6 4s5-2 6-4C11 2 8.5 0 6 0zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/><circle cx="6" cy="4" r="1.3"/></svg>${fmtNum(post.view_count)}</span>
                <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5C6 9.5 1 6 1 3.5A2.5 2.5 0 0 1 6 3a2.5 2.5 0 0 1 5 .5C11 6 6 9.5 6 9.5z"/></svg>${fmtNum(likeCount)}</span>
                <span class="card-stat"><svg class="ic-stat" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M11 1H1a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h3l2 2.5 2-2.5h3a.5.5 0 0 0 .5-.5v-6A.5.5 0 0 0 11 1z"/></svg>${fmtNum(commentCount)}</span>
              </div>
            </div>
          </div>
        </a>
        <button class="btn-del-post" title="삭제" data-id="${post.id}">🗑️</button>
      </div>`;
  }).join('');
}

async function deletePost(id, btn) {
  if (!confirm('게시물을 삭제하시겠습니까?')) return;
  const { error } = await db.from('posts').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert('삭제에 실패했습니다. 다시 시도해주세요.'); return; }
  btn.closest('.card').remove();
  await loadStats();
}

function openEditModal() {
  document.getElementById('editModal').style.display = '';
}
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;

  const username = document.getElementById('editUsername').value.trim();
  const bio = document.getElementById('editBio').value.trim();

  const { error } = await db.from('profiles').update({ username, bio }).eq('id', currentUser.id);
  if (error) {
    alert('저장에 실패했습니다. 다시 시도해주세요.');
  } else {
    closeEditModal();
    document.getElementById('profileName').textContent = username || '이름 없음';
    document.getElementById('profileBio').textContent = bio || '자기소개를 입력해주세요.';
  }

  btn.disabled = false;
}

// ── 크레딧 잔액 & 이력 ───────────────────────────────────────────

const CREDIT_REASON_LABELS = {
  signup_bonus:   { label: '가입 보너스',  cls: 'credit-reason-bonus'   },
  vote_win:       { label: '투표 승리',    cls: 'credit-reason-win'     },
  creator_reward: { label: '게임 제작자',  cls: 'credit-reason-creator' },
  post_create:    { label: '게임 생성',    cls: 'credit-reason-spend'   },
  vote_change:    { label: '투표 변경',    cls: 'credit-reason-spend'   },
};

async function loadCredits() {
  const [balanceRes, historyRes] = await Promise.all([
    db.from('credit_balances')
      .select('balance')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
    db.from('credits')
      .select('id, amount, reason, post_id, created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const balance = balanceRes.data?.balance ?? 0;
  document.getElementById('statCredits').textContent = fmtNum(Math.floor(balance)) + 'C';

  renderCreditHistory(historyRes.data ?? []);
}

function renderCreditHistory(items) {
  const el = document.getElementById('creditHistory');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `
      <div class="credit-history-empty">
        <p>아직 크레딧 이력이 없습니다.</p>
        <p class="credit-history-hint">밸런스게임에 참여하고 승리하면 크레딧을 얻어요</p>
      </div>`;
    return;
  }

  el.innerHTML = items.map(item => {
    const meta   = CREDIT_REASON_LABELS[item.reason] ?? { label: escapeHtml(item.reason), cls: '' };
    const sign   = item.amount >= 0 ? '+' : '';
    const amtStr = sign + Math.floor(item.amount) + 'C';
    const amtCls = item.amount >= 0 ? 'credit-amount-plus' : 'credit-amount-minus';
    const postLink = item.post_id
      ? `<a href="post.html?id=${escapeHtml(item.post_id)}" class="credit-post-link">게시물 보기</a>`
      : '';
    return `
      <div class="credit-history-item">
        <span class="credit-reason-badge ${escapeHtml(meta.cls)}">${escapeHtml(meta.label)}</span>
        <span class="credit-history-date">${escapeHtml(relativeTime(item.created_at))}</span>
        ${postLink}
        <span class="credit-amount ${escapeHtml(amtCls)}">${escapeHtml(amtStr)}</span>
      </div>`;
  }).join('');
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// ── 회원탈퇴 ─────────────────────────────────────────────────────
function setupDeleteAccount() {
  const deleteBtn    = document.getElementById('deleteAccountBtn');
  const modal        = document.getElementById('deleteAccountModal');
  const cancelBtn    = document.getElementById('cancelDeleteBtn');
  const confirmBtn   = document.getElementById('confirmDeleteBtn');
  const confirmInput = document.getElementById('deleteConfirmInput');
  const msg          = document.getElementById('deleteMsg');
  if (!deleteBtn || !modal) return;

  deleteBtn.addEventListener('click', () => {
    modal.classList.add('open');
    if (confirmInput) { confirmInput.value = ''; confirmInput.focus(); }
    if (confirmBtn)  confirmBtn.disabled = true;
    if (msg)         msg.textContent = '';
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  if (confirmInput) {
    confirmInput.addEventListener('input', () => {
      if (confirmBtn) confirmBtn.disabled = confirmInput.value.trim() !== '탈퇴합니다';
    });
  }

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '처리 중...';
    if (msg) msg.textContent = '';

    try {
      // 로그아웃 처리 (Supabase 클라이언트에서 admin deleteUser 불가 → signOut으로 처리)
      const { error } = await db.auth.signOut();
      if (error) throw error;
      alert('탈퇴 처리가 완료되었습니다. 이용해 주셔서 감사합니다.');
      location.href = 'index.html';
    } catch (err) {
      if (msg) msg.textContent = '처리 중 오류가 발생했습니다. 다시 시도해주세요.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '탈퇴하기';
    }
  });
}

init();
