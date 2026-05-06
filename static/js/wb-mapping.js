// ====== 多维度标签映射 ======
function setTagMode(mode) {
  currentTagMode = mode;
  $('#btnSingleMode').style.background = mode === 'single' ? '#2563eb' : '#fff';
  $('#btnSingleMode').style.color = mode === 'single' ? '#fff' : '#333';
  $('#btnSingleMode').style.borderColor = mode === 'single' ? '#2563eb' : '#ddd';
  $('#btnMultiMode').style.background = mode === 'multi' ? '#2563eb' : '#fff';
  $('#btnMultiMode').style.color = mode === 'multi' ? '#fff' : '#333';
  $('#btnMultiMode').style.borderColor = mode === 'multi' ? '#2563eb' : '#ddd';
  $('#singleTagMode').style.display = mode === 'single' ? 'block' : 'none';
  $('#multiTagMode').style.display = mode === 'multi' ? 'block' : 'none';
}

// 标签方案上传
function setupProfileDropzone() {
  const drop = $('#profileDropzone'), input = $('#profileFileInput');
  if (!drop) return;
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('dragover');
    Array.from(e.dataTransfer.files).forEach(f => uploadProfileFile(f));
  });
  input.addEventListener('change', () => {
    Array.from(input.files).forEach(f => uploadProfileFile(f));
    input.value = '';
  });
}

async function uploadProfileFile(file) {
  if (!file.name.match(/\.(csv|xlsx|xls)$/i)) { toast('仅支持 CSV / Excel 文件: ' + file.name, 'err'); return; }
  const name = prompt('给这个标签方案取个名字（如：鞋子-购后）:', file.name.replace(/\.[^.]+$/, ''));
  if (!name || !name.trim()) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name.trim());
  try {
    const res = await fetch(API() + '/api/tag-profiles', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json()).detail || '上传失败');
    const data = await res.json();
    tagProfiles.push(data);
    renderProfileList();
    updateDefaultProfileOptions();
    toast(`方案「${data.name}」上传成功`, 'ok');
  } catch(e) {
    toast('上传失败: ' + e.message, 'err');
  }
}

function renderProfileList() {
  const container = $('#profileList');
  if (!tagProfiles.length) { container.innerHTML = '<span style="color:#888;font-size:13px">暂无方案，请上传标签体系文件</span>'; return; }
  container.innerHTML = tagProfiles.map((p, idx) => `
    <div class="profile-card">
      <span class="profile-name">${escapeHtml(p.name)}</span>
      <span style="color:#888">${p.row_count} 行 / ${p.columns.length} 列</span>
      <span class="profile-desc">ID: ${escapeHtml(p.profile_id)}</span>
      <span class="remove" onclick="removeProfile(${idx})" title="移除">&times;</span>
    </div>
  `).join('');
}

function removeProfile(idx) {
  tagProfiles.splice(idx, 1);
  renderProfileList();
  updateDefaultProfileOptions();
  // 清理引用该方案的规则
  mappingRules = mappingRules.filter(r => tagProfiles.some(p => p.profile_id === r.profile_id));
  renderMappingRules();
}

function updateDefaultProfileOptions() {
  const sel = $('#defaultProfileSelect');
  let html = '<option value="">-- 请选择默认方案（无规则匹配时使用）--</option>';
  tagProfiles.forEach(p => {
    html += `<option value="${escapeHtml(p.profile_id)}">${escapeHtml(p.name)}</option>`;
  });
  sel.innerHTML = html;
}

// 映射规则
function addMappingRule() {
  if (!tagProfiles.length) { toast('请先上传至少一个标签方案', 'err'); return; }
  if (!reviewFile) { toast('请先上传评论文件，以便选择条件列', 'err'); return; }
  const ruleId = 'rule_' + Date.now();
  mappingRules.push({
    id: ruleId,
    name: '',
    conditions: [{ column: reviewFile.columns[0] || '', op: '==', value: '' }],
    profile_id: tagProfiles[0].profile_id,
    priority: mappingRules.length,
  });
  renderMappingRules();
}

function removeMappingRule(ruleId) {
  mappingRules = mappingRules.filter(r => r.id !== ruleId);
  renderMappingRules();
}

function updateRuleCondition(ruleId, condIdx, field, value) {
  const rule = mappingRules.find(r => r.id === ruleId);
  if (!rule) return;
  if (field === 'profile_id') {
    rule.profile_id = value;
  } else {
    rule.conditions[condIdx][field] = value;
  }
}

function addConditionToRule(ruleId) {
  const rule = mappingRules.find(r => r.id === ruleId);
  if (!rule) return;
  rule.conditions.push({ column: reviewFile.columns[0] || '', op: '==', value: '' });
  renderMappingRules();
}

function removeConditionFromRule(ruleId, condIdx) {
  const rule = mappingRules.find(r => r.id === ruleId);
  if (!rule || rule.conditions.length <= 1) return;
  rule.conditions.splice(condIdx, 1);
  renderMappingRules();
}

function renderMappingRules() {
  const container = $('#mappingRulesContainer');
  if (!mappingRules.length) { container.innerHTML = '<span style="color:#888;font-size:13px">暂无规则，点击上方按钮添加</span>'; return; }

  const colOpts = reviewFile ? reviewFile.columns.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('') : '';
  const opOpts = ['==', '!=', 'contains', 'in', 'starts_with', 'ends_with', 'regex'].map(o => `<option value="${o}">${o}</option>`).join('');
  const profileOpts = tagProfiles.map(p => `<option value="${escapeHtml(p.profile_id)}">${escapeHtml(p.name)}</option>`).join('');

  container.innerHTML = mappingRules.map((rule, ri) => `
    <div class="mapping-rule">
      <span class="rule-num">${ri + 1}</span>
      <div style="display:flex;flex-direction:column;gap:6px;flex:1">
        ${rule.conditions.map((cond, ci) => `
          <div class="condition-row">
            <span style="font-size:12px;color:#888">当</span>
            <select onchange="updateRuleCondition('${rule.id}', ${ci}, 'column', this.value)">${colOpts.replace(`value="${cond.column}"`, `value="${cond.column}" selected`)}</select>
            <select onchange="updateRuleCondition('${rule.id}', ${ci}, 'op', this.value)">${opOpts.replace(`value="${cond.op}"`, `value="${cond.op}" selected`)}</select>
            <input type="text" placeholder="匹配值" value="${escapeHtml(cond.value)}" onchange="updateRuleCondition('${rule.id}', ${ci}, 'value', this.value)" style="width:140px">
            ${rule.conditions.length > 1 ? `<span style="color:#dc2626;cursor:pointer;font-size:16px" onclick="removeConditionFromRule('${rule.id}', ${ci})" title="删除条件">&times;</span>` : ''}
            ${ci === rule.conditions.length - 1 ? `<button class="btn" style="padding:2px 8px;font-size:12px" onclick="addConditionToRule('${rule.id}')">+ 且</button>` : '<span style="font-size:12px;color:#888">且</span>'}
          </div>
        `).join('')}
        <div class="condition-row">
          <span style="font-size:12px;color:#888">则使用方案</span>
          <select onchange="updateRuleCondition('${rule.id}', 0, 'profile_id', this.value)">${profileOpts.replace(`value="${rule.profile_id}"`, `value="${rule.profile_id}" selected`)}</select>
        </div>
      </div>
      <span class="remove-rule" onclick="removeMappingRule('${rule.id}')" title="删除规则">&times;</span>
    </div>
  `).join('');
}

function buildMappingConfig() {
  return {
    profiles: tagProfiles.map(p => ({
      id: p.profile_id,
      name: p.name,
      description: '',
      file_path: p.file_path,
    })),
    rules: mappingRules.map(r => ({
      id: r.id,
      name: r.name,
      conditions: r.conditions,
      profile_id: r.profile_id,
      priority: r.priority,
    })),
    default_profile_id: $('#defaultProfileSelect').value || null,
  };
}

async function previewMapping() {
  if (!reviewFile) { toast('请先上传评论文件', 'err'); return; }
  if (!tagProfiles.length) { toast('请先上传标签方案', 'err'); return; }

  const config = buildMappingConfig();
  try {
    // 保存配置获取 key
    const configRes = await fetch(API() + '/api/tag-mapping-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!configRes.ok) throw new Error((await configRes.json()).detail || '保存配置失败');
    const configData = await configRes.json();
    currentMappingConfigKey = configData.config_key;

    const fd = new FormData();
    fd.append('review_file_id', reviewFile.file_id);
    fd.append('config_key', configData.config_key);
    const res = await fetch(API() + '/api/tag-mapping-preview', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json()).detail || '预览失败');
    const data = await res.json();

    $('#mappingPreviewWrap').style.display = 'block';
    const cols = ['matched_profile_name'].concat(reviewFile.columns || []);
    const rows = data.preview.map(r => {
      const row = { matched_profile_name: r.matched_profile_name || '(未匹配)' };
      Object.entries(r.row_data || {}).forEach(([k, v]) => { row[k] = v; });
      return row;
    });
    renderTable($('#mappingPreviewTable'), rows, cols);
    toast('映射预览已生成', 'ok');
  } catch(e) {
    toast('预览失败: ' + e.message, 'err');
  }
}
