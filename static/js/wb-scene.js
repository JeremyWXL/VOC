// ====== 场景识别与标签自动生成 ======

let detectedScene = null;  // 缓存识别结果
let generatedTagCsv = null; // 缓存生成的标签 CSV

async function detectScene() {
  if (!reviewFile) { toast('请先上传评论文件', 'err'); return; }
  const btn = $('#btnDetectScene');
  const txt = $('#detectSceneText');
  const resultDiv = $('#sceneDetectResult');
  btn.disabled = true;
  txt.textContent = '⏳ 识别中...';
  resultDiv.style.display = 'none';

  try {
    const fd = new FormData();
    fd.append('review_file_id', reviewFile.file_id);
    fd.append('content_column', $('#contentColumn').value || '评论内容');
    fd.append('sample_size', '20');

    const apiUrl = API() + '/api/detect-scene';
    console.log('[scene] calling', apiUrl, 'file_id=', reviewFile.file_id);
    const res = await fetch(apiUrl, { method: 'POST', body: fd });
    if (!res.ok) {
      let errMsg = '识别失败';
      try {
        const errBody = await res.json();
        errMsg = errBody.detail || JSON.stringify(errBody);
      } catch (_) {
        errMsg = await res.text() || ('HTTP ' + res.status);
      }
      throw new Error(errMsg);
    }
    const data = await res.json();
    detectedScene = data;
    console.log('[scene] success', data);

    openSceneModal(data);
  } catch (e) {
    console.error('[scene] error', e);
    toast('场景识别失败: ' + e.message, 'err');
    txt.textContent = '🎯 识别场景并生成';
    btn.disabled = false;
  }
}

function openSceneModal(data) {
  const modal = document.createElement('div');
  modal.id = 'sceneModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:520px">
      <div class="modal-header">
        <div style="font-size:16px;font-weight:600">🎯 场景识别结果</div>
        <button class="close-btn" onclick="closeSceneModal()">&times;</button>
      </div>
      <div style="padding:20px">
        <div style="background:#f5f5f5;border-radius:8px;padding:14px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:28px">🔍</span>
            <div>
              <div style="font-size:16px;font-weight:600;color:#333">${data.display_name}</div>
              <div style="font-size:12px;color:#666;margin-top:2px">置信度: ${(data.confidence * 100).toFixed(0)}% ${data.is_fallback ? '(keyword兜底)' : ''}</div>
            </div>
          </div>
          <div style="font-size:13px;color:#555;line-height:1.5">${data.description}</div>
          ${data.keywords && data.keywords.length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${data.keywords.map(k => `<span style="background:#dbeafe;color:#1565c0;padding:2px 8px;border-radius:12px;font-size:12px">${k}</span>`).join('')}</div>` : ''}
        </div>
        <label style="font-size:13px;font-weight:500;color:#444;display:block;margin-bottom:8px">或手动选择场景：</label>
        <select id="sceneSelect" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:16px">
          ${allScenes.map(s => `<option value="${s.scene_type}" ${s.scene_type === data.scene_type ? 'selected' : ''}>${s.display_name}</option>`).join('')}
        </select>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn" onclick="closeSceneModal()">取消</button>
          <button class="btn btn-primary" onclick="confirmSceneAndGenerate()">✨ 生成标签体系</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeSceneModal() {
  const m = $('#sceneModal');
  if (m) m.remove();
  $('#detectSceneText').textContent = '🎯 识别场景并生成';
  $('#btnDetectScene').disabled = false;
}

async function confirmSceneAndGenerate() {
  const sceneType = $('#sceneSelect').value;
  const btn = document.querySelector('#sceneModal .btn-primary');
  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';

  try {
    const res = await fetch(API() + '/api/generate-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_type: sceneType,
        review_file_id: reviewFile.file_id,
        content_column: $('#contentColumn').value || '评论内容',
        use_template: true,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || '生成失败');
    const data = await res.json();
    generatedTagCsv = data.csv_content;

    // 将 CSV 转为 File 对象，模拟上传
    const blob = new Blob(['\uFEFF' + data.csv_content], { type: 'text/csv' });
    const file = new File([blob], `auto_tags_${sceneType}.csv`, { type: 'text/csv' });

    // 模拟 setupDropzone 的回调
    const formData = new FormData();
    formData.append('file', file);
    const upRes = await fetch(API() + '/api/upload', { method: 'POST', body: formData });
    if (!upRes.ok) throw new Error('上传生成的标签文件失败');
    const upData = await upRes.json();

    tagFile = upData;
    // 同时提供保存到标签库的选项
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.style.cssText = 'margin-top:10px;background:#059669;color:#fff;border-color:#059669';
    saveBtn.textContent = '💾 保存到标签库';
    saveBtn.onclick = async () => {
      const name = prompt('标签体系名称:', SceneType.display_name(scene) + ' 标签体系');
      if (!name) return;
      try {
        const res = await fetch(API() + '/api/tag-systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, csv_content: data.csv_content, scene_type: data.scene_type }),
        });
        if (!res.ok) throw new Error('保存失败');
        const ts = await res.json();
        selectTagSystem(ts);
        toast('已保存到标签库', 'ok');
        saveBtn.remove();
      } catch (e) { toast(e.message, 'err'); }
    };

    // 更新 UI
    const info = $('#tagFileInfo');
    info.style.display = 'block';
    info.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">✨</span>
      <div>
        <div style="font-weight:500">${upData.filename}</div>
        <div style="font-size:12px;color:#666">${upData.row_count} 条标签路径 · ${data.level1_count} 个一级标签 · ${data.is_template ? '模板生成' : 'LLM生成'}</div>
      </div>
    </div>`;
    $('#tagDropzone').style.display = 'none';

    // 显示生成摘要
    const resultDiv = $('#sceneDetectResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<span style="color:#2e7d32">✅ 已自动生成标签体系：</span>
      <strong>${data.display_name}</strong>，
      ${data.level1_count} 个一级标签，${data.tag_count} 条标签路径
      ${data.is_template ? '（基于模板）' : '（LLM动态生成）'}`;

    closeSceneModal();
    toast(`标签体系生成完成: ${data.display_name}`, 'ok');
  } catch (e) {
    toast('标签生成失败: ' + e.message, 'err');
    btn.disabled = false;
    btn.textContent = '✨ 生成标签体系';
  }
}

// 预加载场景列表
let allScenes = [];
async function loadScenes() {
  try {
    const res = await fetch(API() + '/api/scenes');
    if (res.ok) {
      const data = await res.json();
      allScenes = data.scenes;
    }
  } catch (e) { console.error('加载场景列表失败', e); }
}
