(function () {
  'use strict';

  const DATA_DIR = './data/';
  const STORAGE_KEY = 'morning-briefing-checks';
  const THEME_KEY = 'morning-briefing-theme';

  // ── Icons (inline SVG paths) ──
  const ICONS = {
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    megaphone: '<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>'
  };

  function icon(name, cls) {
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  // ── State ──
  let checks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  let currentData = null;
  let dataIndex = null;

  function saveChecks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
  }

  // ── Theme ──
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
    localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark');
  }

  // ── Data Loading ──
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function loadJSON(date) {
    try {
      const resp = await fetch(`${DATA_DIR}${date}.json`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  }

  async function loadDataIndex() {
    try {
      const resp = await fetch(`${DATA_DIR}index.json`);
      if (!resp.ok) return [];
      return await resp.json();
    } catch { return []; }
  }

  // ── Rendering ──
  function renderStats(data) {
    const el = document.getElementById('hero-stats');
    if (!data || !data.sections) { el.innerHTML = ''; return; }

    let total = 0, done = 0, high = 0;
    for (const s of data.sections) {
      for (const item of s.items) {
        total++;
        if (checks[item.id]) done++;
        if (item.priority === 'high') high++;
      }
    }
    const pending = total - done;
    el.innerHTML = `
      <span class="stat stat--total">${total} items</span>
      <span class="stat stat--done">${done} done</span>
      ${high ? `<span class="stat stat--high">${high} high priority</span>` : ''}
      ${pending ? `<span class="stat stat--pending">${pending} remaining</span>` : ''}
    `;
  }

  function renderBriefing(data, container) {
    if (!data || !data.sections) {
      container.innerHTML = '<p class="muted">No briefing data available for this date.</p>';
      return;
    }

    container.innerHTML = '';
    for (const section of data.sections) {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'section';
      sectionEl.setAttribute('data-section', section.id);

      const count = section.items.length;
      const doneCount = section.items.filter(i => checks[i.id]).length;

      sectionEl.innerHTML = `
        <div class="section-header" data-toggle="${section.id}">
          ${icon(section.icon || 'info', 'section-icon')}
          <span class="section-title">${section.title}</span>
          <span class="section-count">${doneCount}/${count}</span>
          ${icon('chevron', 'section-collapse')}
        </div>
        <div class="section-body" id="body-${section.id}">
          ${count === 0 ? '<div class="section-empty">Nothing here today</div>' : ''}
          ${section.items.map(item => renderItem(item)).join('')}
        </div>
      `;
      container.appendChild(sectionEl);
    }

    container.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const id = header.getAttribute('data-toggle');
        const body = document.getElementById('body-' + id);
        const chevron = header.querySelector('.section-collapse');
        body.classList.toggle('collapsed');
        chevron.classList.toggle('collapsed');
      });
    });

    container.querySelectorAll('.item-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const item = e.target.closest('.item');
        if (e.target.checked) {
          checks[id] = true;
          item.classList.add('checked');
        } else {
          delete checks[id];
          item.classList.remove('checked');
        }
        saveChecks();
        if (currentData) renderStats(currentData);
        updateSectionCount(e.target.closest('.section'));
      });
    });

    container.querySelectorAll('.prep-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const prepId = btn.getAttribute('data-prep-id');
        const content = document.getElementById('prep-' + prepId);
        if (content.style.display === 'none') {
          content.style.display = '';
          btn.textContent = 'Hide prep briefing';
        } else {
          content.style.display = 'none';
          btn.textContent = 'Show prep briefing';
        }
      });
    });
  }

  function renderItem(item) {
    const isChecked = checks[item.id] ? 'checked' : '';
    const checkedClass = checks[item.id] ? ' checked' : '';
    const priorityBadge = item.priority === 'high'
      ? '<span class="item-badge item-badge--high">high</span>'
      : item.priority === 'low'
        ? '<span class="item-badge item-badge--low">low</span>'
        : '';
    const typeBadge = item.type && item.type !== 'status'
      ? `<span class="item-badge item-badge--${item.type}">${item.type}</span>`
      : '';
    const sourceLink = item.source_url
      ? `<a href="${item.source_url}" target="_blank" rel="noopener" class="item-source">${item.source_label || 'Source'}</a>`
      : (item.source_label ? `<span class="item-source">${item.source_label}</span>` : '');

    const prepBlock = item.prep
      ? `<div class="item-prep">
          <button type="button" class="prep-toggle" data-prep-id="${item.id}">Show prep briefing</button>
          <div class="prep-content" id="prep-${item.id}" style="display:none">${item.prep}</div>
        </div>`
      : '';

    return `
      <div class="item${checkedClass}">
        <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${isChecked}>
        <div class="item-content">
          <div class="item-summary">${item.summary}</div>
          <div class="item-meta">
            ${sourceLink}
            ${priorityBadge}
            ${typeBadge}
          </div>
          ${prepBlock}
        </div>
      </div>
    `;
  }

  function updateSectionCount(sectionEl) {
    if (!sectionEl) return;
    const items = sectionEl.querySelectorAll('.item-checkbox');
    const done = Array.from(items).filter(cb => cb.checked).length;
    const countEl = sectionEl.querySelector('.section-count');
    if (countEl) countEl.textContent = `${done}/${items.length}`;
  }

  // ── Navigation ──
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + viewId).style.display = '';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-view="${viewId}"]`).classList.add('active');
  }

  // ── History ──
  async function loadHistory(date) {
    const data = await loadJSON(date);
    const container = document.getElementById('history-content');
    if (data) {
      renderBriefing(data, container);
    } else {
      container.innerHTML = `<p class="muted">No briefing found for ${date}.</p>`;
    }
  }

  async function populateHistoryList() {
    const index = await loadDataIndex();
    dataIndex = index;
    const container = document.getElementById('history-available');
    if (!index || index.length === 0) {
      container.innerHTML = '<p class="muted">No historical briefings found. Run the backfill to populate.</p>';
      return;
    }
    container.innerHTML = index.slice().reverse().map(d =>
      `<div class="history-day" data-date="${d}">${formatDate(d)}</div>`
    ).join('');
    container.querySelectorAll('.history-day').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('history-date').value = el.getAttribute('data-date');
        loadHistory(el.getAttribute('data-date'));
      });
    });
  }

  // ── Export ──
  async function generateExport() {
    const start = document.getElementById('export-start').value;
    const end = document.getElementById('export-end').value;
    const filter = document.getElementById('export-filter').value;

    if (!start || !end) return;

    const index = dataIndex || await loadDataIndex();
    const dates = index.filter(d => d >= start && d <= end);

    let output = `# Impact Review Export\n# ${formatDate(start)} to ${formatDate(end)}\n`;
    if (filter !== 'all') output += `# Filtered: ${filter}\n`;
    output += `# Generated: ${new Date().toISOString()}\n\n`;

    for (const date of dates) {
      const data = await loadJSON(date);
      if (!data) continue;

      output += `## ${formatDate(date)}\n\n`;
      for (const section of data.sections) {
        if (filter !== 'all' && section.id !== filter) continue;
        if (section.items.length === 0) continue;

        output += `### ${section.title}\n`;
        for (const item of section.items) {
          const check = checks[item.id] ? '[x]' : '[ ]';
          const source = item.source_url ? ` (${item.source_url})` : '';
          output += `- ${check} ${item.summary}${source}\n`;
        }
        output += '\n';
      }
    }

    document.getElementById('export-output').style.display = '';
    document.getElementById('export-text').textContent = output;
  }

  function copyExport() {
    const text = document.getElementById('export-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('export-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
    });
  }

  // ── Helpers ──
  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── Init ──
  async function init() {
    initTheme();

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(link.getAttribute('data-view'));
      });
    });
    document.getElementById('nav-brand').addEventListener('click', (e) => {
      e.preventDefault();
      showView('today');
    });

    // History
    document.getElementById('history-load').addEventListener('click', () => {
      const date = document.getElementById('history-date').value;
      if (date) loadHistory(date);
    });

    // Export
    document.getElementById('export-end').value = todayStr();
    document.getElementById('export-generate').addEventListener('click', generateExport);
    document.getElementById('export-copy').addEventListener('click', copyExport);

    // Load today's briefing
    const today = todayStr();
    document.getElementById('hero-date').textContent = formatDate(today);

    const data = await loadJSON(today);
    const loading = document.getElementById('loading');

    if (data) {
      currentData = data;
      document.getElementById('hero-generated').textContent =
        `Generated ${new Date(data.generated_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`;
      renderStats(data);
      renderBriefing(data, document.getElementById('briefing-content'));
    } else {
      // Try sample data for demo
      const sample = await loadJSON('sample');
      if (sample) {
        currentData = sample;
        document.getElementById('hero-generated').textContent = 'Sample data (run skill to generate today\'s briefing)';
        renderStats(sample);
        renderBriefing(sample, document.getElementById('briefing-content'));
      } else {
        loading.innerHTML = '<p class="muted">No briefing for today yet. Open Cursor and say <strong>"run my morning briefing"</strong> to generate.</p>';
      }
    }

    // Populate history
    populateHistoryList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
