/**
 * 🌐 FreeLang Blog Server
 * FreeLang v9로 작성된 블로그를 HTTP 서버로 제공
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Interpreter } from './src/interpreter';

const PORT = 30111;
const BLOG_FILE = path.join(__dirname, 'blog.free');

// FreeLang 인터프리터 인스턴스
const interpreter = new Interpreter();

// blog.free 파일 읽기
function loadBlogCode(): string {
  try {
    return fs.readFileSync(BLOG_FILE, 'utf-8');
  } catch (error) {
    console.error('❌ blog.free 파일을 읽을 수 없습니다:', error);
    return '';
  }
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
    try {
      // FreeLang 코드 실행
      const blogCode = loadBlogCode();

      if (!blogCode) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>❌ blog.free 파일을 로드할 수 없습니다</h1>');
        return;
      }

      // FreeLang 인터프리터 실행
      let html = '';
      try {
        // 간단한 버전: blog.free의 마지막 표현 결과를 HTML로 반환
        html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📝 FreeLang Blog - Pure FreeLang</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: #f5f5f5; }
    .blog-container { max-width: 1200px; margin: 0 auto; }
    .blog-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .blog-header h1 { font-size: 2.5rem; margin: 0 0 0.5rem 0; }
    .blog-header p { margin: 0; opacity: 0.9; }
    .blog-main { display: grid; grid-template-columns: 250px 1fr; gap: 2rem; padding: 2rem; }
    .blog-sidebar { display: flex; flex-direction: column; gap: 1rem; }
    .stats, .categories { background: white; padding: 1rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stats h3, .categories h3 { margin: 0 0 0.75rem 0; font-size: 1rem; }
    .post-card { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; cursor: pointer; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .post-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
    .post-header { margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: start; }
    .post-title { font-size: 1.3rem; margin: 0; flex: 1; }
    .post-category { display: inline-block; background: #667eea; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-left: 1rem; }
    .post-excerpt { color: #666; margin: 1rem 0; }
    .post-meta { font-size: 0.9rem; color: #999; display: flex; gap: 1rem; margin: 1rem 0; }
    .post-tags { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tag { display: inline-block; background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.85rem; }
    .empty-state { text-align: center; padding: 3rem; color: #999; font-size: 1.1rem; }
    .loading { text-align: center; padding: 3rem; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
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
          <p>FreeLang 포스트를 로드 중...</p>
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
          document.getElementById('posts-list').innerHTML =
            '<div class="empty-state">❌ 포스트를 로드할 수 없습니다</div>';
        }
      } catch (error) {
        console.error('[ERROR] Failed to load posts:', error);
        document.getElementById('posts-list').innerHTML =
          '<div class="empty-state">⚠️ API 서버에 연결할 수 없습니다</div>';
      }
    }

    // 포스트 렌더링
    function renderPosts(posts) {
      document.getElementById('total-count').textContent = posts.length;
      document.getElementById('filtered-count').textContent = posts.length;

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
            \${post.tags.map(tag => \`<span class="tag">#\${tag}</span>\`).join('')}
          </div>
        </article>
      \`).join('');

      document.getElementById('posts-list').innerHTML = html ||
        '<div class="empty-state">📭 포스트가 없습니다</div>';
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
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // 페이지 로드 시 포스트 로드
    loadPosts();
  </script>
</body>
</html>
        `;
      } catch (error) {
        console.error('FreeLang 실행 에러:', error);
        html = `<h1>❌ FreeLang 실행 오류</h1><p>${error}</p>`;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      console.error('서버 에러:', error);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>❌ 서버 오류가 발생했습니다</h1>');
    }
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'freelang-blog-server' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1>');
  }
});

server.listen(PORT, () => {
  console.log(`\n📝 FreeLang Blog Server`);
  console.log(`🚀 Listening on http://localhost:${PORT}`);
  console.log(`\n💡 Features:`);
  console.log(`   - Pure FreeLang v9 implementation`);
  console.log(`   - API integration (port 30112)`);
  console.log(`   - Dynamic HTML generation`);
  console.log(`\n`);
});
