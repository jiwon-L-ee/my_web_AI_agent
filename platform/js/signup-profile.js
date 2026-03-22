// signup-profile.js — 가입 후 프로필 설정 페이지
// depends on: supabase.js (db), auth.js (getUser, requireAuth, escapeHtml)

let currentUser = null;
let selectedAvatarFile = null;

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  // 이미 프로필 설정 완료한 유저는 홈으로
  const { data: profile } = await db
    .from('profiles')
    .select('profile_completed')
    .eq('id', currentUser.id)
    .single();

  if (profile?.profile_completed) {
    location.href = 'index.html';
    return;
  }

  initNavbar();
  initAvatarUpload();
  initForm();
}

function initNavbar() {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;
  navAuth.innerHTML = `<span style="font-size:0.82rem;color:var(--text-muted)">프로필 설정 중</span>`;
}

function initAvatarUpload() {
  const previewArea = document.getElementById('avatarPreviewArea');
  const uploadBtn = document.getElementById('avatarUploadBtn');
  const avatarInput = document.getElementById('avatarInput');
  const previewImg = document.getElementById('avatarPreviewImg');
  const placeholder = document.getElementById('avatarPlaceholder');

  function triggerFileSelect() {
    avatarInput.click();
  }

  previewArea.addEventListener('click', triggerFileSelect);
  previewArea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') triggerFileSelect();
  });
  uploadBtn.addEventListener('click', triggerFileSelect);

  avatarInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMsg('이미지 크기는 5MB 이하여야 합니다.', 'error');
      this.value = '';
      return;
    }

    selectedAvatarFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewImg.classList.add('visible');
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAvatar(userId) {
  if (!selectedAvatarFile) return null;

  const ext = selectedAvatarFile.name.split('.').pop().toLowerCase();
  const filePath = `avatars/${userId}/profile.${ext}`;

  const { error } = await db.storage
    .from('thumbnails')
    .upload(filePath, selectedAvatarFile, { upsert: true });

  if (error) throw new Error('사진 업로드에 실패했습니다: ' + error.message);

  const { data: urlData } = db.storage
    .from('thumbnails')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

function initForm() {
  const form = document.getElementById('profileSetupForm');
  const skipBtn = document.getElementById('setupSkipBtn');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('setupSubmitBtn');
    const username = document.getElementById('setupUsername').value.trim();
    const bio = document.getElementById('setupBio').value.trim();

    if (!username) {
      showMsg('닉네임을 입력해주세요.', 'error');
      return;
    }
    if (username.length < 2) {
      showMsg('닉네임은 2자 이상이어야 합니다.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    showMsg('', '');

    try {
      let avatarUrl = null;
      if (selectedAvatarFile) {
        avatarUrl = await uploadAvatar(currentUser.id);
      }

      const updates = {
        username,
        bio: bio || null,
        profile_completed: true,
      };
      if (avatarUrl) updates.avatar_url = avatarUrl;

      const { error } = await db
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) throw error;

      showMsg('프로필이 저장되었습니다! 잠시 후 이동합니다.', 'success');
      setTimeout(() => { location.href = 'index.html'; }, 1200);
    } catch (err) {
      showMsg(err.message || '저장에 실패했습니다. 다시 시도해주세요.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '프로필 저장하고 시작하기';
    }
  });

  skipBtn.addEventListener('click', function() {
    location.href = 'index.html';
  });
}

function showMsg(text, type) {
  const msg = document.getElementById('setupMsg');
  msg.textContent = text;
  msg.className = 'setup-msg' + (type ? ' ' + type : '');
}

init();
