// mypage.js — authenticated user's own page

let currentUser = null;

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  await Promise.all([loadProfile(), loadStats(), loadCredits(), loadMyPosts()]);

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
    .select('id,title,category,thumbnail_url,view_count,created_at,expires_at,likes(count),comments(count)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const grid = document.getElementById('myPostsGrid');
  if (!data?.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><p>아직 게시물이 없습니다.</p></div>`;
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
        ${!(post.category === '밸런스게임' && post.expires_at && new Date(post.expires_at) <= new Date())
          ? `<button class="btn-del-post" title="삭제" data-id="${post.id}">🗑️</button>`
          : ''}
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
  signup_bonus:     { label: '가입 보너스', cls: 'credit-reason-bonus',    iconCls: 'ci-bonus'    },
  vote_win:         { label: '투표 승리',   cls: 'credit-reason-win',      iconCls: 'ci-win'      },
  creator_reward:   { label: '게임 제작',   cls: 'credit-reason-creator',  iconCls: 'ci-creator'  },
  post_create:      { label: '게임 생성',   cls: 'credit-reason-spend',    iconCls: 'ci-spend'    },
  vote_change:      { label: '투표 변경',   cls: 'credit-reason-spend',    iconCls: 'ci-spend'    },
  rebuttal_comment: { label: '반박 댓글',   cls: 'credit-reason-rebuttal', iconCls: 'ci-rebuttal' },
};

const CREDIT_ICONS = {
  signup_bonus:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  vote_win:         `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  creator_reward:   `<svg width="15" height="20" viewBox="0 0 18 24" fill="currentColor" aria-hidden="true"><path d="M9 23C4 21 1 15 3 9C4.5 5 7 2 7 0C9 3 9 7 8 10C10 7 12 3 11 1C15 5 16 13 14 17C13 20 11 23 9 23Z"/></svg>`,
  post_create:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  vote_change:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  rebuttal_comment: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 17 4 22 4 17"/><path d="M20 4v8a2 2 0 0 1-2 2H4"/></svg>`,
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
    const meta   = CREDIT_REASON_LABELS[item.reason] ?? { label: escapeHtml(item.reason), cls: '', iconCls: 'ci-default' };
    const sign   = item.amount >= 0 ? '+' : '';
    const amtStr = sign + Math.floor(item.amount) + 'C';
    const amtCls = item.amount >= 0 ? 'credit-amount-plus' : 'credit-amount-minus';
    const postLink = item.post_id
      ? `<a href="post.html?id=${escapeHtml(item.post_id)}" class="credit-post-link">게시물 보기 →</a>`
      : '';
    const icon = CREDIT_ICONS[item.reason] ?? CREDIT_ICONS['post_create'];
    return `
      <div class="credit-item">
        <div class="credit-item-icon ${escapeHtml(meta.iconCls)}">${icon}</div>
        <div class="credit-item-body">
          <div class="credit-item-top">
            <span class="credit-reason-badge ${escapeHtml(meta.cls)}">${escapeHtml(meta.label)}</span>
            <span class="credit-amount ${escapeHtml(amtCls)}">${escapeHtml(amtStr)}</span>
          </div>
          <div class="credit-item-bottom">
            <span class="credit-history-date">${escapeHtml(relativeTime(item.created_at))}</span>
            ${postLink}
          </div>
        </div>
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

    const timeoutId = setTimeout(() => {
      if (msg) msg.textContent = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '탈퇴하기';
    }, 30000);

    try {
      // 현재 세션 토큰 가져오기
      const { data: { session } } = await db.auth.getSession();
      if (!session) throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');

      // Edge Function 호출 → service_role로 auth.users 삭제
      const SUPABASE_URL = 'https://mwsfzxhblboskdlffsxi.supabase.co';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '탈퇴 처리에 실패했습니다.');
      }

      // 로컬 세션 정리 후 이동
      await db.auth.signOut();
      alert('탈퇴 처리가 완료되었습니다. 이용해 주셔서 감사합니다.');
      location.href = 'index.html';
    } catch (err) {
      clearTimeout(timeoutId);
      if (msg) msg.textContent = err.message || '처리 중 오류가 발생했습니다. 다시 시도해주세요.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = '탈퇴하기';
    }
  });
}

init();
