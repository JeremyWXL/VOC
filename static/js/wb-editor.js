// ====== 标签编辑器弹层 ======
async function openTagEditor() {
  const modal = $('#tagEditorModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // ESC 关闭
  const escHandler = (e) => { if (e.key === 'Escape') { closeTagEditor(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  // 准备要发送给标签编辑器的 CSV 内容
  const iframe = $('#tagEditorFrame');
  let csvContent = null;
  if (generatedTagCsv) {
    csvContent = generatedTagCsv;
  } else if (tagFile && tagFile.csvContent) {
    csvContent = tagFile.csvContent;
  } else if (tagFile) {
    try {
      const resp = await fetch(API() + '/api/download-file?file_id=' + encodeURIComponent(tagFile.file_id));
      if (resp.ok) csvContent = await resp.text();
    } catch(e) { console.error('获取标签文件内容失败', e); }
  }

  // 强制重新加载 iframe，确保每次打开都是全新状态
  // 有 CSV 数据 → 加载完成后通过 postMessage 发送
  // 无 CSV 数据 → 编辑器从0开始空白画布
  if (csvContent) {
    iframe.onload = () => {
      iframe.contentWindow.postMessage({ type: 'load-csv', csv: csvContent }, '*');
    };
  } else {
    iframe.onload = null;
  }
  iframe.src = 'app_tag_config.html?v=2&t=' + Date.now();
}
function closeTagEditor() {
  const modal = $('#tagEditorModal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// 接收编辑器返回的 CSV
let editorReturnedCsv = null;
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'save-csv') {
    editorReturnedCsv = e.data.csv;
    closeTagEditor();
    // 自动应用到当前任务，不再弹窗打断流程
    applyEditorCsvToTask();
  }
});

function showEditorReturnModal() {
  $('#editorReturnModal').style.display = 'flex';
}
function closeEditorReturnModal() {
  $('#editorReturnModal').style.display = 'none';
  editorReturnedCsv = null;
}

// 核心：将编辑器返回的 CSV 自动应用为当前标签文件
async function applyEditorCsvToTask() {
  if (!editorReturnedCsv) return;
  try {
    const blob = new Blob(['\uFEFF' + editorReturnedCsv], { type: 'text/csv' });
    const file = new File([blob], 'edited_tags.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(API() + '/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('上传失败');
    const data = await res.json();
    tagFile = data;
    tagFile.csvContent = editorReturnedCsv;
    $('#tagDropzone').style.display = 'none';
    const info = $('#tagFileInfo');
    info.style.display = 'block';
    info.innerHTML = `<div class="file-info"><span>📎 ${data.filename}</span><span style="color:#888">(${data.row_count} 行)</span><span class="remove" title="移除">&times;</span></div>`;
    info.querySelector('.remove').onclick = () => {
      tagFile = null;
      info.style.display = 'none';
      $('#tagDropzone').style.display = 'block';
    };
    clearSelectedTagSystem();
    // 自动应用成功，toast 提示并附带"保存到标签库"快捷操作
    toast('已自动应用编辑后的标签体系 ✅', 'ok');
  } catch (err) {
    toast('应用编辑器标签失败: ' + err.message, 'err');
  }
}

// 兼容旧入口：用户手动点击"用于当前任务"时
function useEditorCsvForTask() {
  applyEditorCsvToTask();
}

async function saveEditorCsvToLibrary() {
  if (!editorReturnedCsv) return;
  const name = prompt('请输入标签体系名称:', '自定义标签体系');
  if (!name) return;
  try {
    const res = await fetch(API() + '/api/tag-systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, csv_content: editorReturnedCsv }),
    });
    if (!res.ok) throw new Error('保存失败');
    const data = await res.json();
    selectTagSystem(data);
    closeEditorReturnModal();
    toast('已保存到标签库', 'ok');
  } catch (e) {
    toast(e.message, 'err');
  }
}
