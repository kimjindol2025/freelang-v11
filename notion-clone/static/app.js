// v9-Notion App Shell (Phase 7)
// 로그인, 토큰 관리, 페이지 트리, 네비게이션

class NotionApp {
  constructor() {
    this.token = localStorage.getItem('notion_token');
    this.userId = localStorage.getItem('notion_user_id');
    this.workspaceId = localStorage.getItem('notion_workspace_id');
    this.currentPageId = null;
    this.currentPage = null;
    this.ws = null;
    this.pages = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();

    if (this.token) {
      // 토큰 검증
      const valid = await this.validateToken();
      if (valid) {
        this.showApp();
        await this.loadWorkspace();
        this.connectWebSocket();
      } else {
        this.showLoginModal();
      }
    } else {
      this.showLoginModal();
    }
  }

  setupEventListeners() {
    // 로그인
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // 가입
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    }

    // 모달 토글
    document.getElementById('signup-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('signup-modal').classList.remove('hidden');
    });

    document.getElementById('login-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('signup-modal').classList.add('hidden');
      document.getElementById('login-modal').classList.remove('hidden');
    });

    // 새 페이지
    document.getElementById('new-page-btn')?.addEventListener('click', () => this.createNewPage());

    // 검색 (Cmd+K)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.showSearchModal();
      }
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token, data.user_id);
        this.showApp();
        await this.loadWorkspace();
        this.connectWebSocket();
      } else {
        alert('로그인 실패');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('로그인 중 오류 발생');
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const name = document.getElementById('signup-name').value;
    const password = document.getElementById('signup-password').value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token, data.user_id);
        this.showApp();
        await this.loadWorkspace();
        this.connectWebSocket();
      } else {
        alert('가입 실패');
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('가입 중 오류 발생');
    }
  }

  setToken(token, userId) {
    this.token = token;
    this.userId = userId;
    localStorage.setItem('notion_token', token);
    localStorage.setItem('notion_user_id', userId);
  }

  async validateToken() {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  showLoginModal() {
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }

  showApp() {
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('signup-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  async loadWorkspace() {
    try {
      // 워크스페이스 목록 가져오기 (기본값: 첫 번째)
      const wsResponse = await fetch('/api/workspaces', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (!wsResponse.ok) {
        console.error('Failed to load workspaces');
        return;
      }

      const wsData = await wsResponse.json();
      if (!wsData.workspaces || wsData.workspaces.length === 0) {
        // 새 워크스페이스 생성
        await this.createDefaultWorkspace();
        return;
      }

      this.workspaceId = wsData.workspaces[0].id;
      localStorage.setItem('notion_workspace_id', this.workspaceId);

      // 페이지 트리 가져오기
      await this.loadPages();
    } catch (err) {
      console.error('Workspace load error:', err);
    }
  }

  async createDefaultWorkspace() {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ name: '내 워크스페이스' })
      });

      if (response.ok) {
        const data = await response.json();
        this.workspaceId = data.id;
        localStorage.setItem('notion_workspace_id', this.workspaceId);
      }
    } catch (err) {
      console.error('Create workspace error:', err);
    }
  }

  async loadPages() {
    try {
      const response = await fetch(
        `/api/pages?workspace_id=${this.workspaceId}`,
        { headers: { 'Authorization': `Bearer ${this.token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        this.pages = data.pages || [];
        this.renderPageTree();

        // 첫 페이지를 기본으로 로드
        if (this.pages.length > 0) {
          await this.loadPage(this.pages[0].id);
        }
      }
    } catch (err) {
      console.error('Load pages error:', err);
    }
  }

  renderPageTree() {
    const treeContainer = document.getElementById('page-tree');
    treeContainer.innerHTML = '';

    this.pages.forEach(page => {
      const item = this.createPageTreeItem(page, 0);
      treeContainer.appendChild(item);
    });
  }

  createPageTreeItem(page, level) {
    const div = document.createElement('div');
    div.className = 'page-item';
    if (page.id === this.currentPageId) {
      div.classList.add('active');
    }
    div.style.paddingLeft = `${level * 12}px`;
    div.dataset.pageId = page.id;

    const icon = document.createElement('span');
    icon.className = 'page-icon';
    icon.textContent = page.icon || '📄';

    const title = document.createElement('span');
    title.className = 'page-title';
    title.textContent = page.title || '제목 없음';

    div.appendChild(icon);
    div.appendChild(title);

    div.addEventListener('click', () => this.loadPage(page.id));

    return div;
  }

  async loadPage(pageId) {
    try {
      const response = await fetch(
        `/api/pages/${pageId}`,
        { headers: { 'Authorization': `Bearer ${this.token}` } }
      );

      if (response.ok) {
        this.currentPageId = pageId;
        this.currentPage = await response.json();

        // 사이드바 활성화 업데이트
        document.querySelectorAll('.page-item').forEach(item => {
          if (item.dataset.pageId === pageId) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });

        // 에디터 로드
        window.notionEditor?.loadPage(this.currentPage);
      }
    } catch (err) {
      console.error('Load page error:', err);
    }
  }

  async createNewPage() {
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          workspace_id: this.workspaceId,
          title: '제목 없음',
          icon: '📄'
        })
      });

      if (response.ok) {
        const data = await response.json();
        await this.loadPages();
        await this.loadPage(data.id);
      }
    } catch (err) {
      console.error('Create page error:', err);
    }
  }

  showSearchModal() {
    const modal = document.getElementById('search-modal');
    modal.classList.remove('hidden');
    const input = document.getElementById('search-input');
    input.focus();

    input.addEventListener('input', (e) => this.performSearch(e.target.value));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.classList.add('hidden');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  async performSearch(query) {
    if (!query) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&workspace_id=${this.workspaceId}`,
        { headers: { 'Authorization': `Bearer ${this.token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        this.renderSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  renderSearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-result-item">검색 결과 없음</div>';
      return;
    }

    results.forEach(result => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `<span>${result.icon || '📄'}</span> ${result.title}`;
      item.addEventListener('click', () => {
        this.loadPage(result.id);
        document.getElementById('search-modal').classList.add('hidden');
      });
      resultsContainer.appendChild(item);
    });
  }

  connectWebSocket() {
    if (!this.currentPageId) return;

    const wsUrl = `ws://localhost:4001?page_id=${this.currentPageId}&token=${this.token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      console.log('WebSocket connected');
    });

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.handleWSMessage(message);
    });

    this.ws.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      // 재연결 시도 (5초 후)
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
    });
  }

  handleWSMessage(message) {
    if (message.type === 'block_created') {
      // 블록 생성 이벤트
      window.notionEditor?.addBlock(message.block_id);
    } else if (message.type === 'block_updated') {
      // 블록 업데이트 이벤트
      window.notionEditor?.updateBlock(message.block_id, message.data);
    } else if (message.type === 'user_joined') {
      // 사용자 접속 이벤트
      console.log('User joined:', message.user_id);
    }
  }
}

// 앱 초기화
window.notionApp = new NotionApp();
