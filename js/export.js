// ============================================================
// GRAINWATCH — Export Page Controller
// ============================================================

const ExportPage = {
  // State
  selectedCommodities: [],  // array of commodity objects
  range: { startMonth: null, startYear: null, endMonth: null, endYear: null },
  fetchedData: [],          // array of { commodity, history[] }
  _lastMarkdown: "",

  // --------------------------------------------------------
  // INITIALIZATION (called once from App)
  // --------------------------------------------------------
  init() {
    this._populateDropdown();
    this._bindEvents();
  },

  // --------------------------------------------------------
  // POPULATE COMMODITY DROPDOWN
  // --------------------------------------------------------
  _populateDropdown() {
    const select = document.getElementById('exportCommoditySelect');
    if (!select) return;

    const placeholderText = I18N.t('export_select_placeholder');
    select.innerHTML = `<option value="">${placeholderText}</option>`;

    // Group by category
    const categories = {
      cereals:     I18N.lang === 'en' ? 'Cereals' : 'Céréales',
      oilseeds:    I18N.lang === 'en' ? 'Oilseeds' : 'Oléagineux',
      softs:       I18N.lang === 'en' ? 'Softs' : 'Denrées tropicales',
      fibers:      I18N.lang === 'en' ? 'Fibers' : 'Fibres',
      industrials: I18N.lang === 'en' ? 'Industrial' : 'Industriels',
    };

    const grouped = {};
    ALL_COMMODITIES.forEach(c => {
      const cat = c.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      const group = document.createElement('optgroup');
      group.label = categories[cat] || cat;
      items.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon} ${I18N.commodityName(c)} (${c.code})`;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  },

  // --------------------------------------------------------
  // EVENT BINDINGS
  // --------------------------------------------------------
  _bindEvents() {
    const select = document.getElementById('exportCommoditySelect');
    const addBtn = document.getElementById('exportAddBtn');

    // Show "Add" button only when a commodity is selected
    if (select) {
      select.addEventListener('change', () => {
        addBtn.style.display = select.value ? 'inline-flex' : 'none';
      });
    }

    // Add commodity chip
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (select.value) {
          this._addCommodity(select.value);
          select.value = '';
          addBtn.style.display = 'none';
        }
      });
    }

    // Back button
    const backBtn = document.getElementById('exportBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.close());
    }

    // Fetch button
    const fetchBtn = document.getElementById('exportFetchBtn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => this._fetchData());
    }

    // Export buttons
    const csvBtn = document.getElementById('exportCsvBtn');
    if (csvBtn) csvBtn.addEventListener('click', () => this._exportCSV());

    const mdBtn = document.getElementById('exportMdBtn');
    if (mdBtn) mdBtn.addEventListener('click', () => this._exportMarkdown());

    const jsonBtn = document.getElementById('exportJsonBtn');
    if (jsonBtn) jsonBtn.addEventListener('click', () => this._exportJSON());

    // Copy button
    const copyBtn = document.getElementById('exportCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => this._copyToClipboard());
  },

  // --------------------------------------------------------
  // OPEN / CLOSE
  // --------------------------------------------------------
  open() {
    // Block export in simulation mode
    if (App.state.source === 'simulated') return;

    // Refresh dropdown in case language changed
    this._populateDropdown();

    // Pre-fill with current commodity if list is empty
    if (this.selectedCommodities.length === 0 && App.state.selectedCommodity) {
      const c = ALL_COMMODITIES.find(x => x.id === App.state.selectedCommodity);
      if (c) {
        this.selectedCommodities.push(c);
        this._renderChips();
      }
    }

    // Pre-fill dates: default to last 12 months
    const now = new Date();
    const msEl = document.getElementById('exportMonthStart');
    const ysEl = document.getElementById('exportYearStart');
    const meEl = document.getElementById('exportMonthEnd');
    const yeEl = document.getElementById('exportYearEnd');

    if (msEl && !msEl.value) msEl.value = now.getMonth() + 1;
    if (ysEl && !ysEl.value) ysEl.value = now.getFullYear() - 1;
    if (meEl && !meEl.value) meEl.value = now.getMonth() + 1;
    if (yeEl && !yeEl.value) yeEl.value = now.getFullYear();

    // Hide dashboard, show export page
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.detail-panel').style.display = 'none';
    document.getElementById('exportPage').style.display = 'block';

    // Reset fetch state
    this._resetFetchState();
  },

  close() {
    document.getElementById('exportPage').style.display = 'none';
    document.querySelector('.sidebar').style.display = '';
    document.querySelector('.detail-panel').style.display = '';
  },

  // --------------------------------------------------------
  // COMMODITY CHIPS
  // --------------------------------------------------------
  _addCommodity(id) {
    // Avoid duplicates
    if (this.selectedCommodities.find(c => c.id === id)) return;

    const commodity = ALL_COMMODITIES.find(c => c.id === id);
    if (!commodity) return;

    this.selectedCommodities.push(commodity);
    this._renderChips();
    this._resetFetchState();
  },

  _removeCommodity(id) {
    this.selectedCommodities = this.selectedCommodities.filter(c => c.id !== id);
    this._renderChips();
    this._resetFetchState();
  },

  _renderChips() {
    const container = document.getElementById('exportCommodityList');
    const emptyHint = document.getElementById('exportEmptyHint');
    if (!container) return;

    if (this.selectedCommodities.length === 0) {
      emptyHint.style.display = 'block';
      // Remove all chips
      container.querySelectorAll('.export-chip').forEach(el => el.remove());
      return;
    }

    emptyHint.style.display = 'none';

    // Build chip HTML
    const chipsHtml = this.selectedCommodities.map(c => {
      const displayName = I18N.commodityName(c);
      return `<span class="export-chip" data-id="${c.id}">
        ${c.icon} ${displayName}
        <button class="export-chip-remove" data-id="${c.id}" title="×">×</button>
      </span>`;
    }).join('');

    // Keep hint element, replace chips
    container.querySelectorAll('.export-chip').forEach(el => el.remove());
    container.insertAdjacentHTML('beforeend', chipsHtml);

    // Bind remove buttons
    container.querySelectorAll('.export-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = btn.closest('.export-chip');
        chip.classList.add('removing');
        setTimeout(() => {
          this._removeCommodity(btn.dataset.id);
        }, 250);
      });
    });
  },

  // --------------------------------------------------------
  // DATE VALIDATION (same rules as App._applyCustomRange)
  // --------------------------------------------------------
  _validateDates() {
    const mStart = parseInt(document.getElementById('exportMonthStart').value);
    const yStart = parseInt(document.getElementById('exportYearStart').value);
    const mEnd   = parseInt(document.getElementById('exportMonthEnd').value);
    const yEnd   = parseInt(document.getElementById('exportYearEnd').value);
    const errEl  = document.getElementById('exportRangeError');

    const showError = (msg) => {
      errEl.textContent = msg;
      errEl.style.display = 'block';
      errEl.classList.add('shake');
      setTimeout(() => errEl.classList.remove('shake'), 500);
      return false;
    };
    const hideError = () => { errEl.style.display = 'none'; };
    hideError();

    // 1. All fields filled
    if (!mStart || !yStart || !mEnd || !yEnd) {
      return showError(I18N.t('export_fetch_need_dates'));
    }

    // 2. Month in range
    if (mStart < 1 || mStart > 12 || mEnd < 1 || mEnd > 12) {
      return showError(I18N.t('range_error_month'));
    }

    // 3. 19th century
    if (yStart < 1900 || yEnd < 1900) {
      return showError(I18N.t('range_error_19th'));
    }

    // 4. Before 1960
    if (yStart < 1960 || yEnd < 1960) {
      return showError(I18N.t('range_error_too_old'));
    }

    // 5. Future
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    if (yEnd > currentYear || (yEnd === currentYear && mEnd > currentMonth)) {
      return showError(I18N.t('range_error_future'));
    }

    // 6. Order
    if (yStart > yEnd || (yStart === yEnd && mStart > mEnd)) {
      return showError(I18N.t('range_error_order'));
    }

    this.range = { startMonth: mStart, startYear: yStart, endMonth: mEnd, endYear: yEnd };
    return true;
  },

  // --------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------
  async _fetchData() {
    // Validate inputs
    if (this.selectedCommodities.length === 0) {
      this._showFetchStatus(I18N.t('export_fetch_need_commodity'), 'error');
      return;
    }

    if (!this._validateDates()) return;

    const fetchBtn = document.getElementById('exportFetchBtn');
    const statusEl = document.getElementById('exportFetchStatus');
    const source = App.state.source;

    // Loading state
    fetchBtn.classList.add('loading');
    fetchBtn.disabled = true;
    fetchBtn.textContent = I18N.t('export_fetching');
    statusEl.style.display = 'none';

    this.fetchedData = [];

    try {
      for (const commodity of this.selectedCommodities) {
        const history = await GrainWatchAPI.getPriceHistoryCustomRange(
          commodity.id, this.range, source
        );
        if (history && history.length > 0) {
          this.fetchedData.push({ commodity, history });
        }
      }

      if (this.fetchedData.length === 0) {
        this._showFetchStatus(I18N.t('export_fetch_empty'), 'error');
      } else {
        const totalPoints = this.fetchedData.reduce((sum, d) => sum + d.history.length, 0);
        this._showFetchStatus(`✅ ${totalPoints} ${I18N.t('export_fetch_ok')}`, 'success');

        // Show export actions (copy button appears only after Markdown)
        document.getElementById('exportActions').style.display = 'flex';

        // Render preview table
        this._renderPreview();
      }
    } catch (error) {
      console.error('Export fetch error:', error);
      this._showFetchStatus(I18N.t('export_fetch_error'), 'error');
    } finally {
      fetchBtn.classList.remove('loading');
      fetchBtn.disabled = false;
      fetchBtn.textContent = I18N.t('export_fetch');
    }
  },

  _showFetchStatus(msg, type) {
    const el = document.getElementById('exportFetchStatus');
    el.textContent = msg;
    el.className = 'export-fetch-status ' + (type || '');
    el.style.display = 'block';
  },

  _resetFetchState() {
    this.fetchedData = [];
    this._lastMarkdown = '';
    const actions = document.getElementById('exportActions');
    const copyRow = document.getElementById('exportCopyRow');
    const preview = document.getElementById('exportPreview');
    const status = document.getElementById('exportFetchStatus');
    if (actions) actions.style.display = 'none';
    if (copyRow) copyRow.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (status) status.style.display = 'none';
  },

  // --------------------------------------------------------
  // PREVIEW TABLE
  // --------------------------------------------------------
  _renderPreview() {
    const preview = document.getElementById('exportPreview');
    const thead = document.getElementById('exportTableHead');
    const tbody = document.getElementById('exportTableBody');
    const countEl = document.getElementById('exportPreviewCount');
    if (!preview) return;

    const source = App.state.source;
    const sourceInfo = GrainWatchAPI.getSourceInfo(source);
    const currency = App.state.currency;
    const symbol = CURRENCY_SYMBOLS[currency];
    const rate = EXCHANGE_RATES[currency];

    // Build flat rows from all fetched data
    const rows = [];
    this.fetchedData.forEach(({ commodity, history }) => {
      const displayName = I18N.commodityName(commodity);
      history.forEach(h => {
        rows.push({
          date: h.date,
          price: Math.round(h.price * rate * 100) / 100,
          commodity: displayName,
        });
      });
    });

    // Sort by date
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Count + source label
    countEl.textContent = `(${rows.length} ${I18N.t('export_preview_rows')})`;

    // Source label above table
    const sourceLabel = I18N.lang === 'en' ? 'Source' : 'Source';
    const sourceLabelHtml = `<div class="export-preview-source">${sourceLabel} : <strong>${sourceInfo.name}</strong></div>`;

    // Header — 3 columns (no Source)
    thead.innerHTML = `<tr>
      <th>${I18N.t('csv_header_date')}</th>
      <th>${I18N.t('csv_header_commodity')}</th>
      <th>${I18N.t('csv_header_price')} (${symbol})</th>
    </tr>`;

    // Body (limit to 50 rows for readability)
    const maxRows = Math.min(rows.length, 50);
    let bodyHtml = '';
    for (let i = 0; i < maxRows; i++) {
      const r = rows[i];
      bodyHtml += `<tr>
        <td>${r.date}</td>
        <td>${r.commodity}</td>
        <td>${App.formatNumber(r.price)}</td>
      </tr>`;
    }
    tbody.innerHTML = bodyHtml;

    // Insert source label before table if not already present
    let existingLabel = preview.querySelector('.export-preview-source');
    if (existingLabel) existingLabel.remove();
    const wrapper = preview.querySelector('.export-table-wrapper');
    wrapper.insertAdjacentHTML('beforebegin', sourceLabelHtml);

    // Info notice below table
    let existingNotice = preview.querySelector('.export-preview-notice');
    if (existingNotice) existingNotice.remove();
    const noticeText = I18N.lang === 'en'
      ? `This preview shows the first ${maxRows} of ${rows.length} rows. The full dataset will be included in the export.`
      : `Cet aperçu affiche les ${maxRows} premières lignes sur ${rows.length}. L'export complet contiendra toutes les données.`;
    wrapper.insertAdjacentHTML('afterend', `<div class="export-preview-notice">ℹ️ ${noticeText}</div>`);

    preview.style.display = 'block';
  },

  // --------------------------------------------------------
  // CSV EXPORT
  // --------------------------------------------------------
  _exportCSV() {
    if (this.fetchedData.length === 0) return;

    const source = App.state.source;
    const sourceInfo = GrainWatchAPI.getSourceInfo(source);
    const currency = App.state.currency;
    const rate = EXCHANGE_RATES[currency];

    const hDate = I18N.t('csv_header_date');
    const hPrice = I18N.t('csv_header_price');
    const hCommodity = I18N.t('csv_header_commodity');
    const hSource = I18N.t('csv_header_source');

    const lines = [];
    lines.push(`${hDate},${hPrice} (${currency}),${hCommodity},${hSource}`);

    this.fetchedData.forEach(({ commodity, history }) => {
      const displayName = I18N.commodityName(commodity);
      history.forEach(h => {
        const price = Math.round(h.price * rate * 100) / 100;
        lines.push(`${h.date},${price},${displayName},${sourceInfo.name}`);
      });
    });

    const csv = lines.join('\n');
    this._downloadFile(csv, this._makeFilename('csv'), 'text/csv;charset=utf-8;', true);
  },

  // --------------------------------------------------------
  // MARKDOWN EXPORT
  // --------------------------------------------------------
  _exportMarkdown() {
    if (this.fetchedData.length === 0) return;

    const source = App.state.source;
    const sourceInfo = GrainWatchAPI.getSourceInfo(source);
    const currency = App.state.currency;
    const symbol = CURRENCY_SYMBOLS[currency];
    const rate = EXCHANGE_RATES[currency];

    const pad = (n) => String(n).padStart(2, '0');
    const rangeStr = `${pad(this.range.startMonth)}/${this.range.startYear} — ${pad(this.range.endMonth)}/${this.range.endYear}`;

    let md = `# GrainWatch — ${I18N.t('export_page_title')}\n\n`;
    md += `**${I18N.t('source_badge')}:** ${sourceInfo.name}  \n`;
    md += `**${I18N.lang === 'en' ? 'Period' : 'Période'}:** ${rangeStr}  \n`;
    md += `**${I18N.lang === 'en' ? 'Currency' : 'Devise'}:** ${currency}  \n\n`;

    const hDate = I18N.t('csv_header_date');
    const hPrice = I18N.t('csv_header_price');
    const hCommodity = I18N.t('csv_header_commodity');

    md += `| ${hDate} | ${hCommodity} | ${hPrice} (${symbol}) |\n`;
    md += `|------|-----------|-------|\n`;

    this.fetchedData.forEach(({ commodity, history }) => {
      const displayName = I18N.commodityName(commodity);
      history.forEach(h => {
        const price = Math.round(h.price * rate * 100) / 100;
        md += `| ${h.date} | ${displayName} | ${App.formatNumber(price)} |\n`;
      });
    });

    md += `\n---\n*${I18N.t('disclaimer').replace('⚠ ', '')}*\n`;

    this._lastMarkdown = md;
    this._downloadFile(md, this._makeFilename('md'), 'text/markdown;charset=utf-8;', false);

    // Show copy button after Markdown export
    document.getElementById('exportCopyRow').style.display = 'flex';
  },

  // --------------------------------------------------------
  // JSON EXPORT
  // --------------------------------------------------------
  _exportJSON() {
    if (this.fetchedData.length === 0) return;

    const source = App.state.source;
    const sourceInfo = GrainWatchAPI.getSourceInfo(source);
    const currency = App.state.currency;
    const rate = EXCHANGE_RATES[currency];

    const pad = (n) => String(n).padStart(2, '0');

    const output = {
      meta: {
        app: "GrainWatch",
        source: sourceInfo.name,
        currency: currency,
        period: {
          from: `${this.range.startYear}-${pad(this.range.startMonth)}`,
          to: `${this.range.endYear}-${pad(this.range.endMonth)}`,
        },
        exportedAt: new Date().toISOString(),
      },
      data: this.fetchedData.map(({ commodity, history }) => ({
        id: commodity.id,
        name: I18N.commodityName(commodity),
        code: commodity.code,
        unit: commodity.unitWB,
        points: history.map(h => ({
          date: h.date,
          price: Math.round(h.price * rate * 100) / 100,
        })),
      })),
    };

    const json = JSON.stringify(output, null, 2);
    this._downloadFile(json, this._makeFilename('json'), 'application/json;charset=utf-8;', false);
  },

  // --------------------------------------------------------
  // CLIPBOARD COPY (copies last Markdown)
  // --------------------------------------------------------
  async _copyToClipboard() {
    // If no markdown yet, generate it in memory
    if (!this._lastMarkdown && this.fetchedData.length > 0) {
      // Build markdown without downloading
      const source = App.state.source;
      const sourceInfo = GrainWatchAPI.getSourceInfo(source);
      const currency = App.state.currency;
      const symbol = CURRENCY_SYMBOLS[currency];
      const rate = EXCHANGE_RATES[currency];

      const pad = (n) => String(n).padStart(2, '0');
      const rangeStr = `${pad(this.range.startMonth)}/${this.range.startYear} — ${pad(this.range.endMonth)}/${this.range.endYear}`;

      let md = `# GrainWatch — ${I18N.t('export_page_title')}\n\n`;
      md += `**${I18N.t('source_badge')}:** ${sourceInfo.name}  \n`;
      md += `**${I18N.lang === 'en' ? 'Period' : 'Période'}:** ${rangeStr}  \n`;
      md += `**${I18N.lang === 'en' ? 'Currency' : 'Devise'}:** ${currency}  \n\n`;

      const hDate = I18N.t('csv_header_date');
      const hPrice = I18N.t('csv_header_price');
      const hCommodity = I18N.t('csv_header_commodity');

      md += `| ${hDate} | ${hCommodity} | ${hPrice} (${symbol}) |\n`;
      md += `|------|-----------|-------|\n`;

      this.fetchedData.forEach(({ commodity, history }) => {
        const displayName = I18N.commodityName(commodity);
        history.forEach(h => {
          const price = Math.round(h.price * rate * 100) / 100;
          md += `| ${h.date} | ${displayName} | ${App.formatNumber(price)} |\n`;
        });
      });

      this._lastMarkdown = md;
    }

    if (!this._lastMarkdown) return;

    try {
      await navigator.clipboard.writeText(this._lastMarkdown);
      const okEl = document.getElementById('exportCopyOk');
      okEl.style.display = 'inline';
      setTimeout(() => { okEl.style.display = 'none'; }, 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  },

  // --------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------
  _makeFilename(ext) {
    const ids = this.selectedCommodities.map(c => c.id).join('_');
    const date = new Date().toISOString().split('T')[0];
    return `grainwatch_${ids}_${date}.${ext}`;
  },

  _downloadFile(content, filename, mimeType, addBOM) {
    const prefix = addBOM ? '\xEF\xBB\xBF' : '';
    const blob = new Blob([prefix + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
