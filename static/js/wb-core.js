// ====== 工具函数 ======
const $ = (sel) => document.querySelector(sel);
const API = () => {
  const val = ($('#apiBase').value || '').replace(/\/$/, '');
  if (val) return val;
  // 未配置时自动使用当前页面 origin（避免 file:// 协议下请求失败）
  return window.location.origin || '';
};

function toast(msg, type='info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function setApiStatus(ok) {
  const el = $('#apiStatus');
  el.className = 'status ' + (ok ? 'ok' : 'err');
}

async function checkApi() {
  try {
    const res = await fetch(API() + '/api/tasks/test404', { method: 'GET' });
    setApiStatus(true);
  } catch(e) {
    setApiStatus(false);
  }
}

function buildFormData(obj) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) fd.append(k, v);
  }
  return fd;
}

function renderTable(tableEl, rows, columns) {
  const thead = tableEl.querySelector('thead');
  const tbody = tableEl.querySelector('tbody');
  thead.innerHTML = '<tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr>';
  tbody.innerHTML = rows.map(r => '<tr>' + columns.map(c => `<td title="${(r[c]||'').toString().replace(/"/g,'&quot;')}">${r[c]||''}</td>`).join('') + '</tr>').join('');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}
function tagPills(tags) {
  if (!tags || !tags.length) return '<span style="color:#999;font-size:12px">—</span>';
  return tags.map(t => {
    const path = [t.level1, t.level2, t.level3].filter(Boolean).join('/');
    return `<span class="tag-pill">${escapeHtml(path)}</span>`;
  }).join('');
}
function scoreBar(score) {
  const s = score == null ? 1.0 : parseFloat(score);
  let color = 'score-high';
  if (s < 0.5) color = 'score-low';
  else if (s < 0.8) color = 'score-mid';
  return `<div class="score-bar"><div class="score-bar-fill ${color}" style="width:${Math.round(Math.min(1, Math.max(0, s))*100)}%"></div></div><span style="font-size:12px">${s.toFixed(2)}</span>`;
}
function statusBadge(status) {
  const map = {
    normal: ['badge-normal', '正常'],
    uncertain: ['badge-uncertain', '模糊'],
    rejected: ['badge-rejected', '虚假'],
    reviewed: ['badge-reviewed', '已审核'],
    tagged: ['badge-normal', '已打标'],
    pending: ['badge-normal', '待处理'],
  };
  const [cls, label] = map[status] || ['badge-normal', status || '未知'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ====== 文件上传 ======
let tagFile = null, reviewFile = null, prevOutputFile = null;
let currentTagMode = 'single';  // 'single' | 'multi'
let tagProfiles = [];           // {profile_id, name, file_path, columns, row_count}
let mappingRules = [];          // {id, name, conditions: [{column, op, value}], profile_id, priority}
let currentMappingConfigKey = null;

function setupDropzone(dropId, inputId, infoId, onUpload, opts={}) {
  const drop = $(dropId), input = $(inputId), info = $(infoId);
  if (!drop) return;
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('dragover');
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  });
  input.addEventListener('change', () => { const f = input.files[0]; if (f) handleFile(f); });

  async function handleFile(file) {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) { toast('仅支持 CSV / Excel 文件', 'err'); return; }
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(API() + '/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || '上传失败');
      const data = await res.json();
      onUpload(data, file);
      info.style.display = 'block';
      info.innerHTML = `<div class="file-info"><span>📎 ${file.name}</span><span style="color:#888">(${data.row_count} 行, ${data.columns.length} 列)</span><span class="remove" title="移除">&times;</span></div>`;
      info.querySelector('.remove').onclick = () => {
        onUpload(null, null); info.style.display = 'none';
        if (opts.showDropzone) opts.showDropzone();
      };
      if (opts.hideDropzone) opts.hideDropzone();
      toast('上传成功', 'ok');
    } catch(e) {
      toast('上传失败: ' + e.message, 'err');
    }
  }
}

function toggleIncremental() {
  const enabled = $('#enableIncremental').checked;
  $('#incrementalOptions').style.display = enabled ? 'block' : 'none';
}

// ====== Prompt 预览 ======
$('#btnPreviewPrompt').addEventListener('click', async () => {
  let tagFileId = null;
  if (currentTagMode === 'single') {
    if (!tagFile) { toast('请先上传标签体系文件', 'err'); return; }
    tagFileId = tagFile.file_id;
  } else {
    if (!tagProfiles.length) { toast('请先上传标签方案', 'err'); return; }
    const opts = tagProfiles.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const choice = prompt(`选择要预览的方案（输入序号 1-${tagProfiles.length}）：\n${opts}`, '1');
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (idx < 0 || idx >= tagProfiles.length) { toast('无效选择', 'err'); return; }
    tagFileId = tagProfiles[idx].file_path;
  }
  const reviewText = prompt('输入一条示例评论：', '衣服质量很好，但是物流太慢了');
  if (!reviewText) return;
  const fd = buildFormData({
    review_text: reviewText,
    tag_file_id: tagFileId,
    provider: $('#provider').value,
    model: $('#model').value,
  });
  try {
    const res = await fetch(API() + '/api/preview-prompt', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json()).detail);
    const data = await res.json();
    $('#promptPreview').textContent = data.prompt;
    $('#promptPreviewWrap').style.display = 'block';
  } catch(e) {
    toast('预览失败: ' + e.message, 'err');
  }
});

// ====== 打标执行 ======
let currentTaskId = null;
let eventSource = null;

function resetResult() {
  $('#progressWrap').style.display = 'none';
  $('#resultWrap').style.display = 'none';
  $('#errorWrap').style.display = 'none';
  $('#btnDownload').style.display = 'none';
  $('#progressFill').style.width = '0%';
  $('#step4ReviewContainer').innerHTML = '';
  if (eventSource) { eventSource.close(); eventSource = null; }
}

$('#btnStartTag').addEventListener('click', async () => {
  if (!reviewFile) { toast('请先上传评论文件', 'err'); return; }
  if (!$('#apiKey').value.trim()) { toast('请填写 API Key', 'err'); return; }

  const isMulti = currentTagMode === 'multi';
  if (isMulti) {
    if (!tagProfiles.length) { toast('请至少上传一个标签方案', 'err'); return; }
    if (!mappingRules.length) { toast('请至少配置一条映射规则', 'err'); return; }
  } else {
    if (!tagFile) { toast('请先上传标签体系文件', 'err'); return; }
  }

  resetResult();
  $('#progressWrap').style.display = 'block';
  $('#btnStartTag').disabled = true;
  $('#btnStartTag').innerHTML = '<span class="spinner"></span> 启动中...';

  const commonData = {
    review_file_id: reviewFile.file_id,
    content_column: $('#contentColumn').value,
    id_column: $('#idColumn').value || null,
    output_format: $('#outputFormat').value,
    provider: $('#provider').value,
    model: $('#model').value,
    api_key: $('#apiKey').value.trim(),
    base_url: $('#baseUrl').value.trim() || null,
    concurrency: parseInt($('#concurrency').value, 10),
    batch_size: parseInt($('#batchSize').value, 10),
    use_json_mode: $('#useJsonMode').checked,
    confidence_threshold: parseFloat($('#confidenceThreshold').value),
    sharding_enabled: $('#enableSharding').checked,
    shard_size: parseInt($('#shardSize').value, 10) || 200,
    max_shards: parseInt($('#maxShards').value, 10) || 10,
  };

  try {
    let res;
    if (isMulti) {
      // 先保存映射配置
      const config = buildMappingConfig();
      const configRes = await fetch(API() + '/api/tag-mapping-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!configRes.ok) throw new Error((await configRes.json()).detail || '保存映射配置失败');
      const configData = await configRes.json();
      const fd = buildFormData({ ...commonData, config_key: configData.config_key });
      res = await fetch(API() + '/api/tag-multi', { method: 'POST', body: fd });
    } else {
      let tagParam = {};
    if (tagFile && tagFile.tag_system_id) {
      tagParam = { tag_system_id: tagFile.tag_system_id };
    } else if (tagFile && tagFile.file_id) {
      tagParam = { tag_file_id: tagFile.file_id };
    }
    const fd = buildFormData({ ...commonData, ...tagParam });
      if ($('#enableIncremental').checked && prevOutputFile) {
        fd.append('previous_output_path', prevOutputFile.file_id);
        fd.append('strategy', $('#incrementalStrategy').value);
      }
      res = await fetch(API() + '/api/tag', { method: 'POST', body: fd });
    }
    if (!res.ok) throw new Error((await res.json()).detail || '启动失败');
    const data = await res.json();
    currentTaskId = data.task_id;
    startSSE(currentTaskId);
    toast('打标任务已启动', 'ok');
  } catch(e) {
    $('#btnStartTag').disabled = false;
    $('#btnStartTag').innerHTML = '▶ 开始打标';
    $('#progressWrap').style.display = 'none';
    toast('启动失败: ' + e.message, 'err');
  }
});

function startSSE(taskId) {
  const url = API() + '/api/tasks/' + taskId + '/events';
  eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'progress') {
      const pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0;
      $('#progressFill').style.width = pct + '%';
      $('#progressText').textContent = `${data.done} / ${data.total} (${pct}%) — ${data.status === 'running' ? '打标中...' : data.status}`;
    } else if (data.type === 'end') {
      eventSource.close(); eventSource = null;
      $('#btnStartTag').disabled = false;
      $('#btnStartTag').innerHTML = '▶ 开始打标';
      if (data.status === 'completed') {
        $('#progressText').textContent = '✅ 打标完成';
        $('#btnDownload').style.display = 'inline-flex';
        if (data.preview && data.preview.length) {
          $('#resultWrap').style.display = 'block';
          const cols = Object.keys(data.preview[0]);
          renderTable($('#resultPreviewTable'), data.preview, cols);
        }
        saveRecentTask(taskId);
        initReviewPanel('step4ReviewContainer');
        loadAllReviews(taskId);
        toast('打标完成', 'ok');
      } else {
        $('#progressText').textContent = '❌ 打标失败';
        $('#errorWrap').style.display = 'block';
        $('#errorWrap').textContent = data.error || '未知错误';
        toast('打标失败，请查看错误信息', 'err');
      }
    }
  };

  eventSource.onerror = () => {
    eventSource.close(); eventSource = null;
    $('#btnStartTag').disabled = false;
    $('#btnStartTag').innerHTML = '▶ 开始打标';
  };
}

// ====== 下载 ======
$('#btnDownload').addEventListener('click', () => {
  if (!currentTaskId) return;
  const a = document.createElement('a');
  a.href = API() + '/api/download/' + currentTaskId;
  a.download = 'tagged_reviews.csv';
  a.click();
});

// ====== 预置标签体系 ======
async function loadPresetTags() {
  try {
    const res = await fetch(API() + '/api/preset-tags');
    if (!res.ok) return;
    const data = await res.json();
    const sel = $('#presetTagSelect');
    if (!data.presets || !data.presets.length) {
      $('#presetTagWrap').style.display = 'none';
      return;
    }
    sel.innerHTML = '<option value="">-- 请选择 --</option>' +
      data.presets.map(p => `<option value="${encodeURIComponent(JSON.stringify(p))}">${p.category}/${p.name} (${p.row_count}行)</option>`).join('');
  } catch(e) {
    console.error('加载预置标签体系失败', e);
  }
}

$('#presetTagSelect').addEventListener('change', () => {
  const val = $('#presetTagSelect').value;
  if (!val) return;
  const p = JSON.parse(decodeURIComponent(val));
  tagFile = {
    file_id: p.path,
    filename: p.name,
    columns: p.columns,
    row_count: p.row_count,
  };
  $('#tagDropzone').style.display = 'none';
  const info = $('#tagFileInfo');
  info.style.display = 'block';
  info.innerHTML = `<div class="file-info"><span>📎 ${p.name}</span><span style="color:#888">(${p.row_count} 行, ${p.columns.length} 列)</span><span class="remove" title="移除">&times;</span></div>`;
  info.querySelector('.remove').onclick = () => {
    tagFile = null;
    info.style.display = 'none';
    $('#tagDropzone').style.display = 'block';
    $('#presetTagSelect').value = '';
  };
});
