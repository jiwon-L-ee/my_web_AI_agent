// mypage.js — authenticated user's own page

let currentUser = null;

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  initAuth();

  await loadProfile();
  await loadStats();
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

  const [postsRes, viewsRes, likesRes, followersRes] = await Promise.all([
    db.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
    db.from('posts').select('view_count').eq('user_id', currentUser.id),
    myPostIds.length
      ? db.from('likes').select('id', { count: 'exact', head: true }).in('post_id', myPostIds)
      : Promise.resolve({ count: 0 }),
    db.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', currentUser.id),
  ]);

  const totalViews = (viewsRes.data ?? []).reduce((s, p) => s + (p.view_count ?? 0), 0);

  document.getElementById('statPosts').textContent = postsRes.count ?? 0;
  document.getElementById('statViews').textContent = fmtNum(totalViews);
  document.getElementById('statLikes').textContent = likesRes.count ?? 0;
  document.getElementById('statFollowers').textContent = followersRes.count ?? 0;
}

async function getMyPostIds() {
  const { data } = await db.from('posts').select('id').eq('user_id', currentUser.id);
  return (data ?? []).map(p => p.id);
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

  grid.innerHTML = data.map(post => {
    const likeCount = post.likes?.[0]?.count ?? 0;
    const commentCount = post.comments?.[0]?.count ?? 0;
    return `
      <div class="card" style="position:relative">
        <a href="post.html?id=${post.id}" style="display:block">
          <div class="card-thumb-wrap">
            ${post.thumbnail_url
              ? `<img class="card-thumb" src="${escapeHtml(post.thumbnail_url)}" alt="게시물 썸네일" loading="lazy">`
              : `<div class="card-thumb-placeholder">${post.category === '밸런스게임' ? '⚖️' : post.category === 'OX퀴즈' ? '🔵' : '🧠'}</div>`
            }
            <span class="badge badge-${escapeHtml(post.category)}" style="position:absolute">${escapeHtml(post.category)}</span>
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
        </a>
        <button class="btn-del-post" title="삭제" data-id="${post.id}">🗑️</button>
      </div>`;
  }).join('');
}

async function deletePost(id, btn) {
  if (!confirm('게시물을 삭제하시겠습니까?')) return;
  const { error } = await db.from('posts').delete().eq('id', id);
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

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

init();
