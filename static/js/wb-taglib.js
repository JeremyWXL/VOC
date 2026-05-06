// ====== 标签库管理（一级页面） ======
let allTagSystems = [];
let libraryViewMode = 'grid'; // 'grid' | 'list'

async function loadTagLibrary() {
  const url = API() + '/api/tag-systems';
  try {
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      toast('加载标签库失败: 服务器返回非JSON数据', 'err');
      return;
    }
    allTagSystems = data.items || [];
    populateLibrarySceneFilter();
    renderTagLibrary();
    updateLibraryStats();
  } catch (e) {
    toast('加载标签库失败: ' + e.message, 'err');
  }
}

function updateLibraryStats() {
  $('#libStatTotal').textContent = allTagSystems.length;
  $('#libStatPreset').textContent = allTagSystems.filter(ts => ts.is_preset).length;
  $('#libStatCustom').textContent = allTagSystems.filter(ts => !ts.is_preset).length;
}

function populateLibrarySceneFilter() {
  const sel = $('#tagLibrarySceneFilter');
  const scenes = new Set(allTagSystems.map(ts => ts.scene_type).filter(Boolean));
  const cur = sel.value;
  let html = '<option value="">所有场景</option>';
  scenes.forEach(s => { html += `<option value="${s}">${s}</option>`; });
  sel.innerHTML = html;
  sel.value = cur;
}

function toggleLibraryView() {
  libraryViewMode = libraryViewMode === 'grid' ? 'list' : 'grid';
  $('#btnLibraryView').textContent = libraryViewMode === 'grid' ? '☰ 列表视图' : '⊞ 卡片视图';
  renderTagLibrary();
}

function renderTagLibrary() {
  const grid = $('#tagLibraryGrid');
  const list = $('#tagLibraryList');
  const empty = $('#tagLibraryEmpty');
  const search = ($('#tagLibrarySearch').value || '').toLowerCase();
  const scene = $('#tagLibrarySceneFilter').value;

  let items = allTagSystems.filter(ts => {
    if (search && !ts.name.toLowerCase().includes(search)) return false;
    if (scene && ts.scene_type !== scene) return false;
    return true;
  });

  if (items.length === 0) {
    grid.style.display = 'none';
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = libraryViewMode === 'grid' ? 'grid' : 'none';
  list.style.display = libraryViewMode === 'list' ? 'block' : 'none';
  empty.style.display = 'none';

  // Grid view
  grid.innerHTML = items.map(ts => {
    const rowCount = Math.max(0, (ts.csv_content || '').split('\n').filter(l => l.trim()).length - 1);
    const sceneBadge = ts.scene_type ? `<span style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px;margin-right:6px">${ts.scene_type}</span>` : '';
    const presetBadge = ts.is_preset ? `<span style="display:inline-block;padding:2px 8px;background:#f6ffed;color:#059669;border-radius:4px;font-size:11px;margin-right:6px">预置</span>` : '';
    return `<div style="border:1px solid #e8e8e8;border-radius:10px;padding:14px;background:#fff;transition:box-shadow .2s" onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:600;font-size:14px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ts.name}</div>
        <div style="display:flex;gap:4px;flex-shrink:0">${presetBadge}${sceneBadge}</div>
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:10px">${rowCount} 条标签路径 · ${ts.created_at ? ts.created_at.slice(0,10) : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary" style="padding:4px 10px;font-size:12px;flex:1" onclick="useTagSystemForTask('${ts.id}')">使用</button>
        <button class="btn" style="padding:4px 10px;font-size:12px;flex:1" onclick="previewTagSystem('${ts.id}')">预览</button>
        <button class="btn" style="padding:4px 10px;font-size:12px;flex:1" onclick="editTagSystem('${ts.id}')">编辑</button>
        <button class="btn" style="padding:4px 10px;font-size:12px;flex:1" onclick="copyTagSystem('${ts.id}')">复制</button>
        ${!ts.is_preset ? `<button class="btn" style="padding:4px 10px;font-size:12px;color:#dc2626;border-color:#dc2626;flex:1" onclick="deleteTagSystem('${ts.id}')">删除</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // List view
  list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e8e8e8">名称</th>
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e8e8e8;width:100px">场景</th>
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e8e8e8;width:80px">类型</th>
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e8e8e8;width:100px">路径数</th>
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e8e8e8;width:120px">创建时间</th>
      <th style="padding:10px 12px;text-align:right;border-bottom:1px solid #e8e8e8;width:280px">操作</th>
    </tr></thead>
    <tbody>${items.map(ts => {
      const rowCount = Math.max(0, (ts.csv_content || '').split('\n').filter(l => l.trim()).length - 1);
      const typeBadge = ts.is_preset
        ? '<span style="padding:2px 8px;background:#f6ffed;color:#059669;border-radius:4px;font-size:11px">预置</span>'
        : '<span style="padding:2px 8px;background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px">自定义</span>';
      return `<tr style="border-bottom:1px solid #f0f0f0" onmouseenter="this.style.background='#fafafa'" onmouseleave="this.style.background=''">
        <td style="padding:10px 12px;font-weight:500">${ts.name}</td>
        <td style="padding:10px 12px;color:#666">${ts.scene_type || '-'}</td>
        <td style="padding:10px 12px">${typeBadge}</td>
        <td style="padding:10px 12px;color:#666">${rowCount}</td>
        <td style="padding:10px 12px;color:#888;font-size:12px">${ts.created_at ? ts.created_at.slice(0,10) : '-'}</td>
        <td style="padding:10px 12px;text-align:right">
          <button class="btn btn-primary" style="padding:3px 10px;font-size:12px" onclick="useTagSystemForTask('${ts.id}')">使用</button>
          <button class="btn" style="padding:3px 10px;font-size:12px" onclick="previewTagSystem('${ts.id}')">预览</button>
          <button class="btn" style="padding:3px 10px;font-size:12px" onclick="editTagSystem('${ts.id}')">编辑</button>
          <button class="btn" style="padding:3px 10px;font-size:12px" onclick="copyTagSystem('${ts.id}')">复制</button>
          ${!ts.is_preset ? `<button class="btn" style="padding:3px 10px;font-size:12px;color:#dc2626;border-color:#dc2626" onclick="deleteTagSystem('${ts.id}')">删除</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function useTagSystemForTask(sid) {
  const ts = allTagSystems.find(t => t.id === sid);
  if (!ts) return;
  selectTagSystem(ts);
  switchMode('tag');
  toast(`已选择「${ts.name}」，请继续配置打标参数`, 'ok');
}

function importTagSystemFromFile() {
  $('#tagLibraryImportInput').click();
}

async function handleTagSystemImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csv = e.target.result;
    const name = file.name.replace(/\.csv$/i, '');
    try {
      const res = await fetch(API() + '/api/tag-systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, csv_content: csv }),
      });
      if (!res.ok) throw new Error('导入失败');
      const result = await res.json();
      toast('导入成功', 'ok');
      loadTagLibrary();
    } catch (err) {
      toast(err.message, 'err');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

async function previewTagSystem(sid) {
  const ts = allTagSystems.find(t => t.id === sid);
  if (!ts) return;
  // Parse CSV and build tree preview
  const lines = (ts.csv_content || '').split('\n').filter(l => l.trim());
  if (lines.length < 2) { toast('标签体系为空', 'err'); return; }
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(l => l.split(','));
  // Build tree
  const tree = {};
  rows.forEach(cols => {
    const l1 = (cols[0] || '').trim();
    const l2 = (cols[1] || '').trim();
    const l3 = (cols[2] || '').trim();
    const l4 = (cols[3] || '').trim();
    if (!l1) return;
    if (!tree[l1]) tree[l1] = {};
    if (l2 && !tree[l1][l2]) tree[l1][l2] = {};
    if (l3 && l2 && !tree[l1][l2][l3]) tree[l1][l2][l3] = [];
    if (l4 && l3 && l2 && !tree[l1][l2][l3].includes(l4)) tree[l1][l2][l3].push(l4);
  });

  let html = '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8">';
  Object.entries(tree).forEach(([l1, l2map]) => {
    html += `<li><b>${l1}</b>`;
    if (Object.keys(l2map).length) {
      html += '<ul style="padding-left:16px">';
      Object.entries(l2map).forEach(([l2, l3map]) => {
        html += `<li>${l2}`;
        if (Object.keys(l3map).length) {
          html += '<ul style="padding-left:16px">';
          Object.entries(l3map).forEach(([l3, l4arr]) => {
            html += `<li>${l3}`;
            if (l4arr.length) html += ' <span style="color:#888;font-size:12px">(' + l4arr.join(' / ') + ')</span>';
            html += '</li>';
          });
          html += '</ul>';
        }
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '</li>';
  });
  html += '</ul>';

  const modal = document.createElement('div');
  modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1003;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;width:100%;max-width:600px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e0e0e0;background:#f1f5f9;flex-shrink:0;">
        <div style="font-size:16px;font-weight:600;color:#333">🔍 标签体系预览 — ${ts.name}</div>
        <button class="btn" onclick="this.closest('.modal-style').remove()" style="font-size:13px">✕</button>
      </div>
      <div style="padding:16px 20px;overflow:auto;flex:1;">${html}</div>
      <div style="padding:12px 20px;border-top:1px solid #e8e8e8;text-align:right">
        <button class="btn btn-primary" onclick="useTagSystemForTask('${sid}');this.closest('.modal-style').remove()">使用此标签体系</button>
        <button class="btn" onclick="this.closest('.modal-style').remove()">关闭</button>
      </div>
    </div>`;
  modal.className = 'modal-style';
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function selectTagSystem(ts) {
  tagFile = { type: 'tag_system', tag_system_id: ts.id, name: ts.name, csvContent: ts.csv_content, filename: ts.name + '.csv' };
  $('#tagDropzone').style.display = 'none';
  $('#tagFileInfo').style.display = 'block';
  $('#tagFileInfo').innerHTML = `<div class="file-info"><span>🏷️ ${ts.name}</span><span style="color:#888">(标签库)</span><span class="remove" title="移除">&times;</span></div>`;
  $('#tagFileInfo').querySelector('.remove').onclick = () => {
    tagFile = null;
    $('#tagFileInfo').style.display = 'none';
    $('#tagDropzone').style.display = 'block';
    clearSelectedTagSystem();
  };
  const select = $('#tagSystemSelect');
  if (select) select.value = ts.id;
  $('#btnClearTagSystem').style.display = 'inline-block';
}

function clearSelectedTagSystem() {
  const select = $('#tagSystemSelect');
  if (select) select.value = '';
  $('#btnClearTagSystem').style.display = 'none';
  tagFile = null;
  $('#tagFileInfo').style.display = 'none';
  $('#tagDropzone').style.display = 'block';
}

async function loadTagSystemOptions() {
  const select = $('#tagSystemSelect');
  if (!select) return;
  try {
    const res = await fetch(API() + '/api/tag-systems');
    if (!res.ok) { toast('加载标签体系失败: HTTP ' + res.status, 'err'); return; }
    const data = await res.json();
    const items = data.items || [];
    const currentVal = select.value;
    // Keep the first option
    select.innerHTML = '<option value="">-- 请选择标签体系 --</option>';
    items.forEach(ts => {
      const opt = document.createElement('option');
      opt.value = ts.id;
      opt.textContent = ts.name + (ts.is_preset ? ' (预置)' : '');
      select.appendChild(opt);
    });
    // Restore selected value if still valid
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
      select.value = currentVal;
    }
  } catch (e) {
    toast('标签体系列表加载失败', 'err');
  }
}

function onTagSystemSelectChange(select) {
  const id = select.value;
  if (!id) {
    clearSelectedTagSystem();
    return;
  }
  // Find the selected tag system from the dropdown options
  const text = select.options[select.selectedIndex].text;
  const name = text.replace(' (预置)', '');
  // Fetch the full tag system data
  fetch(API() + '/api/tag-systems/' + id)
    .then(res => res.json())
    .then(ts => {
      selectTagSystem(ts);
    })
    .catch(err => {
      toast('加载标签体系失败: ' + err.message, 'err');
    });
}

async function editTagSystem(sid) {
  const ts = allTagSystems.find(t => t.id === sid);
  if (!ts) return;
  generatedTagCsv = null;
  tagFile = { type: 'tag_system', tag_system_id: ts.id, name: ts.name, csvContent: ts.csv_content };
  openTagEditor();
}

async function copyTagSystem(sid) {
  try {
    const res = await fetch(API() + '/api/tag-systems/' + sid + '/copy', { method: 'POST' });
    if (!res.ok) throw new Error('复制失败');
    toast('复制成功', 'ok');
    loadTagLibrary();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function deleteTagSystem(sid) {
  if (!confirm('确定要删除这个标签体系吗？')) return;
  try {
    const res = await fetch(API() + '/api/tag-systems/' + sid, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    toast('删除成功', 'ok');
    loadTagLibrary();
    if (tagFile && tagFile.tag_system_id === sid) {
      tagFile = null;
      $('#tagFileInfo').style.display = 'none';
      $('#tagDropzone').style.display = 'block';
      clearSelectedTagSystem();
    }
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function createNewTagSystem() {
  const name = prompt('请输入新标签体系名称:');
  if (!name) return;
  try {
    const res = await fetch(API() + '/api/tag-systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, csv_content: '一级标签,二级标签,三级标签,四级标签\n' }),
    });
    if (!res.ok) throw new Error('创建失败');
    const data = await res.json();
    toast('创建成功，正在打开编辑器...', 'ok');
    selectTagSystem(data);
    openTagEditor();
    loadTagLibrary();
  } catch (e) {
    toast(e.message, 'err');
  }
}
