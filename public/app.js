(() => {
  const state = {
    icons: [],
    requiresKey: false,
    selectedFile: null,
    previewUrl: null,
  };

  const el = {
    grid: document.getElementById('grid'),
    empty: document.getElementById('emptyState'),
    search: document.getElementById('search'),
    searchCount: document.getElementById('searchCount'),
    searchClear: document.getElementById('searchClear'),
    openUpload: document.getElementById('openUpload'),
    emptyUploadBtn: document.getElementById('emptyUploadBtn'),
    overlay: document.getElementById('modalOverlay'),
    closeModal: document.getElementById('closeModal'),
    dropzone: document.getElementById('dropzone'),
    dzEmpty: document.getElementById('dropzoneEmpty'),
    dzPreview: document.getElementById('dropzonePreview'),
    fileInput: document.getElementById('fileInput'),
    nameInput: document.getElementById('nameInput'),
    tagsInput: document.getElementById('tagsInput'),
    keyField: document.getElementById('keyField'),
    keyInput: document.getElementById('keyInput'),
    uploadError: document.getElementById('uploadError'),
    submitUpload: document.getElementById('submitUpload'),
    toast: document.getElementById('toast'),
  };

  const getKey = () => localStorage.getItem('iconstore_admin_key') || '';
  const setKey = (k) => localStorage.setItem('iconstore_admin_key', k || '');

  function showToast(msg, duration = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.add('hidden'), duration);
  }

  // Clicking the toast selects its full text, so a manual Ctrl/Cmd+C (or
  // long-press "Copy" on mobile) always works as a last resort.
  el.toast.addEventListener('click', () => {
    const range = document.createRange();
    range.selectNodeContents(el.toast);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  function fullUrl(filename) {
    return `${window.location.origin}/icons/${filename}`;
  }

  // navigator.clipboard only exists in "secure contexts" (HTTPS or
  // localhost) — on a plain http://<lan-ip> address it's undefined, so we
  // fall back to a hidden-textarea + execCommand('copy') approach, and if
  // even that fails, the caller can show the link itself as a last resort.
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function splitFilename(filename) {
    const dot = filename.lastIndexOf('.');
    const base = dot === -1 ? filename : filename.slice(0, dot);
    const ext = dot === -1 ? '' : filename.slice(dot);
    const underscore = base.lastIndexOf('_');
    if (underscore === -1) return { lead: base, suffix: '', ext };
    return { lead: base.slice(0, underscore + 1), suffix: base.slice(underscore + 1), ext };
  }

  async function authedFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (state.requiresKey) headers['X-Admin-Key'] = getKey();
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      const k = window.prompt('Admin key required for this action:');
      if (k === null) throw new Error('cancelled');
      setKey(k);
      const retryHeaders = Object.assign({}, options.headers || {}, { 'X-Admin-Key': k });
      const retry = await fetch(url, Object.assign({}, options, { headers: retryHeaders }));
      if (!retry.ok) throw await errorFrom(retry);
      return retry;
    }
    if (!res.ok) throw await errorFrom(res);
    return res;
  }

  async function errorFrom(res) {
    try {
      const data = await res.json();
      return new Error(data.error || `Request failed (${res.status})`);
    } catch {
      return new Error(`Request failed (${res.status})`);
    }
  }

  async function loadIcons(query = '') {
    const res = await fetch(`/api/icons${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    const data = await res.json();
    state.icons = data.icons;
    state.requiresKey = data.requiresKey;
    render();
  }

  function render() {
    el.grid.innerHTML = '';
    const hasIcons = state.icons.length > 0;
    el.empty.classList.toggle('hidden', hasIcons || el.search.value.trim() !== '');
    el.searchCount.textContent = el.search.value.trim()
      ? `${state.icons.length} match${state.icons.length === 1 ? '' : 'es'}`
      : '';

    if (!hasIcons && el.search.value.trim()) {
      const p = document.createElement('p');
      p.style.color = 'var(--text-faint)';
      p.style.fontFamily = 'var(--font-mono)';
      p.style.fontSize = '13px';
      p.style.gridColumn = '1 / -1';
      p.style.padding = '40px 0';
      p.style.textAlign = 'center';
      p.textContent = `No icons match "${el.search.value.trim()}"`;
      el.grid.appendChild(p);
      return;
    }

    for (const icon of state.icons) {
      el.grid.appendChild(buildCard(icon));
    }
  }

  function buildCard(icon) {
    const card = document.createElement('div');
    card.className = 'card';

    const { lead, suffix, ext } = splitFilename(icon.filename);

    card.innerHTML = `
      <div class="card-art">
        <img src="/icons/${escapeHtml(icon.filename)}" alt="${escapeHtml(icon.name)}" loading="lazy" />
        <div class="card-actions">
          <button class="mini-btn" data-action="copy" title="Copy link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="mini-btn" data-action="edit" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="mini-btn danger" data-action="delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      <div class="card-info">
        <p class="card-name">${escapeHtml(icon.name)}</p>
        <p class="card-file">${escapeHtml(lead)}<span class="suffix">${escapeHtml(suffix)}</span>${escapeHtml(ext)}</p>
        ${icon.tags && icon.tags.length ? `<div class="card-tags">${icon.tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    `;

    const copyBtn = card.querySelector('[data-action="copy"]');
    const copyIconHTML = copyBtn.innerHTML;
    const checkIconHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    let copyResetTimer = null;

    copyBtn.addEventListener('click', () => {
      const url = fullUrl(icon.filename);
      copyToClipboard(url)
        .then(() => {
          showToast(`Copied: ${url}`, 4500);
          clearTimeout(copyResetTimer);
          copyBtn.innerHTML = checkIconHTML;
          copyBtn.classList.add('copied');
          copyResetTimer = setTimeout(() => {
            copyBtn.innerHTML = copyIconHTML;
            copyBtn.classList.remove('copied');
          }, 1600);
        })
        .catch(() => showToast(`Couldn't auto-copy — select to copy: ${url}`, 7000));
    });

    card.querySelector('[data-action="edit"]').addEventListener('click', async () => {
      const newName = window.prompt('Name:', icon.name);
      if (newName === null) return;
      const newTags = window.prompt('Tags (comma separated):', (icon.tags || []).join(', '));
      if (newTags === null) return;
      try {
        await authedFetch(`/api/icons/${icon.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, tags: newTags }),
        });
        showToast('Updated');
        loadIcons(el.search.value.trim());
      } catch (e) {
        if (e.message !== 'cancelled') showToast(e.message);
      }
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!window.confirm(`Delete "${icon.name}"? This cannot be undone.`)) return;
      try {
        await authedFetch(`/api/icons/${icon.id}`, { method: 'DELETE' });
        showToast('Deleted');
        loadIcons(el.search.value.trim());
      } catch (e) {
        if (e.message !== 'cancelled') showToast(e.message);
      }
    });

    return card;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Search ----
  let searchTimer;
  el.search.addEventListener('input', () => {
    el.searchClear.classList.toggle('visible', el.search.value.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadIcons(el.search.value.trim()), 200);
  });

  el.searchClear.addEventListener('click', () => {
    el.search.value = '';
    el.searchClear.classList.remove('visible');
    el.search.focus();
    loadIcons('');
  });

  // ---- Modal ----
  function openModal() {
    el.overlay.classList.remove('hidden');
    el.keyField.classList.toggle('hidden', !state.requiresKey);
    if (state.requiresKey) el.keyInput.value = getKey();
    resetForm();
  }
  function closeModal() {
    el.overlay.classList.add('hidden');
  }
  function resetForm() {
    state.selectedFile = null;
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
    el.fileInput.value = '';
    el.nameInput.value = '';
    el.tagsInput.value = '';
    el.dzPreview.src = '';
    el.dzPreview.classList.add('hidden');
    el.dzEmpty.classList.remove('hidden');
    el.uploadError.classList.add('hidden');
    el.submitUpload.disabled = true;
  }

  el.openUpload.addEventListener('click', openModal);
  el.emptyUploadBtn.addEventListener('click', openModal);
  el.closeModal.addEventListener('click', closeModal);
  el.overlay.addEventListener('click', (e) => {
    if (e.target === el.overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.overlay.classList.contains('hidden')) closeModal();
  });

  // ---- Dropzone ----
  el.dropzone.addEventListener('click', (e) => {
    e.preventDefault();
    el.fileInput.click();
  });
  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files[0]) handleFile(el.fileInput.files[0]);
  });
  ['dragover', 'dragenter'].forEach((evt) =>
    el.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      el.dropzone.classList.add('drag-over');
    })
  );
  ['dragleave', 'dragend'].forEach((evt) =>
    el.dropzone.addEventListener(evt, () => el.dropzone.classList.remove('drag-over'))
  );
  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    state.selectedFile = file;
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(file);
    el.dzEmpty.classList.add('hidden');
    el.dzPreview.classList.remove('hidden');
    el.dzPreview.src = state.previewUrl;
    if (!el.nameInput.value) {
      el.nameInput.value = file.name.replace(/\.[^.]+$/, '');
    }
    el.submitUpload.disabled = false;
  }

  el.submitUpload.addEventListener('click', async () => {
    if (!state.selectedFile) return;
    el.uploadError.classList.add('hidden');
    el.submitUpload.disabled = true;
    el.submitUpload.textContent = 'Uploading…';

    if (state.requiresKey) setKey(el.keyInput.value);

    const formData = new FormData();
    formData.append('file', state.selectedFile);
    formData.append('name', el.nameInput.value.trim());
    formData.append('tags', el.tagsInput.value.trim());

    try {
      const headers = {};
      if (state.requiresKey) headers['X-Admin-Key'] = getKey();
      const res = await fetch('/api/icons', { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      closeModal();
      const url = fullUrl(data.filename);
      copyToClipboard(url)
        .then(() => showToast(`Copied: ${url}`, 4500))
        .catch(() => showToast(`Uploaded — select to copy: ${url}`, 7000));
      loadIcons(el.search.value.trim());
    } catch (e) {
      el.uploadError.textContent = e.message;
      el.uploadError.classList.remove('hidden');
    } finally {
      el.submitUpload.disabled = !state.selectedFile;
      el.submitUpload.textContent = 'Upload';
    }
  });

  el.searchClear.classList.toggle('visible', el.search.value.length > 0);
  loadIcons(el.search.value.trim());
})();
