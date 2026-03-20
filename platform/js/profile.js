// profile.js — other user's public profile

let currentUser = null;
const profileId = new URLSearchParams(location.search).get('id');

async function init() {
  if (!profileId) { location.href = 'index.html'; return; }

  currentUser = await getUser();
  initAuth();

  await loadProfile();
  await loadUserPosts();
}

async function loadProfile() {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error || !data) {
    document.getElementById('profileContent').innerHTML = '<p style="text-align:center;padding:60px;color:var(--text-muted)">프로필을 찾을 수 없습니다.</p>';
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
  document.getElementById('statFollowers').textContent = followersRes.count ?? 0;
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
      const cnt = parseInt(document.getElementById('statFollowers').textContent);
      document.getElementById('statFollowers').textContent = isFollowing ? cnt + 1 : Math.max(0, cnt - 1);
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
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📭</div><p>게시물이 없습니다.</p></div>`;
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
            : `<div class="card-thumb-placeholder">🧠</div>`
          }
          <span class="badge badge-${escapeHtml(post.category)}">${escapeHtml(post.category)}</span>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(post.title)}</div>
          <div class="card-meta">
            <span style="font-size:0.78rem;color:var(--text-muted)">${relativeTime(post.created_at)}</span>
            <div class="card-stats">
              <span class="card-stat">👁 ${fmtNum(post.view_count)}</span>
              <span class="card-stat">❤️ ${fmtNum(likeCount)}</span>
              <span class="card-stat">💬 ${fmtNum(commentCount)}</span>
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
