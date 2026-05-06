// ====== Dashboard ======
async function loadDashboard() {
  const container = $('#dashboardTaskList');
  container.innerHTML = '<p style="color:#888">加载中...</p>';
  try {
    const res = await fetch(API() + '/api/tasks');
    if (!res.ok) throw new Error((await res.json()).detail);
    const data = await res.json();
    renderTaskList(data.tasks || []);
  } catch(e) {
    container.innerHTML = `<p style="color:#c62828">加载失败: ${e.message}</p>`;
  }
}

function renderTaskList(tasks) {
  const container = $('#dashboardTaskList');
  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">暂无任务</div></div>';
    $('#dashboardTaskDetail').style.display = 'none';
    return;
  }
  let html = '<div style="overflow:auto;border:1px solid #eee;border-radius:6px"><table class="preview-table"><thead><tr>';
  html += '<th>任务ID</th><th>状态</th><th>评论数</th><th>已打标</th><th>模糊</th><th>虚假</th><th>创建时间</th><th>操作</th>';
  html += '</tr></thead><tbody>';
  tasks.forEach(t => {
    const statusColor = { pending: '#888', running: '#2563eb', completed: '#059669', failed: '#dc2626' }[t.status] || '#888';
    html += `<tr style="cursor:pointer" onclick="showTaskDetail('${t.id}')">`;
    html += `<td><code>${t.id}</code></td>`;
    html += `<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${statusColor};color:#fff;font-size:12px">${t.status}</span></td>`;
    html += `<td>${t.total_reviews || 0}</td>`;
    html += `<td>${t.tagged_reviews || 0}</td>`;
    html += `<td style="color:${(t.uncertain_count||0)>0?'#ff9800':'#888'}">${t.uncertain_count || 0}</td>`;
    html += `<td style="color:${(t.rejected_count||0)>0?'#dc2626':'#888'}">${t.rejected_count || 0}</td>`;
    html += `<td style="color:#888;font-size:12px">${t.created_at ? t.created_at.slice(0,19).replace('T',' ') : '-'}</td>`;
    html += `<td><button class="btn" style="padding:4px 10px;font-size:12px" onclick="event.stopPropagation();enterAuditFromDashboard('${t.id}')">审核</button></td>`;
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function showTaskDetail(taskId) {
  const detail = $('#dashboardTaskDetail');
  detail.style.display = 'block';
  detail.innerHTML = '<p style="color:#888">加载统计中...</p>';
  try {
    const res = await fetch(API() + '/api/tasks/' + taskId + '/stats');
    if (!res.ok) throw new Error((await res.json()).detail);
    const stats = await res.json();
    renderTaskDetail(taskId, stats);
  } catch(e) {
    detail.innerHTML = `<p style="color:#c62828">加载统计失败: ${e.message}</p>`;
  }
}

function renderTaskDetail(taskId, stats) {
  const detail = $('#dashboardTaskDetail');
  const total = stats.total_reviews || 0;
  const tagged = stats.tagged_reviews || 0;
  const uncertain = stats.uncertain_reviews || [];
  const rejected = stats.rejected_reviews || [];
  const tagDist = stats.tag_distribution || {};

  let html = '<div class="step" style="padding:20px">';
  html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">';

  // 统计卡片
  const cards = [
    { label: '总评论数', value: total, color: '#2563eb' },
    { label: '已打标', value: tagged, color: '#059669' },
    { label: '未打标', value: total - tagged, color: '#888' },
    { label: '模糊', value: uncertain.length, color: '#ff9800' },
    { label: '虚假', value: rejected.length, color: '#dc2626' },
  ];
  cards.forEach(c => {
    html += `<div style="flex:1;min-width:120px;background:${c.color}08;border:1px solid ${c.color}30;border-radius:8px;padding:14px;text-align:center">`;
    html += `<div style="font-size:24px;font-weight:700;color:${c.color}">${c.value}</div>`;
    html += `<div style="font-size:12px;color:#666;margin-top:4px">${c.label}</div>`;
    html += '</div>';
  });
  html += '</div>';

  // 标签分布
  if (Object.keys(tagDist).length > 0) {
    html += '<div style="margin-bottom:20px"><strong style="font-size:14px">标签分布（点击标签查看明细并校对）</strong>';
    const maxVal = Math.max(...Object.values(tagDist));
    Object.entries(tagDist).forEach(([label, count]) => {
      const pct = maxVal > 0 ? Math.round(count / maxVal * 100) : 0;
      html += `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;cursor:pointer" onclick="openTagDetailModal('${taskId}', '${escapeHtml(label)}')" title="点击查看「${escapeHtml(label)}」的评论明细">`;
      html += `<div style="width:100px;font-size:13px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${escapeHtml(label)}</div>`;
      html += `<div style="flex:1;background:#e8e8e8;border-radius:4px;height:20px;overflow:hidden">`;
      html += `<div style="width:${pct}%;background:#2563eb;height:100%;border-radius:4px;transition:width 0.3s"></div>`;
      html += `</div><div style="width:50px;text-align:right;font-size:13px;color:#666">${count}</div>`;
      html += '</div>';
    });
    html += '</div>';
  }

  // 不确定评论
  if (uncertain.length > 0) {
    html += '<div style="margin-bottom:16px"><strong style="font-size:14px">模糊评论 (' + uncertain.length + ')</strong>';
    html += '<div style="margin-top:8px">';
    uncertain.slice(0, 5).forEach(u => {
      html += `<div style="padding:8px 10px;background:#fff3e0;border-radius:6px;margin-bottom:6px;font-size:13px">`;
      html += `<span style="color:#888;font-size:12px">[${u.review_id || u.id}]</span> `;
      html += `<span>${(u.content || '').substring(0, 60)}${(u.content || '').length > 60 ? '...' : ''}</span>`;
      html += `<span style="float:right;color:#ff9800;font-size:12px">真实性: ${u.authenticity_score != null ? u.authenticity_score.toFixed(2) : '-'}</span>`;
      html += '</div>';
    });
    if (uncertain.length > 5) {
      html += `<div style="text-align:center;padding:6px"><button class="btn" style="font-size:12px;padding:4px 12px" onclick="enterAuditFromDashboard('${taskId}')">查看全部 ${uncertain.length} 条 →</button></div>`;
    }
    html += '</div></div>';
  }

  // 虚假评论
  if (rejected.length > 0) {
    html += '<div><strong style="font-size:14px">虚假评论 (' + rejected.length + ')</strong>';
    html += '<div style="margin-top:8px">';
    rejected.slice(0, 5).forEach(r => {
      html += `<div style="padding:8px 10px;background:#ffebee;border-radius:6px;margin-bottom:6px;font-size:13px">`;
      html += `<span style="color:#888;font-size:12px">[${r.review_id || r.id}]</span> `;
      html += `<span>${(r.content || '').substring(0, 60)}${(r.content || '').length > 60 ? '...' : ''}</span>`;
      html += `<span style="float:right;color:#dc2626;font-size:12px">真实性: ${r.authenticity_score != null ? r.authenticity_score.toFixed(2) : '-'}</span>`;
      html += '</div>';
    });
    if (rejected.length > 5) {
      html += `<div style="text-align:center;padding:6px"><button class="btn" style="font-size:12px;padding:4px 12px" onclick="enterAuditFromDashboard('${taskId}')">查看全部 ${rejected.length} 条 →</button></div>`;
    }
    html += '</div></div>';
  }

  html += '</div>';
  detail.innerHTML = html;
}

function enterAuditFromDashboard(taskId) {
  $('#auditTaskId').value = taskId;
  switchMode('audit');
  loadAuditTask();
}

// Audit mode entry
async function loadAuditTask() {
  const taskId = $('#auditTaskId').value.trim();
  if (!taskId) { toast('请输入任务ID', 'err'); return; }
  initReviewPanel('auditReviewContainer');
  await loadAllReviews(taskId);
}

// ====== 本地存储最近任务 ======
function saveRecentTask(taskId) {
  try { localStorage.setItem('recentTaskId', taskId); } catch(e) {}
}
function getRecentTask() {
  try { return localStorage.getItem('recentTaskId'); } catch(e) { return null; }
}
function loadRecentTask() {
  const id = getRecentTask();
  if (id) { $('#auditTaskId').value = id; loadAuditTask(); }
}

// ====== 审核工作区 ======
let reviewPanelState = {
  taskId: null,
  allReviews: [],
  total: 0,
  page: 1,
  pageSize: 20,
  filterStatus: 'all',
  filterLevel1: 'all',
  searchKeyword: '',
  tagHierarchy: {},
  editingId: null,
  selectedIds: new Set(),
};
let editTagMap = {};

function initReviewPanel(containerId) {
  const container = $('#' + containerId);
  if (!container) return;
  container.innerHTML = `
    <section class="step review-panel">
      <div class="step-header">
        <div class="step-num">✏️</div>
        <div>
          <div class="step-title">结果审核</div>
          <div class="step-desc">人工修正模糊评论、删除虚假评论、确认标签</div>
        </div>
      </div>
      <div class="batch-bar" id="batchBar-${containerId}">
        <span id="batchCount-${containerId}">已选 0 条</span>
        <button class="btn btn-success" onclick="batchMarkReviewed('${containerId}')">批量标记为已审核</button>
        <button class="btn" style="color:#dc2626;border-color:#dc2626" onclick="batchDelete('${containerId}')">批量删除虚假评论</button>
        <button class="btn" onclick="clearSelection('${containerId}')">取消选择</button>
      </div>
      <div class="filter-bar">
        <select id="filterStatus-${containerId}">
          <option value="all">全部状态</option>
          <option value="normal">正常</option>
          <option value="uncertain">模糊</option>
          <option value="rejected">虚假</option>
          <option value="reviewed">已审核</option>
        </select>
        <select id="filterLevel1-${containerId}">
          <option value="all">全部一级标签</option>
        </select>
        <input type="text" id="searchKeyword-${containerId}" placeholder="搜索评论内容...">
        <button class="btn" onclick="applyFilters('${containerId}')">筛选</button>
        <button class="btn" onclick="resetFilters('${containerId}')">重置</button>
      </div>
      <div style="overflow:auto;border:1px solid #eee;border-radius:6px;max-height:600px">
        <table class="review-table">
          <thead>
            <tr>
              <th style="width:30px"><input type="checkbox" id="selectAll-${containerId}" onclick="toggleSelectAll('${containerId}')"></th>
              <th>评论ID</th>
              <th>评论内容</th>
              <th>当前标签</th>
              <th style="width:60px">是否模糊</th>
              <th style="width:110px">真实性评分</th>
              <th style="width:70px">状态</th>
              <th style="width:110px">操作</th>
            </tr>
          </thead>
          <tbody id="reviewTableBody-${containerId}"></tbody>
        </table>
      </div>
      <div class="pagination" id="reviewPagination-${containerId}"></div>
      <div style="margin-top:8px;font-size:12px;color:#888;" id="reviewCountInfo-${containerId}"></div>
    </section>
  `;
  // Bind enter key on search
  const searchInput = $(`#searchKeyword-${containerId}`);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilters(containerId); });
  }
}

async function loadAllReviews(taskId) {
  reviewPanelState.taskId = taskId;
  reviewPanelState.allReviews = [];
  reviewPanelState.page = 1;
  reviewPanelState.selectedIds.clear();
  try {
    const url = `${API()}/api/tasks/${taskId}/reviews?page=1&page_size=9999`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) { toast('任务不存在，请检查任务ID', 'err'); return; }
      throw new Error((await res.json()).detail || '加载失败');
    }
    const data = await res.json();
    reviewPanelState.allReviews = data.reviews || [];
    reviewPanelState.total = data.total || 0;

    // 尝试从任务获取标签体系
    await loadTaskTagHierarchy(taskId);

    // 如果还没有标签体系，从评论标签动态构建
    if (!Object.keys(reviewPanelState.tagHierarchy).length) {
      reviewPanelState.tagHierarchy = buildHierarchyFromReviews(reviewPanelState.allReviews);
    }
    updateLevel1Filter();
    applyFiltersAndRender();
  } catch(e) {
    toast('加载评论失败: ' + e.message, 'err');
  }
}

async function loadTaskTagHierarchy(taskId) {
  try {
    const res = await fetch(API() + '/api/tasks/' + taskId);
    if (!res.ok) return;
    const task = await res.json();
    const tagPath = task.tag_file_path;
    if (!tagPath) return;
    const hRes = await fetch(API() + '/api/tag-hierarchy?file_id=' + encodeURIComponent(tagPath));
    if (!hRes.ok) return;
    const hData = await hRes.json();
    reviewPanelState.tagHierarchy = hData.hierarchy || {};
  } catch(e) {
    console.error('加载标签体系失败', e);
  }
}

function buildHierarchyFromReviews(reviews) {
  const tree = {};
  reviews.forEach(r => {
    (r.tags || []).forEach(t => {
      const l1 = t.level1 || '其他';
      const l2 = t.level2 || '';
      const l3 = t.level3 || '';
      const l4 = t.level4 || '';
      if (!l1) return;
      if (!tree[l1]) tree[l1] = {};
      if (!tree[l1][l2]) tree[l1][l2] = {};
      if (!tree[l1][l2][l3]) tree[l1][l2][l3] = [];
      if (l4 && !tree[l1][l2][l3].includes(l4)) tree[l1][l2][l3].push(l4);
    });
  });
  return tree;
}

function updateLevel1Filter() {
  const containers = ['step4ReviewContainer', 'auditReviewContainer'];
  containers.forEach(cid => {
    const sel = $(`#filterLevel1-${cid}`);
    if (!sel) return;
    const val = sel.value;
    const l1s = Object.keys(reviewPanelState.tagHierarchy).sort();
    let opts = '<option value="all">全部一级标签</option>';
    l1s.forEach(l1 => { if (l1) opts += `<option value="${l1}">${l1}</option>`; });
    sel.innerHTML = opts;
    sel.value = val || 'all';
  });
}

function getFilteredReviews() {
  let list = reviewPanelState.allReviews || [];
  if (reviewPanelState.filterStatus !== 'all') {
    list = list.filter(r => r.status === reviewPanelState.filterStatus);
  }
  if (reviewPanelState.filterLevel1 !== 'all') {
    list = list.filter(r => (r.tags || []).some(t => t.level1 === reviewPanelState.filterLevel1));
  }
  if (reviewPanelState.searchKeyword.trim()) {
    const kw = reviewPanelState.searchKeyword.trim().toLowerCase();
    list = list.filter(r => (r.content || '').toLowerCase().includes(kw));
  }
  return list;
}

function applyFilters(containerId) {
  reviewPanelState.filterStatus = $(`#filterStatus-${containerId}`).value;
  reviewPanelState.filterLevel1 = $(`#filterLevel1-${containerId}`).value;
  reviewPanelState.searchKeyword = $(`#searchKeyword-${containerId}`).value;
  reviewPanelState.page = 1;
  applyFiltersAndRender();
}

function resetFilters(containerId) {
  $(`#filterStatus-${containerId}`).value = 'all';
  $(`#filterLevel1-${containerId}`).value = 'all';
  $(`#searchKeyword-${containerId}`).value = '';
  applyFilters(containerId);
}

function applyFiltersAndRender() {
  const filtered = getFilteredReviews();
  const total = filtered.length;
  const start = (reviewPanelState.page - 1) * reviewPanelState.pageSize;
  const end = start + reviewPanelState.pageSize;
  const pageItems = filtered.slice(start, end);
  reviewPanelState.total = total;
  reviewPanelState.reviews = pageItems;
  renderReviewTable(pageItems);
  renderPagination(Math.max(1, Math.ceil(total / reviewPanelState.pageSize)));
  const info = document.querySelector('#reviewCountInfo-step4ReviewContainer, #reviewCountInfo-auditReviewContainer');
  if (info) info.textContent = `共 ${total} 条${total !== reviewPanelState.allReviews.length ? '（筛选后）' : ''}，每页 ${reviewPanelState.pageSize} 条`;
}

function renderReviewTable(rows) {
  const containerIds = ['step4ReviewContainer', 'auditReviewContainer'];
  containerIds.forEach(cid => {
    const tbody = $(`#reviewTableBody-${cid}`);
    const selectAll = $(`#selectAll-${cid}`);
    if (!tbody) return;
    if (selectAll) selectAll.checked = false;
    tbody.innerHTML = rows.map(r => renderReviewRow(r, cid)).join('');
    updateBatchBars();
  });
}

function renderReviewRow(r, containerId) {
  const isEditing = reviewPanelState.editingId === r.id;
  if (isEditing) {
    return `<tr class="editing"><td colspan="8">${renderEditForm(r, containerId)}</td></tr>`;
  }
  const checked = reviewPanelState.selectedIds.has(r.id) ? 'checked' : '';
  const uncertainStr = r.uncertain ? '<span style="color:#f57f17;font-weight:600">是</span>' : '<span style="color:#999">否</span>';
  return `
    <tr>
      <td><input type="checkbox" data-id="${r.id}" ${checked} onchange="toggleSelect(${r.id})"></td>
      <td style="white-space:nowrap">${escapeHtml(r.review_id || r.id)}</td>
      <td><div class="content-cell" title="${escapeHtml(r.content || '')}">${escapeHtml(truncate(r.content, 80))}</div></td>
      <td>${tagPills(r.tags)}</td>
      <td style="text-align:center">${uncertainStr}</td>
      <td>${scoreBar(r.authenticity_score)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <button class="btn" style="padding:3px 8px;font-size:12px" onclick="startEdit(${r.id})">编辑</button>
        <button class="btn" style="padding:3px 8px;font-size:12px;color:#dc2626;border-color:#dc2626" onclick="deleteReview(${r.id})">删除</button>
      </td>
    </tr>
  `;
}

function renderEditForm(r, containerId) {
  const tags = editTagMap[r.id] || [];
  const tagsHtml = tags.map((t, i) => `
    <span class="edit-tag-pill">
      ${escapeHtml([t.level1, t.level2, t.level3].filter(Boolean).join('/'))}${t.level4 ? '/' + escapeHtml(t.level4) : ''}
      <span class="remove-tag" onclick="removeEditTag(${r.id}, ${i})">&times;</span>
    </span>
  `).join('');
  const l1s = Object.keys(reviewPanelState.tagHierarchy).sort();
  const l1Opts = '<option value="">选择一级</option>' + l1s.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  return `
    <div style="padding:8px 4px">
      <div style="font-weight:500;margin-bottom:8px;font-size:13px">编辑标签 — 评论 ${escapeHtml(r.review_id || r.id)}</div>
      <div class="current-edit-tags" id="editTags-${r.id}">
        ${tagsHtml || '<span style="color:#999;font-size:12px">暂无标签</span>'}
      </div>
      <div id="addTagForm-${r.id}" style="display:none;" class="inline-edit-form">
        <div class="tag-form-row">
          <select id="editL1-${r.id}" onchange="onEditL1Change(${r.id})">${l1Opts}</select>
          <select id="editL2-${r.id}" onchange="onEditL2Change(${r.id})"><option value="">选择二级</option></select>
          <select id="editL3-${r.id}" onchange="onEditL3Change(${r.id})"><option value="">选择三级</option></select>
          <select id="editL4-${r.id}"><option value="">选择四级（可选）</option></select>
          <input type="number" id="editConf-${r.id}" value="1.0" min="0" max="1" step="0.05" style="width:70px" placeholder="置信度">
          <input type="text" id="editReason-${r.id}" value="人工确认" placeholder="原因" style="width:120px">
          <button class="btn btn-primary" style="padding:4px 10px;font-size:12px" onclick="confirmAddTag(${r.id})">添加</button>
        </div>
      </div>
      <button class="btn" style="padding:4px 10px;font-size:12px;margin-top:4px" onclick="toggleAddTagForm(${r.id})" id="btnToggleAdd-${r.id}">+ 添加标签</button>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-primary" style="padding:4px 14px;font-size:12px" onclick="saveEditTags(${r.id})">保存</button>
        <button class="btn" style="padding:4px 14px;font-size:12px" onclick="cancelEdit()">取消</button>
      </div>
    </div>
  `;
}

// Inline edit interactions
function startEdit(reviewId) {
  reviewPanelState.editingId = reviewId;
  const review = reviewPanelState.allReviews.find(r => r.id === reviewId);
  editTagMap[reviewId] = (review.tags || []).map(t => ({...t}));
  applyFiltersAndRender();
}
function cancelEdit() {
  reviewPanelState.editingId = null;
  applyFiltersAndRender();
}
function removeEditTag(reviewId, idx) {
  if (!editTagMap[reviewId]) return;
  editTagMap[reviewId].splice(idx, 1);
  refreshEditTags(reviewId);
}
function refreshEditTags(reviewId) {
  const container = document.getElementById(`editTags-${reviewId}`);
  if (!container) return;
  const tags = editTagMap[reviewId] || [];
  container.innerHTML = tags.map((t, i) => `
    <span class="edit-tag-pill">
      ${escapeHtml([t.level1, t.level2, t.level3].filter(Boolean).join('/'))}${t.level4 ? '/' + escapeHtml(t.level4) : ''}
      <span class="remove-tag" onclick="removeEditTag(${reviewId}, ${i})">&times;</span>
    </span>
  `).join('') || '<span style="color:#999;font-size:12px">暂无标签</span>';
}
function toggleAddTagForm(reviewId) {
  const form = document.getElementById(`addTagForm-${reviewId}`);
  const btn = document.getElementById(`btnToggleAdd-${reviewId}`);
  if (!form || !btn) return;
  if (form.style.display === 'none') {
    form.style.display = 'block';
    btn.textContent = '− 收起';
  } else {
    form.style.display = 'none';
    btn.textContent = '+ 添加标签';
  }
}
function onEditL1Change(reviewId) {
  const l1 = document.getElementById(`editL1-${reviewId}`).value;
  const l2Sel = document.getElementById(`editL2-${reviewId}`);
  const l3Sel = document.getElementById(`editL3-${reviewId}`);
  const l4Sel = document.getElementById(`editL4-${reviewId}`);
  if (!l2Sel || !l3Sel || !l4Sel) return;
  l2Sel.innerHTML = '<option value="">选择二级</option>';
  l3Sel.innerHTML = '<option value="">选择三级</option>';
  l4Sel.innerHTML = '<option value="">选择四级（可选）</option>';
  if (!l1 || !reviewPanelState.tagHierarchy[l1]) return;
  Object.keys(reviewPanelState.tagHierarchy[l1]).sort().forEach(l2 => {
    l2Sel.innerHTML += `<option value="${escapeHtml(l2)}">${escapeHtml(l2)}</option>`;
  });
}
function onEditL2Change(reviewId) {
  const l1 = document.getElementById(`editL1-${reviewId}`).value;
  const l2 = document.getElementById(`editL2-${reviewId}`).value;
  const l3Sel = document.getElementById(`editL3-${reviewId}`);
  const l4Sel = document.getElementById(`editL4-${reviewId}`);
  if (!l3Sel || !l4Sel) return;
  l3Sel.innerHTML = '<option value="">选择三级</option>';
  l4Sel.innerHTML = '<option value="">选择四级（可选）</option>';
  if (!l1 || !l2 || !reviewPanelState.tagHierarchy[l1] || !reviewPanelState.tagHierarchy[l1][l2]) return;
  Object.keys(reviewPanelState.tagHierarchy[l1][l2]).sort().forEach(l3 => {
    l3Sel.innerHTML += `<option value="${escapeHtml(l3)}">${escapeHtml(l3)}</option>`;
  });
}
function onEditL3Change(reviewId) {
  const l1 = document.getElementById(`editL1-${reviewId}`).value;
  const l2 = document.getElementById(`editL2-${reviewId}`).value;
  const l3 = document.getElementById(`editL3-${reviewId}`).value;
  const l4Sel = document.getElementById(`editL4-${reviewId}`);
  if (!l4Sel) return;
  l4Sel.innerHTML = '<option value="">选择四级（可选）</option>';
  if (!l1 || !l2 || !l3) return;
  const l4s = (reviewPanelState.tagHierarchy[l1][l2][l3] || []);
  l4s.sort().forEach(l4 => {
    if (l4) l4Sel.innerHTML += `<option value="${escapeHtml(l4)}">${escapeHtml(l4)}</option>`;
  });
}
function confirmAddTag(reviewId) {
  const l1El = document.getElementById(`editL1-${reviewId}`);
  const l2El = document.getElementById(`editL2-${reviewId}`);
  const l3El = document.getElementById(`editL3-${reviewId}`);
  const l4El = document.getElementById(`editL4-${reviewId}`);
  const confEl = document.getElementById(`editConf-${reviewId}`);
  const reasonEl = document.getElementById(`editReason-${reviewId}`);
  if (!l1El || !l2El || !l3El) return;
  const l1 = l1El.value, l2 = l2El.value, l3 = l3El.value, l4 = l4El ? l4El.value : '';
  const conf = parseFloat(confEl ? confEl.value : '1.0') || 1.0;
  const reason = reasonEl ? reasonEl.value : '人工确认';
  if (!l1 || !l2 || !l3) { toast('请选择完整的三级标签路径', 'err'); return; }
  if (!editTagMap[reviewId]) editTagMap[reviewId] = [];
  editTagMap[reviewId].push({ level1: l1, level2: l2, level3: l3, level4: l4, confidence: conf, reason });
  refreshEditTags(reviewId);
  l1El.value = ''; onEditL1Change(reviewId);
  if (confEl) confEl.value = '1.0';
  if (reasonEl) reasonEl.value = '人工确认';
}
async function saveEditTags(reviewId) {
  const tags = (editTagMap[reviewId] || []).map(t => ({
    level1: t.level1,
    level2: t.level2,
    level3: t.level3,
    level4: t.level4 || '',
    confidence: t.confidence == null ? 1.0 : parseFloat(t.confidence),
    reason: t.reason || '人工确认',
  }));
  try {
    const res = await fetch(`${API()}/api/tasks/${reviewPanelState.taskId}/reviews/${reviewId}/tags`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(tags),
    });
    if (!res.ok) throw new Error((await res.json()).detail || '保存失败');
    const review = reviewPanelState.allReviews.find(r => r.id === reviewId);
    if (review) {
      review.tags = tags.map(t => ({...t, is_manual: true}));
      review.status = 'reviewed';
    }
    reviewPanelState.editingId = null;
    delete editTagMap[reviewId];
    applyFiltersAndRender();
    toast('标签已保存', 'ok');
  } catch(e) {
    toast('保存失败: ' + e.message, 'err');
  }
}

// Delete / reject review (frontend only)
function deleteReview(reviewId) {
  const review = reviewPanelState.allReviews.find(r => r.id === reviewId);
  if (review) {
    review.status = 'rejected';
    applyFiltersAndRender();
    toast('已标记为虚假评论', 'ok');
  }
}

// Batch operations
function toggleSelect(reviewId) {
  if (reviewPanelState.selectedIds.has(reviewId)) {
    reviewPanelState.selectedIds.delete(reviewId);
  } else {
    reviewPanelState.selectedIds.add(reviewId);
  }
  updateBatchBars();
  // Refresh checkbox states without full re-render
  document.querySelectorAll('.review-table tbody input[type="checkbox"]').forEach(cb => {
    const id = parseInt(cb.getAttribute('data-id') || '0');
    if (id) cb.checked = reviewPanelState.selectedIds.has(id);
  });
}
function toggleSelectAll(containerId) {
  const checked = $(`#selectAll-${containerId}`).checked;
  const rows = reviewPanelState.reviews || [];
  rows.forEach(r => {
    if (checked) reviewPanelState.selectedIds.add(r.id);
    else reviewPanelState.selectedIds.delete(r.id);
  });
  updateBatchBars();
  renderReviewTable(rows);
}
function updateBatchBars() {
  ['step4ReviewContainer', 'auditReviewContainer'].forEach(cid => {
    const bar = $(`#batchBar-${cid}`);
    const countEl = $(`#batchCount-${cid}`);
    if (!bar || !countEl) return;
    const count = reviewPanelState.selectedIds.size;
    if (count > 0) {
      bar.style.display = 'flex';
      countEl.textContent = `已选 ${count} 条`;
    } else {
      bar.style.display = 'none';
    }
  });
}
function batchMarkReviewed(containerId) {
  reviewPanelState.selectedIds.forEach(id => {
    const review = reviewPanelState.allReviews.find(r => r.id === id);
    if (review) review.status = 'reviewed';
  });
  reviewPanelState.selectedIds.clear();
  updateBatchBars();
  applyFiltersAndRender();
  toast('已批量标记为已审核', 'ok');
}
function batchDelete(containerId) {
  reviewPanelState.selectedIds.forEach(id => {
    const review = reviewPanelState.allReviews.find(r => r.id === id);
    if (review) review.status = 'rejected';
  });
  reviewPanelState.selectedIds.clear();
  updateBatchBars();
  applyFiltersAndRender();
  toast('已批量标记为虚假评论', 'ok');
}
function clearSelection(containerId) {
  reviewPanelState.selectedIds.clear();
  const selectAll = $(`#selectAll-${containerId}`);
  if (selectAll) selectAll.checked = false;
  updateBatchBars();
  renderReviewTable(reviewPanelState.reviews || []);
}

// Pagination
function renderPagination(totalPages) {
  ['step4ReviewContainer', 'auditReviewContainer'].forEach(cid => {
    const el = $(`#reviewPagination-${cid}`);
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += `<button class="btn" ${reviewPanelState.page === 1 ? 'disabled' : ''} onclick="goToPage(${reviewPanelState.page - 1})">上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= reviewPanelState.page - 1 && i <= reviewPanelState.page + 1)) {
        html += `<button class="btn ${i === reviewPanelState.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      } else if (i === reviewPanelState.page - 2 || i === reviewPanelState.page + 2) {
        html += `<span style="color:#999;font-size:12px">...</span>`;
      }
    }
    html += `<button class="btn" ${reviewPanelState.page === totalPages ? 'disabled' : ''} onclick="goToPage(${reviewPanelState.page + 1})">下一页</button>`;
    html += `<span class="page-info">第 ${reviewPanelState.page} / ${totalPages} 页</span>`;
    el.innerHTML = html;
  });
}
function goToPage(page) {
  reviewPanelState.page = page;
  applyFiltersAndRender();
}

// ====== 标签明细弹窗（任务看板点击标签） ======
let tagDetailState = {
  taskId: null,
  level1: null,
  reviews: [],
  page: 1,
  pageSize: 15,
  editingId: null,
};

async function openTagDetailModal(taskId, level1) {
  tagDetailState.taskId = taskId;
  tagDetailState.level1 = level1;
  tagDetailState.page = 1;
  tagDetailState.editingId = null;
  $('#tagDetailTitle').textContent = level1;
  $('#tagDetailModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await loadTagDetailReviews();
}

function closeTagDetailModal() {
  $('#tagDetailModal').style.display = 'none';
  document.body.style.overflow = '';
  tagDetailState.editingId = null;
}

async function loadTagDetailReviews() {
  const { taskId, level1, page, pageSize } = tagDetailState;
  try {
    const url = `${API()}/api/tasks/${taskId}/reviews?page=${page}&page_size=${pageSize}&level1=${encodeURIComponent(level1)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).detail || '加载失败');
    const data = await res.json();
    tagDetailState.reviews = data.reviews || [];
    renderTagDetailReviews(data.total || 0);
  } catch(e) {
    toast('加载标签明细失败: ' + e.message, 'err');
  }
}

function renderTagDetailReviews(total) {
  const tbody = $('#tagDetailTableBody');
  const reviews = tagDetailState.reviews;
  if (!reviews.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">暂无评论</div></div></td></tr>';
    $('#tagDetailPagination').innerHTML = '';
    $('#tagDetailInfo').textContent = '';
    return;
  }

  $('#tagDetailInfo').textContent = `共 ${total} 条评论，当前第 ${tagDetailState.page} 页`;

  tbody.innerHTML = reviews.map(r => {
    const isEditing = tagDetailState.editingId === r.id;
    if (isEditing) {
      return `<tr><td colspan="5">${renderTagDetailEditForm(r)}</td></tr>`;
    }
    const tags = (r.tags || []).filter(t => t.level1 === tagDetailState.level1);
    const tagStr = tags.length
      ? tags.map(t => `<span class="tag-pill">${escapeHtml([t.level1, t.level2, t.level3].filter(Boolean).join('/'))}</span>`).join('')
      : '<span style="color:#999;font-size:12px">—</span>';
    const status = r.status || 'normal';
    const badgeMap = {
      normal: ['badge-normal', '正常'],
      uncertain: ['badge-uncertain', '模糊'],
      rejected: ['badge-rejected', '虚假'],
      reviewed: ['badge-reviewed', '已审核'],
    };
    const [cls, label] = badgeMap[status] || ['badge-normal', status || '未知'];
    return `
      <tr>
        <td style="white-space:nowrap;font-size:12px;color:#888">${escapeHtml(r.review_id || r.id)}</td>
        <td><div class="content-cell" title="${escapeHtml(r.content || '')}">${escapeHtml((r.content || '').substring(0, 60))}${(r.content || '').length > 60 ? '...' : ''}</div></td>
        <td>${tagStr}</td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td>
          <button class="btn" style="padding:3px 8px;font-size:12px" onclick="startTagDetailEdit(${r.id})">编辑</button>
        </td>
      </tr>
    `;
  }).join('');

  // 分页
  const totalPages = Math.max(1, Math.ceil(total / tagDetailState.pageSize));
  let pgHtml = '';
  if (totalPages > 1) {
    pgHtml += `<button class="btn" ${tagDetailState.page === 1 ? 'disabled' : ''} onclick="goTagDetailPage(${tagDetailState.page - 1})">上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= tagDetailState.page - 1 && i <= tagDetailState.page + 1)) {
        pgHtml += `<button class="btn ${i === tagDetailState.page ? 'active' : ''}" onclick="goTagDetailPage(${i})">${i}</button>`;
      } else if (i === tagDetailState.page - 2 || i === tagDetailState.page + 2) {
        pgHtml += `<span style="color:#999;font-size:12px">...</span>`;
      }
    }
    pgHtml += `<button class="btn" ${tagDetailState.page === totalPages ? 'disabled' : ''} onclick="goTagDetailPage(${tagDetailState.page + 1})">下一页</button>`;
    pgHtml += `<span class="page-info">第 ${tagDetailState.page} / ${totalPages} 页</span>`;
  }
  $('#tagDetailPagination').innerHTML = pgHtml;
}

function goTagDetailPage(page) {
  tagDetailState.page = page;
  tagDetailState.editingId = null;
  loadTagDetailReviews();
}

function startTagDetailEdit(reviewId) {
  tagDetailState.editingId = reviewId;
  renderTagDetailReviews(tagDetailState.reviews.length); // 重新渲染以显示编辑表单
}

function renderTagDetailEditForm(r) {
  const tags = (r.tags || []).filter(t => t.level1 === tagDetailState.level1);
  const tagsHtml = tags.map((t, i) => `
    <span class="edit-tag-pill">
      ${escapeHtml([t.level1, t.level2, t.level3].filter(Boolean).join('/'))}${t.level4 ? '/' + escapeHtml(t.level4) : ''}
      <span class="remove-tag" onclick="removeTagDetailTag(${r.id}, ${i})">&times;</span>
    </span>
  `).join('');

  // 动态构建级联下拉框（从评论标签构建层级树）
  const tree = buildHierarchyFromReviews(tagDetailState.reviews);
  const l1 = tagDetailState.level1;
  const l2s = tree[l1] ? Object.keys(tree[l1]).sort() : [];

  return `
    <div style="padding:10px 8px">
      <div style="font-weight:500;margin-bottom:8px;font-size:13px">编辑标签 — 评论 ${escapeHtml(r.review_id || r.id)}</div>
      <div class="current-edit-tags" id="tdEditTags-${r.id}">
        ${tagsHtml || '<span style="color:#999;font-size:12px">暂无标签</span>'}
      </div>
      <div class="tag-form-row">
        <select id="tdEditL2-${r.id}" onchange="onTdEditL2Change(${r.id})"><option value="">选择二级</option>${l2s.map(l2 => `<option value="${escapeHtml(l2)}">${escapeHtml(l2)}</option>`).join('')}</select>
        <select id="tdEditL3-${r.id}" onchange="onTdEditL3Change(${r.id})"><option value="">选择三级</option></select>
        <select id="tdEditL4-${r.id}"><option value="">选择四级（可选）</option></select>
        <input type="number" id="tdEditConf-${r.id}" value="1.0" min="0" max="1" step="0.05" style="width:70px" placeholder="置信度">
        <input type="text" id="tdEditReason-${r.id}" value="人工确认" placeholder="原因" style="width:100px">
        <button class="btn btn-primary" style="padding:4px 10px;font-size:12px" onclick="confirmAddTagDetailTag(${r.id})">添加</button>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn btn-primary" style="padding:4px 14px;font-size:12px" onclick="saveTagDetailEdit(${r.id})">保存</button>
        <button class="btn" style="padding:4px 14px;font-size:12px" onclick="cancelTagDetailEdit()">取消</button>
      </div>
    </div>
  `;
}

let tagDetailEditMap = {};

function removeTagDetailTag(reviewId, idx) {
  if (!tagDetailEditMap[reviewId]) {
    const review = tagDetailState.reviews.find(r => r.id === reviewId);
    tagDetailEditMap[reviewId] = (review?.tags || []).filter(t => t.level1 === tagDetailState.level1).map(t => ({...t}));
  }
  tagDetailEditMap[reviewId].splice(idx, 1);
  refreshTdEditTags(reviewId);
}

function refreshTdEditTags(reviewId) {
  const container = document.getElementById(`tdEditTags-${reviewId}`);
  if (!container) return;
  const tags = tagDetailEditMap[reviewId] || [];
  container.innerHTML = tags.map((t, i) => `
    <span class="edit-tag-pill">
      ${escapeHtml([t.level1, t.level2, t.level3].filter(Boolean).join('/'))}${t.level4 ? '/' + escapeHtml(t.level4) : ''}
      <span class="remove-tag" onclick="removeTagDetailTag(${reviewId}, ${i})">&times;</span>
    </span>
  `).join('') || '<span style="color:#999;font-size:12px">暂无标签</span>';
}

function onTdEditL2Change(reviewId) {
  const l2 = document.getElementById(`tdEditL2-${reviewId}`).value;
  const l3Sel = document.getElementById(`tdEditL3-${reviewId}`);
  const l4Sel = document.getElementById(`tdEditL4-${reviewId}`);
  if (!l3Sel || !l4Sel) return;
  l3Sel.innerHTML = '<option value="">选择三级</option>';
  l4Sel.innerHTML = '<option value="">选择四级（可选）</option>';
  const tree = buildHierarchyFromReviews(tagDetailState.reviews);
  const l1 = tagDetailState.level1;
  if (!l1 || !tree[l1] || !tree[l1][l2]) return;
  Object.keys(tree[l1][l2]).sort().forEach(l3 => {
    l3Sel.innerHTML += `<option value="${escapeHtml(l3)}">${escapeHtml(l3)}</option>`;
  });
}

function onTdEditL3Change(reviewId) {
  const l2 = document.getElementById(`tdEditL2-${reviewId}`).value;
  const l3 = document.getElementById(`tdEditL3-${reviewId}`).value;
  const l4Sel = document.getElementById(`tdEditL4-${reviewId}`);
  if (!l4Sel) return;
  l4Sel.innerHTML = '<option value="">选择四级（可选）</option>';
  const tree = buildHierarchyFromReviews(tagDetailState.reviews);
  const l1 = tagDetailState.level1;
  if (!l1 || !l2 || !l3 || !tree[l1] || !tree[l1][l2] || !tree[l1][l2][l3]) return;
  const l4s = tree[l1][l2][l3] || [];
  l4s.sort().forEach(l4 => {
    if (l4) l4Sel.innerHTML += `<option value="${escapeHtml(l4)}">${escapeHtml(l4)}</option>`;
  });
}

function confirmAddTagDetailTag(reviewId) {
  const l1 = tagDetailState.level1;
  const l2El = document.getElementById(`tdEditL2-${reviewId}`);
  const l3El = document.getElementById(`tdEditL3-${reviewId}`);
  const l4El = document.getElementById(`tdEditL4-${reviewId}`);
  const confEl = document.getElementById(`tdEditConf-${reviewId}`);
  const reasonEl = document.getElementById(`tdEditReason-${reviewId}`);
  if (!l2El || !l3El) return;
  const l2 = l2El.value, l3 = l3El.value, l4 = l4El ? l4El.value : '';
  if (!l2 || !l3) { toast('请选择完整的标签路径', 'err'); return; }
  if (!tagDetailEditMap[reviewId]) {
    const review = tagDetailState.reviews.find(r => r.id === reviewId);
    tagDetailEditMap[reviewId] = (review?.tags || []).filter(t => t.level1 === l1).map(t => ({...t}));
  }
  tagDetailEditMap[reviewId].push({
    level1: l1, level2: l2, level3: l3, level4: l4,
    confidence: parseFloat(confEl ? confEl.value : '1.0') || 1.0,
    reason: reasonEl ? reasonEl.value : '人工确认',
  });
  refreshTdEditTags(reviewId);
  l2El.value = ''; onTdEditL2Change(reviewId);
}

async function saveTagDetailEdit(reviewId) {
  const tags = (tagDetailEditMap[reviewId] || []).map(t => ({
    level1: t.level1, level2: t.level2, level3: t.level3, level4: t.level4 || '',
    confidence: t.confidence == null ? 1.0 : parseFloat(t.confidence),
    reason: t.reason || '人工确认',
  }));
  try {
    const res = await fetch(`${API()}/api/tasks/${tagDetailState.taskId}/reviews/${reviewId}/tags`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(tags),
    });
    if (!res.ok) throw new Error((await res.json()).detail || '保存失败');
    // 更新本地数据
    const review = tagDetailState.reviews.find(r => r.id === reviewId);
    if (review) {
      review.tags = review.tags.filter(t => t.level1 !== tagDetailState.level1);
      review.tags.push(...tags.map(t => ({...t, is_manual: true})));
      review.status = 'reviewed';
    }
    tagDetailState.editingId = null;
    delete tagDetailEditMap[reviewId];
    renderTagDetailReviews(tagDetailState.reviews.length);
    toast('标签已保存', 'ok');
  } catch(e) {
    toast('保存失败: ' + e.message, 'err');
  }
}

function cancelTagDetailEdit() {
  tagDetailState.editingId = null;
  renderTagDetailReviews(tagDetailState.reviews.length);
}
