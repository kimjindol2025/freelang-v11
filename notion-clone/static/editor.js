// v9-Notion Editor (Phase 7)
// 블록 에디터, 슬래시 메뉴, 데이터베이스 뷰

class NotionEditor {
  constructor() {
    this.currentPage = null;
    this.blocks = [];
    this.selectedBlockId = null;
    this.slashMenuOpen = false;
    this.blockTypes = [
      { name: 'text', label: 'Text', icon: '✏️' },
      { name: 'h1', label: 'Heading 1', icon: '📝' },
      { name: 'h2', label: 'Heading 2', icon: '📝' },
      { name: 'h3', label: 'Heading 3', icon: '📝' },
      { name: 'quote', label: 'Quote', icon: '💬' },
      { name: 'code', label: 'Code', icon: '💻' },
      { name: 'todo', label: 'To-do', icon: '☑️' },
      { name: 'bullet', label: 'Bullet list', icon: '🔹' },
      { name: 'numbered', label: 'Numbered list', icon: '1️⃣' },
      { name: 'divider', label: 'Divider', icon: '─' },
      { name: 'image', label: 'Image', icon: '🖼️' }
    ];
  }

  async loadPage(page) {
    this.currentPage = page;
    const editor = document.getElementById('editor');
    editor.innerHTML = '';

    // 페이지 타이틀 입력
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'page-title-input';
    titleInput.placeholder = '제목 입력...';
    titleInput.value = page.title || '';
    titleInput.addEventListener('change', () => this.updatePageTitle(titleInput.value));
    editor.appendChild(titleInput);

    // 블록 목록 가져오기
    try {
      const response = await fetch(
        `/api/pages/${page.id}/blocks`,
        { headers: { 'Authorization': `Bearer ${window.notionApp.token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        this.blocks = data.blocks || [];
        this.renderBlocks();
      }
    } catch (err) {
      console.error('Load blocks error:', err);
    }
  }

  renderBlocks() {
    const editor = document.getElementById('editor');
    const blocksContainer = editor.querySelector('.blocks-container') || document.createElement('div');
    blocksContainer.className = 'blocks-container';
    blocksContainer.innerHTML = '';

    this.blocks.forEach(block => {
      const blockEl = this.createBlockElement(block);
      blocksContainer.appendChild(blockEl);
    });

    if (!editor.querySelector('.blocks-container')) {
      editor.appendChild(blocksContainer);
    }
  }

  createBlockElement(block) {
    const div = document.createElement('div');
    div.className = 'block';
    div.dataset.blockId = block.id;

    // 드래그 핸들
    const handle = document.createElement('div');
    handle.className = 'block-drag-handle';
    handle.textContent = '⋯⋮';
    handle.draggable = true;

    // 블록 콘텐츠
    const content = document.createElement('div');
    content.className = 'block-content';

    const blockType = block.type || 'text';
    let element;

    switch (blockType) {
      case 'h1':
      case 'h2':
      case 'h3':
        element = document.createElement('input');
        element.type = 'text';
        element.className = `block-text block-${blockType}`;
        element.value = block.content || '';
        break;

      case 'quote':
        element = document.createElement('div');
        element.className = `block-text block-quote`;
        element.contentEditable = true;
        element.textContent = block.content || '';
        break;

      case 'code':
        element = document.createElement('textarea');
        element.className = `block-text block-code`;
        element.value = block.content || '';
        break;

      case 'todo':
        const todoContainer = document.createElement('div');
        todoContainer.className = 'block-todo';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = JSON.parse(block.props || '{}').done || false;
        const todoText = document.createElement('div');
        todoText.className = 'block-text';
        todoText.contentEditable = true;
        todoText.textContent = block.content || '';
        todoContainer.appendChild(checkbox);
        todoContainer.appendChild(todoText);
        element = todoContainer;
        break;

      case 'bullet':
        element = document.createElement('div');
        element.className = 'block-text block-bullet';
        element.contentEditable = true;
        element.textContent = block.content || '';
        break;

      case 'numbered':
        element = document.createElement('div');
        element.className = 'block-text block-numbered';
        element.contentEditable = true;
        element.textContent = block.content || '';
        break;

      case 'divider':
        element = document.createElement('div');
        element.className = 'block-divider';
        break;

      case 'image':
        element = document.createElement('img');
        element.className = 'block-image';
        element.src = block.content || '';
        break;

      default:
        element = document.createElement('div');
        element.className = 'block-text';
        element.contentEditable = true;
        element.textContent = block.content || '';
    }

    content.appendChild(element);
    div.appendChild(handle);
    div.appendChild(content);

    // 이벤트
    element.addEventListener('focus', () => this.selectBlock(block.id));
    element.addEventListener('blur', () => this.saveBlock(block.id, element));
    element.addEventListener('keydown', (e) => this.handleBlockKeydown(e, block.id, element));

    handle.addEventListener('dragstart', (e) => this.handleDragStart(e, block.id));

    return div;
  }

  selectBlock(blockId) {
    document.querySelectorAll('.block').forEach(b => b.classList.remove('selected'));
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    if (blockEl) blockEl.classList.add('selected');
    this.selectedBlockId = blockId;
  }

  async saveBlock(blockId, element) {
    const content = element.textContent || element.value || '';
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return;

    try {
      await fetch(`/api/blocks/${blockId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.notionApp.token}`
        },
        body: JSON.stringify({ content })
      });
    } catch (err) {
      console.error('Save block error:', err);
    }
  }

  async updatePageTitle(title) {
    if (!this.currentPage) return;

    try {
      await fetch(`/api/pages/${this.currentPage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.notionApp.token}`
        },
        body: JSON.stringify({ title })
      });
      this.currentPage.title = title;
    } catch (err) {
      console.error('Update title error:', err);
    }
  }

  handleBlockKeydown(e, blockId, element) {
    // 슬래시 메뉴 (/ 누르면 표시)
    if (e.key === '/' && element.textContent === '') {
      e.preventDefault();
      this.showSlashMenu(blockId, element);
    }

    // Enter: 새 블록 추가
    if (e.key === 'Enter' && !e.shiftKey) {
      if (element.classList.contains('block-text') && !element.classList.contains('block-code')) {
        e.preventDefault();
        this.addNewBlock(blockId);
      }
    }

    // Backspace: 빈 블록 삭제
    if (e.key === 'Backspace' && element.textContent === '') {
      e.preventDefault();
      this.deleteBlock(blockId);
    }
  }

  showSlashMenu(blockId, element) {
    const menu = document.createElement('div');
    menu.className = 'slash-menu';

    const rect = element.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 10) + 'px';
    menu.style.left = rect.left + 'px';

    this.blockTypes.forEach((type, idx) => {
      const item = document.createElement('div');
      item.className = 'slash-menu-item';
      if (idx === 0) item.classList.add('selected');
      item.innerHTML = `<span>${type.icon}</span> ${type.label}`;
      item.addEventListener('click', () => this.insertBlockType(blockId, type.name, menu));
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // 키보드 네비게이션
    let selectedIdx = 0;
    const items = menu.querySelectorAll('.slash-menu-item');

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % items.length;
        items.forEach(item => item.classList.remove('selected'));
        items[selectedIdx].classList.add('selected');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        items.forEach(item => item.classList.remove('selected'));
        items[selectedIdx].classList.add('selected');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const type = this.blockTypes[selectedIdx].name;
        this.insertBlockType(blockId, type, menu);
      } else if (e.key === 'Escape') {
        menu.remove();
      }
    }, { once: true });
  }

  async insertBlockType(blockId, blockType, menu) {
    menu.remove();

    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return;

    block.type = blockType;

    try {
      await fetch(`/api/blocks/${blockId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.notionApp.token}`
        },
        body: JSON.stringify({ type: blockType })
      });

      this.renderBlocks();
    } catch (err) {
      console.error('Insert block type error:', err);
    }
  }

  async addNewBlock(afterBlockId) {
    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.notionApp.token}`
        },
        body: JSON.stringify({
          page_id: this.currentPage.id,
          type: 'text',
          content: '',
          position: this.blocks.length
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newBlock = {
          id: data.id,
          page_id: this.currentPage.id,
          type: 'text',
          content: '',
          position: this.blocks.length
        };
        this.blocks.push(newBlock);
        this.renderBlocks();
        this.selectBlock(data.id);
        // 포커스 설정
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${data.id}"] .block-text`);
          el?.focus();
        }, 0);
      }
    } catch (err) {
      console.error('Add block error:', err);
    }
  }

  async deleteBlock(blockId) {
    try {
      await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${window.notionApp.token}` }
      });

      this.blocks = this.blocks.filter(b => b.id !== blockId);
      this.renderBlocks();
    } catch (err) {
      console.error('Delete block error:', err);
    }
  }

  handleDragStart(e, blockId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('blockId', blockId);
  }

  async moveBlock(blockId, newPosition) {
    try {
      await fetch(`/api/blocks/${blockId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.notionApp.token}`
        },
        body: JSON.stringify({
          position: newPosition,
          page_id: this.currentPage.id
        })
      });
    } catch (err) {
      console.error('Move block error:', err);
    }
  }
}

// 에디터 초기화
window.notionEditor = new NotionEditor();
