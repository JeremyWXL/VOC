// ====== 初始化 ======

/* ===== MOBILE SIDEBAR ===== */
function toggleMobileSidebar() {
  const sb = document.getElementById('appSidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('active');
}
function closeMobileSidebar() {
  const sb = document.getElementById('appSidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.remove('open');
  ov.classList.remove('active');
}

/* ===== DEBOUNCED SEARCH ===== */
let _searchTimer = null;
function debouncedFilterReviews() {
  const el = document.getElementById('reviewSearchInput');
  if (!el) return;
  if (_searchTimer) clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    filterReviews();
  }, 250);
}

/* ===== CLOSE MOBILE SIDEBAR ON NAVIGATION ===== */
const _origSwitchMode = switchMode;
switchMode = function(mode) {
  _origSwitchMode(mode);
  if (window.innerWidth <= 768) closeMobileSidebar();
};

// ====== 模式切换 ======
function switchMode(mode) {
  // Update sidebar active state
  document.querySelectorAll('.app-sidebar-item').forEach(item => {
    item.classList.toggle('active', item.dataset.mode === mode);
  });
  // Show/hide panels
  document.querySelectorAll('.app-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === getPanelIdByMode(mode));
  });
  // Collapse library submenu when switching away
  if (mode !== 'library') {
    const submenu = $('#librarySubmenu');
    const btn = $('#libraryMenuBtn');
    if (submenu) submenu.classList.remove('open');
    if (btn) btn.classList.remove('expanded');
  }
  if (mode === 'audit') {
    const recent = getRecentTask();
    const btn = $('#btnLoadRecent');
    if (recent) { btn.style.display = 'inline-flex'; btn.title = recent; }
    else { btn.style.display = 'none'; }
    const hash = location.hash;
    if (hash.startsWith('#audit=') && !$('#auditTaskId').value) {
      $('#auditTaskId').value = hash.slice(7);
      loadAuditTask();
    }
  }
  if (mode === 'dashboard') {
    loadDashboard();
  }
  if (mode === 'library') {
    // React tag library app handles data loading internally
  }
  if (mode === 'tag') {
    loadTagSystemOptions();
  }
}

function getPanelIdByMode(mode) {
  const map = { tag: 'tagModePanel', audit: 'auditModePanel', dashboard: 'dashboardModePanel', library: 'tagLibraryPanel' };
  return map[mode];
}

function toggleSidebar() {
  const sidebar = $('#appSidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  const icon = $('#sidebarToggleIcon');
  if (icon) icon.textContent = isCollapsed ? '▶' : '◀';
  try { localStorage.setItem('vocSidebarCollapsed', isCollapsed ? '1' : '0'); } catch(e) {}
}

function initSidebar() {
  try {
    const collapsed = localStorage.getItem('vocSidebarCollapsed') === '1';
    if (collapsed) {
      $('#appSidebar').classList.add('collapsed');
      const icon = $('#sidebarToggleIcon');
      if (icon) icon.textContent = '▶';
    }
  } catch(e) {}
}

function toggleLibraryMenu(e) {
  e.stopPropagation();
  const btn = $('#libraryMenuBtn');
  const submenu = $('#librarySubmenu');
  const isOpen = submenu.classList.toggle('open');
  btn.classList.toggle('expanded', isOpen);
}

function navigateLibrary(path) {
  switchMode('library');
  const iframe = $('#tagLibraryFrame');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: 'navigate', path }, '*');
  }
}

function toggleNotificationPanel() {
  toast('暂无新通知', 'info');
}

function toggleUserMenu() {
  const panel = $('#userMenuPanel');
  if (!panel) return;
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !e.target.closest('.app-navbar-icon-btn')) {
        panel.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }
}

// ====== Event Listeners ======

$('#apiStatus').addEventListener('click', checkApi);
checkApi();
loadPresetTags();
loadApiConfigSelect();

// API 配置选择
$('#apiConfigSelect').addEventListener('change', () => {
  applyApiConfig($('#apiConfigSelect').value);
});
// 点击下拉框时自动刷新（支持多标签页同步）
$('#apiConfigSelect').addEventListener('focus', () => {
  loadApiConfigSelect();
});

// provider 变化时自动切换默认模型
$('#provider').addEventListener('change', () => {
  const map = { openai: 'gpt-4o-mini', deepseek: 'deepseek-chat', dashscope: 'qwen-turbo' };
  const def = map[$('#provider').value];
  if (def) $('#model').value = def;
});

// API Config Modal click-outside
$('#apiConfigModal').addEventListener('click', (e) => {
  if (e.target === $('#apiConfigModal')) closeApiConfigManager();
});

// Tag Editor Modal click-outside
$('#tagEditorModal').addEventListener('click', (e) => {
  if (e.target === $('#tagEditorModal')) closeTagEditor();
});

// Editor Return Modal click-outside
$('#editorReturnModal').addEventListener('click', (e) => {
  if (e.target === $('#editorReturnModal')) closeEditorReturnModal();
});

// Tag Detail Modal click-outside
$('#tagDetailModal').addEventListener('click', (e) => {
  if (e.target === $('#tagDetailModal')) closeTagDetailModal();
});

// 初始化多维度映射
setupProfileDropzone();

// 初始化文件上传 dropzones
setupDropzone('#tagDropzone', '#tagFileInput', '#tagFileInfo', (data, file) => {
  tagFile = data;
  if (file && file.name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (e) => { tagFile.csvContent = e.target.result; };
    reader.readAsText(file);
  }
});

setupDropzone('#reviewDropzone', '#reviewFileInput', '#reviewFileInfo', (data) => {
  reviewFile = data;
  if (data) {
    const cols = data.columns;
    const opts = cols.map(c => `<option value="${c}">${c}</option>`).join('');
    $('#contentColumn').innerHTML = opts;
    $('#idColumn').innerHTML = '<option value="">(无)</option>' + opts;
    const guess = cols.find(c => /内容|评论|text|content/i.test(c));
    if (guess) $('#contentColumn').value = guess;
    $('#reviewPreviewWrap').style.display = 'block';
    renderTable($('#reviewPreviewTable'), data.preview, cols);
    // 评论文件上传后，更新映射规则中的列选项并启用预览按钮
    renderMappingRules();
    $('#btnPreviewMapping').disabled = false;
    // 显示自动场景识别入口
    $('#aiTagGenWrap').style.display = 'block';
  } else {
    $('#contentColumn').innerHTML = '<option value="">请先上传文件</option>';
    $('#idColumn').innerHTML = '<option value="">请先上传文件</option>';
    $('#reviewPreviewWrap').style.display = 'none';
    $('#aiTagGenWrap').style.display = 'none';
  }
});

// 增量结果文件上传
setupDropzone('#prevDropzone', '#prevFileInput', '#prevFileInfo', (data) => {
  prevOutputFile = data;
}, {
  hideDropzone: () => { $('#prevDropzone').style.display = 'none'; },
  showDropzone: () => { $('#prevDropzone').style.display = 'block'; }
});

// URL hash 解析
if (location.hash.startsWith('#audit=')) {
  switchMode('audit');
}

// 预加载场景列表
loadScenes();
initSidebar();
loadTagSystemOptions();

// ====== React Tag Library iframe postMessage protocol ======
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'switch-mode') {
    if (['tag', 'library', 'dashboard', 'audit'].includes(msg.mode)) {
      switchMode(msg.mode);
    }
  } else if (msg.type === 'use-tag-system') {
    selectTagSystem({ id: msg.id, name: msg.name, csv_content: '' });
    switchMode('tag');
    toast('已选择「' + msg.name + '」，请继续配置打标参数', 'ok');
  }
});
