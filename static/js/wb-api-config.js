// ====== API 配置管理 ======
var API_CONFIG_KEY = 'review_tagger_api_configs';
var apiConfigEditingId = null;

function _encodeKey(key) {
  if (!key) return '';
  try { return btoa(key); } catch(e) { return key; }
}
function _decodeKey(encoded) {
  if (!encoded) return '';
  try { return atob(encoded); } catch(e) { return encoded; }
}
function _maskKey(key) {
  if (!key || key.length < 8) return '******';
  return key.slice(0, 3) + '****' + key.slice(-3);
}
function _loadApiConfigs() {
  try {
    const raw = localStorage.getItem(API_CONFIG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}
function _saveApiConfigs(list) {
  try {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('保存 API 配置失败:', e);
    if (e.name === 'QuotaExceededError') {
      toast('浏览器存储空间已满，无法保存配置', 'err');
    } else if (e.name === 'SecurityError') {
      toast('浏览器禁止本地存储（请关闭隐私模式或允许 Cookie）', 'err');
    } else {
      toast('保存配置失败: ' + e.message, 'err');
    }
    return false;
  }
}

function loadApiConfigSelect() {
  const sel = $('#apiConfigSelect');
  const configs = _loadApiConfigs();
  const prevVal = sel.value;
  let html = '<option value="">-- 手动填写 --</option>';
  configs.forEach(c => {
    if (!c || !c.id) return; // 跳过无效配置
    html += `<option value="${c.id}">${escapeHtml(c.name || '未命名')} (${c.provider || 'openai'}/${c.model || '?'})</option>`;
  });
  sel.innerHTML = html;
  // 尝试恢复之前选中的值
  if (prevVal && configs.some(c => c.id === prevVal)) {
    sel.value = prevVal;
  }
  console.log('[api-config] loaded', configs.length, 'configs:', configs.map(c => ({ id: c.id, name: c.name, hasKey: !!c.apiKeyEncoded })));
}

function applyApiConfig(id) {
  if (!id) return;
  const configs = _loadApiConfigs();
  const cfg = configs.find(c => c.id === id);
  if (!cfg) {
    toast('配置不存在，可能已被删除', 'err');
    console.error('[api-config] config not found for id:', id);
    return;
  }
  console.log('[api-config] applying config:', cfg.name, cfg.provider, cfg.model);
  $('#provider').value = cfg.provider || 'openai';
  $('#model').value = cfg.model || '';
  const decodedKey = _decodeKey(cfg.apiKeyEncoded);
  $('#apiKey').value = decodedKey || '';
  $('#baseUrl').value = cfg.baseUrl || '';
  if (!decodedKey) {
    toast('警告: 配置中未找到 API Key，请手动填写', 'err');
    console.error('[api-config] apiKey empty after decode, raw:', cfg.apiKeyEncoded);
  } else {
    toast('已加载配置: ' + cfg.name, 'ok');
  }
}

function saveCurrentApiConfig() {
  try {
    const name = prompt('给当前配置取个名字（如：公司 OpenAI）:');
    if (!name || !name.trim()) return;
    const provider = $('#provider').value;
    const model = $('#model').value;
    const apiKey = $('#apiKey').value.trim();
    if (!apiKey) { toast('请先填写 API Key', 'err'); return; }
    const configs = _loadApiConfigs();
    const newId = 'cfg_' + Date.now();
    configs.push({
      id: newId,
      name: name.trim(),
      provider,
      model,
      apiKeyEncoded: _encodeKey(apiKey),
      baseUrl: $('#baseUrl').value.trim(),
      createdAt: new Date().toISOString(),
    });
    if (!_saveApiConfigs(configs)) return;
    loadApiConfigSelect();
    // 自动选中新保存的配置
    $('#apiConfigSelect').value = newId;
    toast('配置已保存并选中', 'ok');
  } catch (e) {
    console.error('saveCurrentApiConfig 出错:', e);
    toast('保存失败: ' + e.message, 'err');
  }
}

function openApiConfigManager() {
  $('#apiConfigModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderApiConfigList();
  resetApiConfigForm();
}
function closeApiConfigManager() {
  $('#apiConfigModal').style.display = 'none';
  document.body.style.overflow = '';
  loadApiConfigSelect(); // 关闭时刷新下拉框，确保显示最新配置
}

function renderApiConfigList() {
  const container = $('#apiConfigList');
  const configs = _loadApiConfigs();
  if (!configs.length) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:20px">暂无保存的配置</p>';
    return;
  }
  let html = '<div style="overflow:auto;border:1px solid #eee;border-radius:6px"><table class="preview-table"><thead><tr><th>名称</th><th>提供商</th><th>模型</th><th>Key</th><th>操作</th></tr></thead><tbody>';
  configs.forEach(c => {
    html += `<tr>`;
    html += `<td>${escapeHtml(c.name)}</td>`;
    html += `<td>${c.provider}</td>`;
    html += `<td>${escapeHtml(c.model)}</td>`;
    html += `<td><code>${_maskKey(_decodeKey(c.apiKeyEncoded))}</code></td>`;
    html += `<td>`;
    html += `<button class="btn" style="padding:3px 8px;font-size:12px" onclick="editApiConfig('${c.id}')">编辑</button> `;
    html += `<button class="btn" style="padding:3px 8px;font-size:12px;color:#dc2626;border-color:#dc2626" onclick="deleteApiConfig('${c.id}')">删除</button>`;
    html += `</td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function editApiConfig(id) {
  const configs = _loadApiConfigs();
  const cfg = configs.find(c => c.id === id);
  if (!cfg) return;
  apiConfigEditingId = id;
  $('#apiConfigFormTitle').textContent = '编辑配置';
  $('#cfgName').value = cfg.name || '';
  $('#cfgProvider').value = cfg.provider || 'openai';
  $('#cfgModel').value = cfg.model || '';
  $('#cfgBaseUrl').value = cfg.baseUrl || '';
  $('#cfgApiKey').value = _decodeKey(cfg.apiKeyEncoded) || '';
}

function deleteApiConfig(id) {
  if (!confirm('确定删除此配置？')) return;
  let configs = _loadApiConfigs();
  configs = configs.filter(c => c.id !== id);
  if (!_saveApiConfigs(configs)) return;
  renderApiConfigList();
  loadApiConfigSelect();
  toast('已删除', 'ok');
}

function submitApiConfig() {
  try {
    const name = $('#cfgName').value.trim();
    const provider = $('#cfgProvider').value;
    const model = $('#cfgModel').value.trim();
    const baseUrl = $('#cfgBaseUrl').value.trim();
    const apiKey = $('#cfgApiKey').value.trim();
    if (!name) { toast('请填写配置名称', 'err'); return; }
    if (!apiKey) { toast('请填写 API Key', 'err'); return; }

    const configs = _loadApiConfigs();
    let targetId = apiConfigEditingId;
    if (apiConfigEditingId) {
      const idx = configs.findIndex(c => c.id === apiConfigEditingId);
      if (idx >= 0) {
        configs[idx] = { ...configs[idx], name, provider, model, baseUrl, apiKeyEncoded: _encodeKey(apiKey) };
      }
    } else {
      targetId = 'cfg_' + Date.now();
      configs.push({
        id: targetId,
        name, provider, model, baseUrl,
        apiKeyEncoded: _encodeKey(apiKey),
        createdAt: new Date().toISOString(),
      });
    }
    if (!_saveApiConfigs(configs)) return; // 保存失败，已显示错误提示
    renderApiConfigList();
    loadApiConfigSelect();
    // 保存后自动应用到主界面表单
    if (targetId) {
      $('#apiConfigSelect').value = targetId;
      applyApiConfig(targetId);
    }
    resetApiConfigForm();
    toast(apiConfigEditingId ? '配置已更新并应用' : '配置已保存并应用', 'ok');
  } catch (e) {
    console.error('submitApiConfig 出错:', e);
    toast('保存失败: ' + e.message, 'err');
  }
}

function resetApiConfigForm() {
  apiConfigEditingId = null;
  $('#apiConfigFormTitle').textContent = '新增配置';
  $('#cfgName').value = '';
  $('#cfgProvider').value = 'openai';
  $('#cfgModel').value = '';
  $('#cfgBaseUrl').value = '';
  $('#cfgApiKey').value = '';
}
