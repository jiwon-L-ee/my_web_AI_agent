// Supabase 클라이언트 초기화
// 사용법: 이 파일을 supabase.js로 복사한 후 실제 값을 입력하세요.
//   cp platform/js/supabase.example.js platform/js/supabase.js

const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
