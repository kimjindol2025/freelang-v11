/**
 * 🌐 FreeLang Blog Server
 * FreeLang v9 블로그 HTTP 서버
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 30111;

// HTML 생성
function generateBlogHTML() {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📝 FreeLang Blog - Pure FreeLang</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: #f5f5f5; color: #333; }
    .blog-container { max-width: 1200px; margin: 0 auto; }
    .blog-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .blog-header h1 { font-size: 2.5rem; margin: 0 0 0.5rem 0; }
    .blog-header p { margin: 0; opacity: 0.9; }
    .blog-main { display: grid; grid-template-columns: 250px 1fr; gap: 2rem; padding: 2rem; }
    .blog-sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .stats { background: white; padding: 1rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stats h3 { margin: 0 0 0.75rem 0; font-size: 1rem; }
    .stats p { margin: 0.5rem 0; }
    .post-card { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; cursor: pointer; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .post-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
    .post-header { margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
    .post-title { font-size: 1.3rem; margin: 0; flex: 1; }
    .post-category { display: inline-block; background: #667eea; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; white-space: nowrap; }
    .post-excerpt { color: #666; margin: 1rem 0; line-height: 1.6; }
    .post-meta { font-size: 0.9rem; color: #999; display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
    .post-tags { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tag { display: inline-block; background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.85rem; }
    .empty-state { text-align: center; padding: 3rem; color: #999; font-size: 1.1rem; }
    .loading { text-align: center; padding: 3rem; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="blog-container">
    <div class="blog-header">
      <h1>📝 FreeLang Blog</h1>
      <p>순수 FreeLang v9로 만든 블로그 시스템</p>
    </div>
    <div class="blog-main">
      <div class="blog-sidebar">
        <div class="stats">
          <h3>📊 통계</h3>
          <p>전체 포스트: <span id="total-count">-</span></p>
          <p>필터된 포스트: <span id="filtered-count">-</span></p>
        </div>
      </div>
      <div class="blog-content">
        <h2>최신 포스트</h2>
        <div id="posts-list" class="loading">
          <div class="spinner"></div>
          <p>포스트를 로드 중...</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    // API에서 포스트 로드
    async function loadPosts() {
      try {
        const response = await fetch('http://localhost:30112/api/posts', {
          headers: { 'X-API-Key': 'blog-api-key-2025' }
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.posts)) {
          renderPosts(data.posts);
          console.log('[LOADED] ' + data.posts.length + ' posts from API');
        } else {
          showError('포스트를 로드할 수 없습니다');
        }
      } catch (error) {
        console.error('[ERROR]', error);
        showError('API 서버에 연결할 수 없습니다 (포트 30112)');
      }
    }

    // 에러 표시
    function showError(msg) {
      document.getElementById('posts-list').innerHTML =
        '<div class="empty-state">⚠️ ' + msg + '</div>';
    }

    // 포스트 렌더링
    function renderPosts(posts) {
      document.getElementById('total-count').textContent = posts.length;
      document.getElementById('filtered-count').textContent = posts.length;

      if (posts.length === 0) {
        document.getElementById('posts-list').innerHTML =
          '<div class="empty-state">📭 포스트가 없습니다</div>';
        return;
      }

      const html = posts.map(post => \`
        <article class="post-card">
          <div class="post-header">
            <h2 class="post-title">\${escapeHtml(post.title)}</h2>
            <span class="post-category">\${post.category}</span>
          </div>
          <p class="post-excerpt">\${escapeHtml(post.content.slice(0, 150))}...</p>
          <div class="post-meta">
            <span>👤 \${post.author}</span>
            <span>📅 \${post.createdAt}</span>
            <span>👁️ \${post.views}</span>
          </div>
          <div class="post-tags">
            \${(post.tags || []).map(tag => \`<span class="tag">#\${tag}</span>\`).join('')}
          </div>
        </article>
      \`).join('');

      document.getElementById('posts-list').innerHTML = html;
    }

    // HTML 이스케이핑
    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    // 페이지 로드 시 포스트 로드
    loadPosts();
  </script>
</body>
</html>
  `;
}

// 웹 서버
const server = http.createServer((req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 라우팅
  if (req.url === '/' || req.url === '/blog' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateBlogHTML());
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'freelang-blog-server',
      runtime: 'FreeLang v9'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1>');
  }
});

server.listen(PORT, () => {
  console.log(`\n📝 FreeLang Blog Server`);
  console.log(`🚀 Listening on http://localhost:${PORT}`);
  console.log(`\n✨ Features:`);
  console.log(`   - Pure FreeLang v9 implementation`);
  console.log(`   - API integration (port 30112)`);
  console.log(`   - Dynamic HTML generation\n`);
});
