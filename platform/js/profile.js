// profile.js — other user's public profile

let currentUser = null;
const profileId = new URLSearchParams(location.search).get('id');
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (profileId && !_UUID_RE.test(profileId)) { location.href = 'index.html'; }

async function init() {
  if (!profileId) { location.href = 'index.html'; return; }

  currentUser = await getUser();
  initAuth();

  await Promise.all([loadProfile(), loadUserPosts()]);
}

async function loadProfile() {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error || !data || data.is_admin) {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileContent').innerHTML = '<p style="text-align:center;padding:60px;color:var(--text-muted)">프로필을 찾을 수 없습니다.</p>';
    document.getElementById('profileContent').style.display = '';
    return;
  }

  document.title = `${data.username ?? '유저'} | 맞불`;

  const avatarEl = document.getElementById('profileAvatar');
  if (data.avatar_url) {
    avatarEl.src = data.avatar_url;
  } else {
    avatarEl.style.display = 'none';
    document.getElementById('profileAvatarPlaceholder').textContent = (data.username ?? '?')[0].toUpperCase();
    document.getElementById('profileAvatarPlaceholder').style.display = '';
  }

  document.getElementById('profileName').textContent = data.username ?? '이름 없음';
  document.getElementById('profileBio').textContent = data.bio ?? '';

  // Stats
  const [postsRes, followersRes, followingRes] = await Promise.all([
    db.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', profileId),
    db.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profileId),
    db.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId),
  ]);
  document.getElementById('statPosts').textContent = postsRes.count ?? 0;
  const followersEl = document.getElementById('statFollowers');
  followersEl.textContent = followersRes.count ?? 0;
  followersEl.dataset.raw = followersRes.count ?? 0;  // 원시값 보존 (fmtNum 포맷 파싱 오류 방지)
  document.getElementById('statFollowing').textContent = followingRes.count ?? 0;

  // Follow button
  if (currentUser && currentUser.id !== profileId) {
    const followBtnWrap = document.getElementById('followBtnWrap');
    followBtnWrap.style.display = '';

    const { data: followData } = await db.from('follows')
      .select('follower_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profileId)
      .maybeSingle();

    let isFollowing = !!followData;
    const followBtn = document.getElementById('followBtn');
    updateFollowBtn(followBtn, isFollowing);

    followBtn.addEventListener('click', async () => {
      if (!currentUser) { location.href = 'login.html'; return; }
      if (isFollowing) {
        await db.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profileId);
        isFollowing = false;
      } else {
        await db.from('follows').insert({ follower_id: currentUser.id, following_id: profileId });
        isFollowing = true;
      }
      updateFollowBtn(followBtn, isFollowing);
      const followersEl2 = document.getElementById('statFollowers');
      const cnt = parseInt(followersEl2.dataset.raw ?? '0', 10);
      const newCnt = isFollowing ? cnt + 1 : Math.max(0, cnt - 1);
      followersEl2.dataset.raw = newCnt;
      followersEl2.textContent = newCnt;
    });
  }

  document.getElementById('profileLoading').style.display = 'none';
  document.getElementById('profileContent').style.display = '';
}

function updateFollowBtn(btn, isFollowing) {
  if (isFollowing) {
    btn.textContent = '팔로잉';
    btn.className = 'btn-unfollow';
  } else {
    btn.textContent = '팔로우';
    btn.className = 'btn-follow';
  }
}

async function loadUserPosts() {
  const { data } = await db
    .from('posts')
    .select('id,title,category,thumbnail_url,view_count,created_at,likes(count),comments(count)')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });

  const grid = document.getElementById('userPostsGrid');
  if (!data?.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12c0 1.1.9 2 2 2h8"/><polyline points="22,15 18,19 16,17"/></svg></div><p>게시물이 없습니다.</p></div>`;
    return;
  }

  grid.innerHTML = data.map(post => {
    const likeCount = post.likes?.[0]?.count ?? 0;
    const commentCount = post.comments?.[0]?.count ?? 0;
    return `
      <a href="post.html?id=${post.id}" class="card">
        <div class="card-thumb-wrap">
          ${post.thumbnail_url
            ? `<img class="card-thumb" src="${escapeHtml(post.thumbnail_url)}" alt="" loading="lazy">`
            : `<div class="card-thumb-placeholder"><svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="7" cy="9" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><circle cx="15" cy="9" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><circle cx="11" cy="15" r="3" stroke="currentColor" stroke-width="1.3" opacity="0.6"/><line x1="7" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="7" y1="9" x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="15" y1="9" x2="11" y2="15" stroke="currentColor" stroke-width="1" opacity="0.4"/></svg></div>`
          }
          <span class="badge badge-${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
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
      </a>`;
  }).join('');
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

init();
