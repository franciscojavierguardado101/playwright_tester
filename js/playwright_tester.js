(function (Drupal, once) {
  'use strict';

  Drupal.behaviors.playwrightTester = {
    attach(context) {
      once('playwright-tester', '.pgt-wrap', context).forEach(wrap => {
        initDropzone(wrap);
        initCatalog(wrap);
        initSave(wrap);
        initClear(wrap);
      });
    }
  };

  let currentFile = null;

  function initDropzone(wrap) {
    const zone  = wrap.querySelector('#pgt-dropzone');
    const input = wrap.querySelector('#pgt-file-input');

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('pgt-dropzone--over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('pgt-dropzone--over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('pgt-dropzone--over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(wrap, file);
    });
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(wrap, input.files[0]);
    });
  }

  function handleFile(wrap, file) {
    const reader = new FileReader();
    reader.onload = e => {
      currentFile = { name: file.name, content: e.target.result };
      showFileBar(wrap, file.name);
      parseAndRender(wrap, file.name, e.target.result);
      wrap.querySelector('#pgt-save-wrap').style.display = '';
      wrap.querySelector('#pgt-save-msg').textContent = '';
    };
    reader.readAsText(file);
  }

  function showFileBar(wrap, name) {
    wrap.querySelector('#pgt-file-name').textContent = '📄 ' + name;
    wrap.querySelector('#pgt-file-bar').style.display = '';
    wrap.querySelector('#pgt-dropzone').style.display = 'none';
  }

  function initClear(wrap) {
    wrap.querySelector('#pgt-clear').addEventListener('click', () => {
      currentFile = null;
      wrap.querySelector('#pgt-file-bar').style.display = 'none';
      wrap.querySelector('#pgt-dropzone').style.display = '';
      wrap.querySelector('#pgt-terminal').style.display = 'none';
      wrap.querySelector('#pgt-save-wrap').style.display = 'none';
      wrap.querySelector('#pgt-file-input').value = '';
    });
  }

  function parseAndRender(wrap, filename, content) {
    const lines   = content.split('\n');
    const results = [];
    let   suite   = filename;
    let   count   = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      const descMatch = trimmed.match(/test\.describe\s*\(\s*['"`](.+?)['"`]/);
      if (descMatch) { suite = descMatch[1]; return; }
      const testMatch = trimmed.match(/^\s*test\s*\(\s*['"`](.+?)['"`]/);
      if (testMatch) { count++; results.push({ suite, name: testMatch[1], num: count }); }
    });

    renderTerminal(wrap, filename, suite, results);
  }

  function renderTerminal(wrap, filename, suite, results) {
    const terminal = wrap.querySelector('#pgt-terminal');
    const body     = wrap.querySelector('#pgt-terminal-body');
    const footer   = wrap.querySelector('#pgt-terminal-footer');
    const title    = wrap.querySelector('#pgt-terminal-title');

    title.textContent = filename;
    body.innerHTML = '';

    const suiteEl = document.createElement('div');
    suiteEl.className = 'pgt-line--suite';
    suiteEl.textContent = '  ' + suite;
    body.appendChild(suiteEl);

    results.forEach(r => {
      const line = document.createElement('div');
      line.innerHTML =
        `<span class="pgt-line--check">  ✓</span>` +
        `<span class="pgt-line--num">${r.num}</span>` +
        `<span class="pgt-line--pass">${r.name}</span>`;
      body.appendChild(line);
    });

    footer.textContent = `  ${results.length} tests found in ${suite}`;
    terminal.style.display = '';
  }

  function initSave(wrap) {
    wrap.querySelector('#pgt-save').addEventListener('click', async () => {
      if (!currentFile) return;

      const msgEl = wrap.querySelector('#pgt-save-msg');

      const res = await fetch('/playwright-tester/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ filename: currentFile.name, content: currentFile.content }),
      });

      const data = await res.json();

      if (data.error === 'duplicate') {
        msgEl.textContent = '⚠️ This file is already in the catalog.';
        msgEl.style.color = '#e67e22';
        return;
      }

      if (data.success) {
        msgEl.textContent = '✅ Saved to catalog!';
        msgEl.style.color = '#2d9c5f';
        addToCatalog(wrap, data.id, currentFile.name, currentFile.content);
      }
    });
  }

  function addToCatalog(wrap, id, filename, content) {
    const catalog = wrap.querySelector('#pgt-catalog');
    const empty   = catalog.querySelector('.pgt-catalog__empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'pgt-catalog__item';
    item.dataset.id = id;
    item.innerHTML = `
      <div class="pgt-catalog__item-icon">📄</div>
      <div class="pgt-catalog__item-info">
        <div class="pgt-catalog__item-name">${filename}</div>
        <div class="pgt-catalog__item-date">Just now</div>
      </div>
      <div class="pgt-catalog__item-actions">
        <button class="pgt-btn pgt-btn--view" data-id="${id}">View</button>
        <button class="pgt-btn pgt-btn--download" data-id="${id}" data-filename="${filename}">⬇ Download</button>
      </div>
    `;
    item.querySelector('.pgt-btn--view').addEventListener('click', () => loadFromCatalog(wrap, id));
    item.querySelector('.pgt-btn--download').addEventListener('click', () => downloadFile(filename, content));
    catalog.prepend(item);
  }

  function initCatalog(wrap) {
    wrap.querySelectorAll('.pgt-btn--view').forEach(btn => {
      btn.addEventListener('click', () => loadFromCatalog(wrap, btn.dataset.id));
    });
    wrap.querySelectorAll('.pgt-btn--download').forEach(btn => {
      btn.addEventListener('click', () => downloadFromCatalog(btn.dataset.id, btn.dataset.filename));
    });
  }

  async function loadFromCatalog(wrap, id) {
    const res  = await fetch(`/playwright-tester/get/${id}`);
    const data = await res.json();
    if (data.error) return;

    currentFile = { name: data.filename, content: data.content };
    showFileBar(wrap, data.filename);
    parseAndRender(wrap, data.filename, data.content);
    wrap.querySelector('#pgt-save-wrap').style.display = 'none';
    wrap.querySelector('#pgt-dropzone').style.display = 'none';
    wrap.querySelector('#pgt-file-bar').style.display = '';
  }

  async function downloadFromCatalog(id, filename) {
    const res  = await fetch(`/playwright-tester/get/${id}`);
    const data = await res.json();
    if (data.error) return;
    downloadFile(data.filename, data.content);
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/javascript' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

})(Drupal, once);
