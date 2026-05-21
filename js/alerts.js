// ============================================================
// GRAINWATCH — Alerts System
// localStorage-based price & variation alerts
// ============================================================

const AlertsManager = {
  MAX_ALERTS: 5,
  _alerts: [],       // { id, commodityId, type, value, triggered, triggeredAt, currentPrice }
  _history: [],      // { text, time, commodityId?, type?, value? }
  _pendingReplace: null,

  // --------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------
  init() {
    this._load();
    this._bindEvents();
    this._updateBadge();
  },

  // --------------------------------------------------------
  // PERSISTENCE (localStorage)
  // --------------------------------------------------------
  _load() {
    try {
      const saved = localStorage.getItem('grainwatch_alerts');
      if (saved) this._alerts = JSON.parse(saved);
      const hist = localStorage.getItem('grainwatch_alerts_history');
      if (hist) this._history = JSON.parse(hist);
    } catch (e) {}
  },

  _save() {
    try {
      localStorage.setItem('grainwatch_alerts', JSON.stringify(this._alerts));
      localStorage.setItem('grainwatch_alerts_history', JSON.stringify(this._history));
    } catch (e) {}
  },

  // --------------------------------------------------------
  // EVENT BINDINGS
  // --------------------------------------------------------
  _bindEvents() {
    // Bell icon
    const bell = document.getElementById('alertsBell');
    if (bell) bell.addEventListener('click', () => this.openPanel());

    // Close panel
    const close = document.getElementById('alertsClose');
    if (close) close.addEventListener('click', () => this.closePanel());

    // Overlay click to close
    const overlay = document.getElementById('alertsOverlay');
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closePanel();
    });

    // Add button
    const addBtn = document.getElementById('alertsAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => this._showForm());

    // Cancel button
    const cancelBtn = document.getElementById('alertCancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this._hideForm());

    // Save button
    const saveBtn = document.getElementById('alertSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => this._createAlert());

    // Type change — update unit display
    const typeSelect = document.getElementById('alertTypeSelect');
    if (typeSelect) typeSelect.addEventListener('change', () => this._updateValueUnit());
  },

  // --------------------------------------------------------
  // PANEL OPEN / CLOSE
  // --------------------------------------------------------
  openPanel() {
    this._populateCommoditySelect();
    this._renderAlertList();
    this._renderHistory();
    this._hideForm();

    // Show/hide add button based on count
    const addBtn = document.getElementById('alertsAddBtn');
    const maxMsg = document.getElementById('alertsMaxMsg');
    if (this._alerts.length >= this.MAX_ALERTS) {
      addBtn.style.display = 'none';
      maxMsg.style.display = 'block';
    } else {
      addBtn.style.display = 'flex';
      maxMsg.style.display = 'none';
    }

    document.getElementById('alertsOverlay').style.display = 'flex';
  },

  closePanel() {
    document.getElementById('alertsOverlay').style.display = 'none';
  },

  // --------------------------------------------------------
  // COMMODITY DROPDOWN
  // --------------------------------------------------------
  _populateCommoditySelect() {
    const select = document.getElementById('alertCommoditySelect');
    if (!select) return;
    select.innerHTML = '';

    ALL_COMMODITIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${I18N.commodityName(c)}`;
      select.appendChild(opt);
    });

    // Pre-select current commodity
    if (App.state.selectedCommodity) {
      select.value = App.state.selectedCommodity;
    }
  },

  // --------------------------------------------------------
  // FORM SHOW / HIDE
  // --------------------------------------------------------
  _showForm() {
    document.getElementById('alertsForm').style.display = 'block';
    document.getElementById('alertsAddBtn').style.display = 'none';
    document.getElementById('alertValueInput').value = '';
    this._updateValueUnit();
  },

  _hideForm() {
    document.getElementById('alertsForm').style.display = 'none';
    this._hideReplaceConfirm();
    if (this._alerts.length < this.MAX_ALERTS) {
      document.getElementById('alertsAddBtn').style.display = 'flex';
    }
  },

  _updateValueUnit() {
    const type = document.getElementById('alertTypeSelect').value;
    const unitEl = document.getElementById('alertValueUnit');
    if (type === 'var_up' || type === 'var_down') {
      unitEl.textContent = '%';
    } else {
      unitEl.textContent = CURRENCY_SYMBOLS[App.state.currency] || '$';
    }
  },

  // --------------------------------------------------------
  // CREATE ALERT
  // --------------------------------------------------------
  _createAlert() {
    if (this._alerts.length >= this.MAX_ALERTS && !this._pendingReplace) return;

    const commodityId = document.getElementById('alertCommoditySelect').value;
    const type = document.getElementById('alertTypeSelect').value;
    const value = parseFloat(document.getElementById('alertValueInput').value);

    if (!commodityId || isNaN(value) || value <= 0) return;

    // Check for existing alert on same commodity
    const existing = this._alerts.find(a => a.commodityId === commodityId);
    if (existing && !this._pendingReplace) {
      this._showReplaceConfirm(existing, commodityId, type, value);
      return;
    }

    // If replacing, remove the old one first
    if (this._pendingReplace) {
      this._alerts = this._alerts.filter(a => a.id !== this._pendingReplace);
      this._pendingReplace = null;
    }

    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      commodityId,
      type,
      value,
      triggered: false,
      triggeredAt: null,
      currentPrice: null,
    };

    this._alerts.push(alert);
    this._save();
    this._hideForm();
    this._hideReplaceConfirm();
    this.openPanel(); // refresh display
  },

  // --------------------------------------------------------
  // REPLACE CONFIRMATION
  // --------------------------------------------------------
  _showReplaceConfirm(existing, commodityId, type, value) {
    const commodity = ALL_COMMODITIES.find(c => c.id === commodityId);
    const name = commodity ? I18N.commodityName(commodity) : commodityId;

    // Create or show the confirm bar
    let confirm = document.getElementById('alertReplaceConfirm');
    if (!confirm) {
      confirm = document.createElement('div');
      confirm.id = 'alertReplaceConfirm';
      confirm.className = 'alert-replace-confirm';
      const form = document.getElementById('alertsForm');
      form.parentNode.insertBefore(confirm, form.nextSibling);
    }

    confirm.innerHTML = `
      <span class="alert-replace-text">⚠️ ${I18N.t('alerts_replace_msg').replace('{name}', name)}</span>
      <div class="alert-replace-buttons">
        <button class="alert-replace-yes" id="alertReplaceYes">${I18N.t('alerts_replace_yes')}</button>
        <button class="alert-replace-no" id="alertReplaceNo">${I18N.t('alerts_replace_no')}</button>
      </div>
    `;
    confirm.style.display = 'block';

    document.getElementById('alertReplaceYes').addEventListener('click', () => {
      this._pendingReplace = existing.id;
      this._createAlert();
    });

    document.getElementById('alertReplaceNo').addEventListener('click', () => {
      this._hideReplaceConfirm();
    });
  },

  _hideReplaceConfirm() {
    const confirm = document.getElementById('alertReplaceConfirm');
    if (confirm) confirm.style.display = 'none';
    this._pendingReplace = null;
  },

  // --------------------------------------------------------
  // DELETE ALERT
  // --------------------------------------------------------
  _deleteAlert(id) {
    this._alerts = this._alerts.filter(a => a.id !== id);
    this._save();
    this._updateBadge();
    this.openPanel(); // refresh
  },

  // --------------------------------------------------------
  // ACKNOWLEDGE TRIGGERED ALERT
  // --------------------------------------------------------
  _acknowledgeAlert(id) {
    const alert = this._alerts.find(a => a.id === id);
    if (alert) {
      alert.triggered = false;
      alert.triggeredAt = null;
      this._save();
      this._updateBadge();
      this.openPanel(); // refresh
    }
  },

  // --------------------------------------------------------
  // RENDER ALERT LIST
  // --------------------------------------------------------
  _renderAlertList() {
    const list = document.getElementById('alertsList');
    const empty = document.getElementById('alertsEmpty');

    if (this._alerts.length === 0) {
      empty.style.display = 'block';
      list.querySelectorAll('.alert-card').forEach(el => el.remove());
      return;
    }

    empty.style.display = 'none';

    const html = this._alerts.map(a => {
      const commodity = ALL_COMMODITIES.find(c => c.id === a.commodityId);
      if (!commodity) return '';

      const name = I18N.commodityName(commodity);
      const typeLabel = I18N.t('alerts_type_' + a.type);
      const unit = (a.type === 'var_up' || a.type === 'var_down') ? '%' : (CURRENCY_SYMBOLS[App.state.currency] || '$');
      const detail = `${typeLabel} ${a.value}${unit}`;

      const statusClass = a.triggered ? 'triggered' : 'active';
      const statusText = a.triggered ? I18N.t('alerts_triggered') : I18N.t('alerts_active');

      const ackBtn = a.triggered
        ? `<button class="alert-card-ack" data-ack="${a.id}">${I18N.t('alerts_acknowledge')}</button>`
        : '';

      return `<div class="alert-card ${a.triggered ? 'triggered' : ''}">
        <span class="alert-card-icon">${commodity.icon}</span>
        <div class="alert-card-info">
          <div class="alert-card-name">${name}</div>
          <div class="alert-card-detail">${detail}</div>
        </div>
        <span class="alert-card-status ${statusClass}">${statusText}</span>
        ${ackBtn}
        <div class="alert-card-actions">
          <button class="alert-card-delete" data-delete="${a.id}" title="${I18N.t('alerts_delete')}">×</button>
        </div>
      </div>`;
    }).join('');

    // Remove old cards, keep empty div
    list.querySelectorAll('.alert-card').forEach(el => el.remove());
    list.insertAdjacentHTML('beforeend', html);

    // Bind delete buttons
    list.querySelectorAll('.alert-card-delete').forEach(btn => {
      btn.addEventListener('click', () => this._deleteAlert(btn.dataset.delete));
    });

    // Bind acknowledge buttons
    list.querySelectorAll('.alert-card-ack').forEach(btn => {
      btn.addEventListener('click', () => this._acknowledgeAlert(btn.dataset.ack));
    });
  },

  // --------------------------------------------------------
  // RENDER HISTORY
  // --------------------------------------------------------
  _renderHistory() {
    const list = document.getElementById('alertsHistoryList');
    if (!list) return;

    if (this._history.length === 0) {
      list.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'alerts-history-empty';
      emptyDiv.setAttribute('data-i18n', 'alerts_history_empty');
      emptyDiv.textContent = I18N.t('alerts_history_empty');
      list.appendChild(emptyDiv);
      return;
    }

    // Show last 10, most recent first
    // Construction DOM safe : h.text / h.time / h.commodityId proviennent du
    // localStorage qui peut être altéré (extension malveillante, accès local)
    const items = this._history.slice(-10).reverse();
    list.textContent = '';
    items.forEach((h, i) => {
      const idx = this._history.length - 1 - i; // index réel dans _history
      const isReusable = !!h.commodityId;

      const div = document.createElement('div');
      div.className = 'alert-history-item' + (isReusable ? ' alert-history-reusable' : '');
      if (isReusable) {
        div.dataset.histIdx = String(idx);
        div.title = I18N.t('alerts_reuse_hint');
      }

      const timeSpan = document.createElement('span');
      timeSpan.className = 'alert-history-time';
      timeSpan.textContent = h.time || '';
      div.appendChild(timeSpan);

      const textSpan = document.createElement('span');
      textSpan.textContent = h.text || '';
      div.appendChild(textSpan);

      if (isReusable) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'alert-history-reuse-icon';
        iconSpan.textContent = '↩';
        div.appendChild(iconSpan);
      }

      list.appendChild(div);
    });

    // Bind click on reusable history items
    list.querySelectorAll('.alert-history-reusable').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.histIdx);
        const h = this._history[idx];
        if (h && h.commodityId) this._prefillFromHistory(h);
      });
    });
  },

  // --------------------------------------------------------
  // BADGE UPDATE
  // --------------------------------------------------------
  _updateBadge() {
    const badge = document.getElementById('alertsBadge');
    const bell = document.getElementById('alertsBell');
    if (!badge) return;

    const triggeredCount = this._alerts.filter(a => a.triggered).length;

    if (triggeredCount > 0) {
      badge.textContent = triggeredCount;
      badge.style.display = 'flex';
      bell.classList.add('has-triggered');
    } else {
      badge.style.display = 'none';
      bell.classList.remove('has-triggered');
    }
  },

  // --------------------------------------------------------
  // CHECK ALERTS (called after price data loads)
  // --------------------------------------------------------
  checkAlerts(pricesData) {
    if (!pricesData || pricesData.length === 0) return;
    if (this._alerts.length === 0) return;

    const currency = App.state.currency;
    const rate = EXCHANGE_RATES[currency];

    this._alerts.forEach(alert => {
      if (alert.triggered) return; // already triggered, skip

      const priceInfo = pricesData.find(p => p.id === alert.commodityId);
      if (!priceInfo) return;

      const currentPrice = Math.round(priceInfo.currentPrice * rate * 100) / 100;
      alert.currentPrice = currentPrice;

      let triggered = false;
      let toastMsg = '';
      const commodity = ALL_COMMODITIES.find(c => c.id === alert.commodityId);
      const name = commodity ? I18N.commodityName(commodity) : alert.commodityId;
      const symbol = CURRENCY_SYMBOLS[currency];

      switch (alert.type) {
        case 'above':
          if (currentPrice > alert.value) {
            triggered = true;
            toastMsg = `<strong>${name}</strong> ${I18N.t('alerts_toast_above')} ${symbol}${alert.value} → ${symbol}${App.formatNumber(currentPrice)}`;
          }
          break;
        case 'below':
          if (currentPrice < alert.value) {
            triggered = true;
            toastMsg = `<strong>${name}</strong> ${I18N.t('alerts_toast_below')} ${symbol}${alert.value} → ${symbol}${App.formatNumber(currentPrice)}`;
          }
          break;
        case 'var_up':
          if (priceInfo.change > alert.value) {
            triggered = true;
            toastMsg = `<strong>${name}</strong> ${I18N.t('alerts_toast_var_up')} ${priceInfo.change.toFixed(2)}% (${I18N.t('alerts_unit_price')}: ${alert.value}%)`;
          }
          break;
        case 'var_down':
          if (priceInfo.change < -alert.value) {
            triggered = true;
            toastMsg = `<strong>${name}</strong> ${I18N.t('alerts_toast_var_down')} ${Math.abs(priceInfo.change).toFixed(2)}% (${I18N.t('alerts_unit_price')}: ${alert.value}%)`;
          }
          break;
      }

      if (triggered) {
        alert.triggered = true;
        const now = new Date();
        const locale = I18N.lang === 'en' ? 'en-GB' : 'fr-FR';
        alert.triggeredAt = now.toLocaleString(locale);

        // Add to history (with raw data for re-use)
        const icon = commodity ? commodity.icon : '📊';
        this._history.push({
          text: `${icon} ${name}: ${this._getTypeLabel(alert.type)} ${alert.value}${alert.type.startsWith('var') ? '%' : symbol}`,
          time: now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
          commodityId: alert.commodityId,
          type: alert.type,
          value: alert.value,
        });

        // Keep history to 50 max
        if (this._history.length > 50) {
          this._history = this._history.slice(-50);
        }

        // Show toast
        this._showToast(icon, toastMsg);
      }
    });

    this._save();
    this._updateBadge();
  },

  // --------------------------------------------------------
  // PRE-FILL FROM HISTORY
  // --------------------------------------------------------
  _prefillFromHistory(historyItem) {
    if (this._alerts.length >= this.MAX_ALERTS) {
      // Can't add more — but maybe we can replace
      this._showForm();
      return;
    }
    this._showForm();
    // Pre-fill the form fields
    const select = document.getElementById('alertCommoditySelect');
    const typeSelect = document.getElementById('alertTypeSelect');
    const valueInput = document.getElementById('alertValueInput');
    if (select) select.value = historyItem.commodityId;
    if (typeSelect) {
      typeSelect.value = historyItem.type;
      this._updateValueUnit();
    }
    if (valueInput) valueInput.value = historyItem.value;
  },

  _getTypeLabel(type) {
    const labels = {
      above: '▲',
      below: '▼',
      var_up: '📈 +',
      var_down: '📉 -',
    };
    return labels[type] || '';
  },

  // --------------------------------------------------------
  // TOAST NOTIFICATION
  // --------------------------------------------------------
  _showToast(icon, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 6000);
  },
};
