// 간단한 게시판 앱
const API_BASE = "http://localhost:5000";
const WS_BASE = "ws://localhost:5001";

class BoardApp {
  constructor() {
    this.token = localStorage.getItem("board_token") || null;
    this.user = localStorage.getItem("board_user") ? JSON.parse(localStorage.getItem("board_user")) : null;
    this.posts = [];
    this.comments = {};
    this.init();
  }

  async init() {
    this.render();
    if (this.token) {
      await this.loadPosts();
    }
  }

  render() {
    const app = document.getElementById("app");

    if (!this.token) {
      app.innerHTML = `
        <div class="auth-container">
          <div class="auth-card">
            <h1>간단한 게시판</h1>
            <div class="tabs">
              <button class="tab-btn active" onclick="app.switchTab('login')">로그인</button>
              <button class="tab-btn" onclick="app.switchTab('register')">회원가입</button>
            </div>

            <div id="login-tab" class="tab-content active">
              <form onsubmit="app.handleLogin(event)">
                <input type="email" placeholder="이메일" id="login-email" required>
                <input type="password" placeholder="비밀번호" id="login-password" required>
                <button type="submit">로그인</button>
              </form>
              <div id="login-error" class="error"></div>
            </div>

            <div id="register-tab" class="tab-content">
              <form onsubmit="app.handleRegister(event)">
                <input type="email" placeholder="이메일" id="register-email" required>
                <input type="text" placeholder="이름" id="register-name" required>
                <input type="password" placeholder="비밀번호" id="register-password" required>
                <button type="submit">회원가입</button>
              </form>
              <div id="register-error" class="error"></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="board-container">
        <div class="board-header">
          <h1>게시판</h1>
          <div class="user-info">
            <span>${this.user.name} (${this.user.email})</span>
            <button onclick="app.handleLogout()">로그아웃</button>
          </div>
        </div>

        <div class="create-post-section">
          <h2>새 글 작성</h2>
          <form onsubmit="app.handleCreatePost(event)">
            <input type="text" placeholder="제목" id="post-title" required>
            <textarea placeholder="내용" id="post-content" required></textarea>
            <button type="submit">작성</button>
          </form>
          <div id="create-error" class="error"></div>
        </div>

        <div class="posts-section">
          <h2>게시글 목록</h2>
          <div id="posts-list" class="posts-list">
            ${this.posts.length === 0 ? "<p class='empty'>게시글이 없습니다</p>" : ""}
          </div>
        </div>
      </div>
    `;

    this.renderPosts();
  }

  renderPosts() {
    const list = document.getElementById("posts-list");
    if (!list) return;

    if (this.posts.length === 0) {
      list.innerHTML = "<p class='empty'>게시글이 없습니다</p>";
      return;
    }

    list.innerHTML = this.posts.map(post => `
      <div class="post-card">
        <div class="post-header">
          <h3>${this.escapeHtml(post.title)}</h3>
          <span class="post-date">${new Date(post.created_at).toLocaleString("ko-KR")}</span>
        </div>
        <p class="post-content">${this.escapeHtml(post.content)}</p>
        <div class="post-actions">
          <button onclick="app.toggleComments(${post.id ? "'" + post.id + "'" : ''})">댓글 보기 (${(this.comments[post.id] || []).length})</button>
          <button onclick="app.handleDeletePost('${post.id}')" class="delete-btn">삭제</button>
        </div>
        <div id="comments-${post.id}" class="comments-section" style="display:none;">
          <h4>댓글</h4>
          <div id="comments-list-${post.id}" class="comments-list"></div>
          <div class="comment-form">
            <textarea placeholder="댓글 작성" id="comment-${post.id}"></textarea>
            <button onclick="app.handleCreateComment('${post.id}')">댓글 작성</button>
          </div>
        </div>
      </div>
    `).join("");
  }

  switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(`${tab}-tab`).classList.add("active");
    document.querySelector(`[onclick*="${tab}"]`).classList.add("active");
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "로그인 실패");

      this.token = data.token;
      this.user = { email: data.email, name: data.name, user_id: data.user_id };
      localStorage.setItem("board_token", this.token);
      localStorage.setItem("board_user", JSON.stringify(this.user));

      await this.loadPosts();
      this.render();
    } catch (err) {
      document.getElementById("login-error").textContent = err.message;
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById("register-email").value;
    const name = document.getElementById("register-name").value;
    const password = document.getElementById("register-password").value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "회원가입 실패");

      this.token = data.token;
      this.user = { email: data.email, name: data.name, user_id: data.user_id };
      localStorage.setItem("board_token", this.token);
      localStorage.setItem("board_user", JSON.stringify(this.user));

      await this.loadPosts();
      this.render();
    } catch (err) {
      document.getElementById("register-error").textContent = err.message;
    }
  }

  handleLogout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("board_token");
    localStorage.removeItem("board_user");
    this.render();
  }

  async loadPosts() {
    try {
      const res = await fetch(`${API_BASE}/api/posts`, {
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!res.ok) throw new Error("게시글 로드 실패");
      const data = await res.json();
      this.posts = data.posts || [];

      for (const post of this.posts) {
        await this.loadComments(post.id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async loadComments(postId) {
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!res.ok) throw new Error("댓글 로드 실패");
      const data = await res.json();
      this.comments[postId] = data.comments || [];
      this.renderComments(postId);
    } catch (err) {
      console.error(err);
    }
  }

  renderComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    const comments = this.comments[postId] || [];
    list.innerHTML = comments.map(comment => `
      <div class="comment">
        <p class="comment-content">${this.escapeHtml(comment.content)}</p>
        <div class="comment-meta">
          <span class="comment-date">${new Date(comment.created_at).toLocaleString("ko-KR")}</span>
          <button onclick="app.handleDeleteComment('${postId}', '${comment.id}')" class="delete-btn">삭제</button>
        </div>
      </div>
    `).join("");
  }

  toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
      section.style.display = section.style.display === "none" ? "block" : "none";
    }
  }

  async handleCreatePost(e) {
    e.preventDefault();
    const title = document.getElementById("post-title").value;
    const content = document.getElementById("post-content").value;

    try {
      const res = await fetch(`${API_BASE}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify({ title, content })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "글 작성 실패");

      document.getElementById("post-title").value = "";
      document.getElementById("post-content").value = "";
      document.getElementById("create-error").textContent = "";

      await this.loadPosts();
      this.renderPosts();
    } catch (err) {
      document.getElementById("create-error").textContent = err.message;
    }
  }

  async handleDeletePost(postId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!res.ok) throw new Error("글 삭제 실패");

      await this.loadPosts();
      this.renderPosts();
    } catch (err) {
      alert(err.message);
    }
  }

  async handleCreateComment(postId) {
    const textarea = document.getElementById(`comment-${postId}`);
    const content = textarea.value;

    if (!content.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify({ content })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "댓글 작성 실패");

      textarea.value = "";
      await this.loadComments(postId);
      this.renderComments(postId);
    } catch (err) {
      alert(err.message);
    }
  }

  async handleDeleteComment(postId, commentId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${this.token}` }
      });

      if (!res.ok) throw new Error("댓글 삭제 실패");

      await this.loadComments(postId);
      this.renderComments(postId);
    } catch (err) {
      alert(err.message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

const app = new BoardApp();
