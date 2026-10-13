/**
 * SHIV SHAKTI HP GAS - SYSTEM SETTINGS & APPEARANCE MODULE
 */

import { api } from '../api.js';
import { ui } from '../ui.js';
import { CONFIG } from '../config.js';
import { auth } from '../auth.js';
import { themeManager } from './theme.js';

let settingsMap = {};
let currentTab = 'appearance';

export const settingsModule = {
  async init() {
    this.renderContainer();
    await Promise.all([this.loadSettings(), this.loadHealth()]);
  },

  renderContainer() {
    const root = document.getElementById('view-settings');
    if (!root) return;

    root.innerHTML = `
      <!-- Settings Header Card -->
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Settings & System Preferences</h2>
            <p style="font-size:13px; color:var(--text-muted); margin-top:2px;">Themes, 35+ UI palettes, inventory thresholds, document footers and database health</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="set-backup-btn" class="btn btn-secondary btn-sm" ${auth.getCurrentUser()?.role !== 'ADMIN' ? 'disabled' : ''}>
              <i class="fa-solid fa-database"></i> Trigger Backup
            </button>
            <button id="set-save-btn" class="btn btn-primary btn-sm" ${auth.getCurrentUser()?.role !== 'ADMIN' ? 'disabled' : ''}>
              <i class="fa-solid fa-floppy-disk"></i> Save Settings
            </button>
          </div>
        </div>
      </div>

      <!-- Settings Navigation Tabs Bar (Matching Reference Architecture) -->
      <div class="card" style="margin-bottom:20px; padding:8px 12px;">
        <div style="display:flex; gap:8px; overflow-x:auto;" id="set-nav-tabs">
          <button class="btn btn-sm btn-primary set-tab-btn" data-tab="appearance">
            <i class="fa-solid fa-palette"></i> Appearance & Themes
          </button>
          <button class="btn btn-sm btn-outline set-tab-btn" data-tab="tax">
            <i class="fa-solid fa-percent"></i> GST & Billing Tax
          </button>
          <button class="btn btn-sm btn-outline set-tab-btn" data-tab="thresholds">
            <i class="fa-solid fa-sliders"></i> Inventory & Alerts
          </button>
          <button class="btn btn-sm btn-outline set-tab-btn" data-tab="printing">
            <i class="fa-solid fa-print"></i> Document Footers
          </button>
          <button class="btn btn-sm btn-outline set-tab-btn" data-tab="diagnostics">
            <i class="fa-solid fa-heart-pulse"></i> System Diagnostics
          </button>
        </div>
      </div>

      <!-- Tab 1: Appearance & 35 Theme Presets -->
      <div id="set-tab-content-appearance" class="set-tab-content">
        ${themeManager.renderAppearanceHtml()}
      </div>

      <!-- Tab GST: Tax & Billing Rules -->
      <div id="set-tab-content-tax" class="set-tab-content" style="display:none;">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; border-bottom:1px solid var(--border); padding-bottom:14px; margin-bottom:18px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary);"></i> GST (Goods & Services Tax) Configuration
              </h3>
              <p style="font-size:12.5px; color:var(--text-muted); margin:0;">
                Control whether GST tax calculations and tax rows are actively applied during POS billing and invoice generation.
              </p>
            </div>
            <div style="display:flex; align-items:center; gap:12px; background:var(--bg-body); padding:8px 16px; border-radius:30px; border:1px solid var(--border);">
              <span id="set-gst-status-badge" class="badge badge-success" style="font-size:12px; padding:6px 12px; font-weight:700;">
                <i class="fa-solid fa-check"></i> GST ENABLED
              </span>
              <label class="switch" style="position:relative; display:inline-block; width:52px; height:28px; margin:0; cursor:pointer;">
                <input type="checkbox" id="set-gst-toggle" checked style="opacity:0; width:0; height:0;">
                <span class="slider round" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#10b981; transition:.3s; border-radius:34px;"></span>
              </label>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:16px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:16px;">
              <div style="font-weight:700; color:#0f172a; margin-bottom:6px; font-size:13.5px; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-toggle-on" style="color:#10b981;"></i> When GST is ENABLED:
              </div>
              <ul style="font-size:12px; color:#475569; margin:0; padding-left:18px; line-height:1.6;">
                <li>POS cart items calculate applicable GST % (e.g. 5%, 18%) into Subtotal & Tax summary.</li>
                <li>Invoices print as official <strong>GST Tax Invoice</strong> with CGST & SGST breakdowns.</li>
                <li>Invoice records store calculated TaxAmount in database records.</li>
              </ul>
            </div>

            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-md); padding:16px;">
              <div style="font-weight:700; color:#991b1b; margin-bottom:6px; font-size:13.5px; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-toggle-off" style="color:#ef4444;"></i> When GST is DISABLED:
              </div>
              <ul style="font-size:12px; color:#7f1d1d; margin:0; padding-left:18px; line-height:1.6;">
                <li><strong>No GST Tax will be added to the bill</strong> (Tax = ₹0.00).</li>
                <li>Net bill payable will be exactly <em>Subtotal - Discount</em>.</li>
                <li>Invoices print cleanly without CGST/SGST tax additions.</li>
              </ul>
            </div>
          </div>

          <div class="alert alert-info" style="display:flex; align-items:center; gap:10px; margin:0; font-size:12.5px;">
            <i class="fa-solid fa-circle-info" style="font-size:16px;"></i>
            <span>Tip: Click <strong>"Save Settings"</strong> at the top right after toggling to immediately activate the change across all billing screens.</span>
          </div>
        </div>
      </div>

      <!-- Tab 2: Inventory & Thresholds -->
      <div id="set-tab-content-thresholds" class="set-tab-content" style="display:none;">
        <div class="card">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:6px;">Inventory Low-Stock Thresholds</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">Define minimum alert levels in godown inventory before stock alerts trigger.</p>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">14.2 KG Domestic Alert Level</label>
              <input type="number" id="set-th-142" class="form-control num-font" min="1">
            </div>
            <div class="form-group">
              <label class="form-label">19 KG Commercial Alert Level</label>
              <input type="number" id="set-th-190" class="form-control num-font" min="1">
            </div>
            <div class="form-group">
              <label class="form-label">5 KG Cylinder Alert Level</label>
              <input type="number" id="set-th-050" class="form-control num-font" min="1">
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: Document Footers -->
      <div id="set-tab-content-printing" class="set-tab-content" style="display:none;">
        <div class="card">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:6px;">Printing & Document Footers</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">Custom statutory notices, safety warnings and helpline numbers printed on receipts and invoices.</p>
          <div class="form-group">
            <label class="form-label">Receipt & Invoice Footer Notice</label>
            <textarea id="set-print-footer" class="form-control" rows="3"></textarea>
          </div>
        </div>
      </div>

      <!-- Tab 4: Diagnostics & Health -->
      <div id="set-tab-content-diagnostics" class="set-tab-content" style="display:none;">
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-heart-pulse" style="color:var(--color-success);"></i> Live System Health Diagnostics</div>
            <button id="set-health-refresh-btn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrows-rotate"></i> Reload Health</button>
          </div>
          <div class="card-body">
            <div id="set-health-container" style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
              <div class="skeleton skeleton-card"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    themeManager.bindAppearanceEvents();
  },

  bindEvents() {
    // 1. Tab Navigation
    document.querySelectorAll('.set-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // 2. Global Actions
    document.getElementById('set-save-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('set-backup-btn')?.addEventListener('click', () => this.triggerBackup());
    document.getElementById('set-health-refresh-btn')?.addEventListener('click', () => this.loadHealth());

    // 3. GST Toggle Visual Change
    const gstToggle = document.getElementById('set-gst-toggle');
    const gstBadge = document.getElementById('set-gst-status-badge');
    gstToggle?.addEventListener('change', () => {
      if (gstToggle.checked) {
        if (gstBadge) {
          gstBadge.className = 'badge badge-success';
          gstBadge.innerHTML = '<i class="fa-solid fa-check"></i> GST ENABLED';
        }
        gstToggle.nextElementSibling.style.backgroundColor = '#10b981';
      } else {
        if (gstBadge) {
          gstBadge.className = 'badge badge-danger';
          gstBadge.innerHTML = '<i class="fa-solid fa-xmark"></i> GST DISABLED';
        }
        gstToggle.nextElementSibling.style.backgroundColor = '#cbd5e1';
      }
    });
  },

  switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.set-tab-btn').forEach(b => {
      if (b.dataset.tab === tab) {
        b.className = 'btn btn-sm btn-primary set-tab-btn';
      } else {
        b.className = 'btn btn-sm btn-outline set-tab-btn';
      }
    });

    document.querySelectorAll('.set-tab-content').forEach(c => {
      c.style.display = 'none';
    });

    const activeEl = document.getElementById(`set-tab-content-${tab}`);
    if (activeEl) {
      activeEl.style.display = 'block';
    }
  },

  async loadSettings() {
    const res = await api('getSettings', {}, { loader: false });
    if (!res.ok || !res.data) return;

    settingsMap = res.data.map || {};

    const gstToggle = document.getElementById('set-gst-toggle');
    const gstBadge = document.getElementById('set-gst-status-badge');
    const gstEnabled = settingsMap['GST_ENABLED'] !== '0';
    if (gstToggle) {
      gstToggle.checked = gstEnabled;
      if (gstEnabled) {
        if (gstBadge) {
          gstBadge.className = 'badge badge-success';
          gstBadge.innerHTML = '<i class="fa-solid fa-check"></i> GST ENABLED';
        }
        if (gstToggle.nextElementSibling) gstToggle.nextElementSibling.style.backgroundColor = '#10b981';
      } else {
        if (gstBadge) {
          gstBadge.className = 'badge badge-danger';
          gstBadge.innerHTML = '<i class="fa-solid fa-xmark"></i> GST DISABLED';
        }
        if (gstToggle.nextElementSibling) gstToggle.nextElementSibling.style.backgroundColor = '#cbd5e1';
      }
    }

    const th142 = document.getElementById('set-th-142');
    if (th142) th142.value = settingsMap['LOW_STOCK_THRESHOLD_142'] || 50;

    const th190 = document.getElementById('set-th-190');
    if (th190) th190.value = settingsMap['LOW_STOCK_THRESHOLD_190'] || 15;

    const th050 = document.getElementById('set-th-050');
    if (th050) th050.value = settingsMap['LOW_STOCK_THRESHOLD_050'] || 10;

    const footer = document.getElementById('set-print-footer');
    if (footer) footer.value = settingsMap['PRINT_FOOTER_NOTE'] || 'HP Gas Suraksha Sanrakshit. For LPG Emergency Call 1906. Thank You!';
  },

  async loadHealth() {
    const res = await api('getSystemHealth', {}, { loader: false });
    const box = document.getElementById('set-health-container');
    if (!box) return;

    if (!res.ok || !res.data) {
      box.innerHTML = '<div style="color:var(--color-danger);">Unable to read health metrics.</div>';
      return;
    }

    const h = res.data;
    box.innerHTML = `
      <div class="diag-row">
        <span>Server Status:</span> <strong style="color:var(--color-success);"><i class="fa-solid fa-circle-check"></i> ${h.status}</strong>
      </div>
      <div class="diag-row">
        <span>PHP Engine Version:</span> <strong>PHP ${h.phpVersion}</strong>
      </div>
      <div class="diag-row">
        <span>Primary Database:</span> <strong>${h.database}</strong>
      </div>
      <div class="diag-row">
        <span>Physical DB Size:</span> <strong class="num-font">${h.databaseSize}</strong>
      </div>
      <div class="diag-row">
        <span>Registered Customers:</span> <strong class="num-font">${h.totalCustomers}</strong>
      </div>
      <div class="diag-row">
        <span>Total Bills Generated:</span> <strong class="num-font">${h.totalBills}</strong>
      </div>
      <div class="diag-row">
        <span>Last Database Backup:</span> <strong style="font-size:11px;">${h.lastBackup}</strong>
      </div>
      <div class="diag-row">
        <span>Server Clock:</span> <strong class="num-font" style="font-size:11.5px;">${h.serverTime}</strong>
      </div>
    `;
  },

  async saveSettings() {
    const isGstOn = document.getElementById('set-gst-toggle')?.checked ? '1' : '0';
    const payload = {
      settings: {
        'GST_ENABLED': isGstOn,
        'LOW_STOCK_THRESHOLD_142': document.getElementById('set-th-142')?.value || '50',
        'LOW_STOCK_THRESHOLD_190': document.getElementById('set-th-190')?.value || '15',
        'LOW_STOCK_THRESHOLD_050': document.getElementById('set-th-050')?.value || '10',
        'PRINT_FOOTER_NOTE': document.getElementById('set-print-footer')?.value || ''
      }
    };

    const res = await api('saveSettings', payload, { loaderMessage: 'Saving system settings...' });
    if (res.ok) {
      ui.success('System settings saved successfully.');
    }
  },

  async triggerBackup() {
    const confirmed = await ui.confirm('Create a physical snapshot backup copy of the complete database right now?', 'Database Backup', 'Yes, Create Backup');
    if (!confirmed) return;

    const res = await api('backupDatabase', {}, { loaderMessage: 'Generating database backup copy...' });
    if (res.ok && res.data) {
      ui.success(`Backup copy created: ${res.data.FileName} (${res.data.FileSize})`);
      this.loadHealth();
    }
  }
};
