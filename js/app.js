/**
 * SHIV SHAKTI HP GAS - MAIN CLIENT APPLICATION BOOTSTRAPPER
 */

import { api } from './api.js';
import { auth } from './auth.js';
import { ui } from './ui.js';
import { utils } from './utils.js';
import { CONFIG } from './config.js';
import { router } from './router.js';
import { searchModule } from './modules/search.js';
import { printEngine } from './modules/print.js';
import { themeManager, UI_THEMES } from './modules/theme.js';

let companyData = null;

async function bootstrap() {
  initTheme();
  await loadCompanyBranding();

  // Check Session
  if (auth.isAuthenticated()) {
    showMainApp();
  } else {
    showLoginScreen();
  }

  bindGlobalEvents();
}

function initTheme() {
  themeManager.init();

  const isDark = localStorage.getItem(CONFIG.STORAGE_DARK) === '1';
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
}

async function loadCompanyBranding() {
  const res = await api('getMeta', {}, { loader: false, silentError: true });
  if (res.ok && res.data && res.data.company) {
    companyData = res.data.company;
    window.companyData = companyData;
    printEngine.setCompany(companyData);
    companyRenderer(companyData);
  }
}

/**
 * Global Company Profile Rendering Engine (Section 65)
 */
export function companyRenderer(comp) {
  if (!comp) return;

  // Render Sidebar Brand
  const sideLogo = document.getElementById('sidebar-logo-container');
  if (sideLogo) utils.renderCompanyLogo(sideLogo, comp);

  const sideName = document.getElementById('sidebar-company-name');
  if (sideName) sideName.textContent = comp.CompanyName || 'Shiv Shakti HP Gas';

  const sideSub = document.getElementById('sidebar-agency-sub');
  if (sideSub) sideSub.textContent = comp.DistributorCode ? `Code: ${comp.DistributorCode}` : 'HPCL Pandaul';

  // Render Login Brand
  const loginLogo = document.getElementById('login-logo-container');
  if (loginLogo) utils.renderCompanyLogo(loginLogo, comp);

  const loginTitle = document.getElementById('login-company-name');
  if (loginTitle) loginTitle.textContent = comp.AgencyName || comp.CompanyName || 'Shiv Shakti HP Gas (Pandaul)';
}

function showLoginScreen() {
  document.getElementById('auth-shell').style.display = 'block';
  document.getElementById('app-shell').style.display = 'none';

  // Interactive Password Visibility Toggle
  const toggleBtn = document.getElementById('login-toggle-pwd');
  const pwdInput = document.getElementById('login-password');
  if (toggleBtn && pwdInput) {
    toggleBtn.onclick = (e) => {
      e.preventDefault();
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      toggleBtn.innerHTML = isPwd ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    };
  }

  // Forgot Password Link Handler
  const forgotLink = document.getElementById('login-forgot-pwd-link');
  if (forgotLink) {
    forgotLink.onclick = async (e) => {
      e.preventDefault();
      const uCurrent = document.getElementById('login-username')?.value.trim() || '';
      const html = `
        <div style="text-align:left; font-size:13px; line-height:1.5;">
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px 14px; margin-bottom:14px; color:#1e40af;">
            <i class="fa-solid fa-shield-halved"></i> <strong>Account Recovery System:</strong><br>
            Enter your Operator Username and Agency Distributor Code / Master Security PIN to reset your password.
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:700;">Operator Username *</label>
            <input type="text" id="fp-username" class="form-control" placeholder="e.g. admin" value="${uCurrent}" required>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:700;">Agency Distributor Code / Master Key *</label>
            <input type="text" id="fp-code" class="form-control" placeholder="e.g. HP-PDL-8842 or RAHUL2026" required>
            <small style="color:#64748b; font-size:11px;">Agency Code: <code>HP-PDL-8842</code> or Master Recovery PIN: <code>RAHUL2026</code></small>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:700;">New Password *</label>
            <input type="password" id="fp-new-pwd" class="form-control" placeholder="Minimum 6 characters" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">Confirm New Password *</label>
            <input type="password" id="fp-confirm-pwd" class="form-control" placeholder="Re-enter new password" required>
          </div>
        </div>
      `;

      const data = await ui.formModal(html, 'Reset Account Password', () => {
        const u = document.getElementById('fp-username')?.value.trim();
        const code = document.getElementById('fp-code')?.value.trim();
        const p1 = document.getElementById('fp-new-pwd')?.value;
        const p2 = document.getElementById('fp-confirm-pwd')?.value;

        if (!u || !code || !p1) {
          Swal.showValidationMessage('All fields are required!');
          return false;
        }
        if (p1.length < 6) {
          Swal.showValidationMessage('New password must be at least 6 characters long!');
          return false;
        }
        if (p1 !== p2) {
          Swal.showValidationMessage('Passwords do not match! Please check again.');
          return false;
        }

        return { username: u, verificationCode: code, newPassword: p1 };
      }, { maxWidth: '480px' });

      if (data) {
        const res = await api('forgotPassword', data, { loaderMessage: 'Verifying and resetting password...' });
        if (res.ok) {
          ui.success('Password reset successfully! You can now log in with your new password.');
          const pEl = document.getElementById('login-password');
          if (pEl) {
            pEl.value = data.newPassword;
            pEl.focus();
          }
        }
      }
    };
  }

  const form = document.getElementById('login-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value;

      if (!u || !p) {
        ui.warn('Please enter both username and password.');
        return;
      }

      const res = await auth.login(u, p);
      if (res.ok) {
        if (res.user.forcePasswordChange) {
          await handleMandatoryPasswordChange();
        }
        showMainApp();
      }
    };
  }
}

async function handleMandatoryPasswordChange() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:6px; text-align:left;">
      <div class="modal-section-card" style="border-left:4px solid #ef4444; background:#fef2f2;">
        <div style="font-size:12.5px; color:#b91c1c; font-weight:600; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Security Notice: You must change your default password before accessing the system.</span>
        </div>
      </div>
      <div class="modal-section-card">
        <div class="modal-section-header">
          <i class="fa-solid fa-key"></i>
          <span>Credential Credentials</span>
        </div>
        <div class="modal-section-body">
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-lock"></i> Current Password *</label>
            <input type="password" id="mp-old" class="form-control" placeholder="Admin@12345" required>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-shield-halved"></i> New Password * (Min 6 characters)</label>
            <input type="password" id="mp-new" class="form-control" placeholder="Choose a strong password" required>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-check-double"></i> Confirm New Password *</label>
            <input type="password" id="mp-confirm" class="form-control" placeholder="Re-type new password" required>
          </div>
        </div>
      </div>
    </div>
  `;

  await ui.formModal(html, 'Mandatory Password Change', async () => {
    const oldP = document.getElementById('mp-old').value;
    const newP = document.getElementById('mp-new').value;
    const confP = document.getElementById('mp-confirm').value;

    if (!oldP || !newP || !confP) {
      Swal.showValidationMessage('All password fields are required!');
      return false;
    }
    if (newP.length < 6) {
      Swal.showValidationMessage('New password must be at least 6 characters long!');
      return false;
    }
    if (newP !== confP) {
      Swal.showValidationMessage('New passwords do not match!');
      return false;
    }

    const ok = await auth.changePassword(oldP, newP);
    if (!ok) {
      Swal.showValidationMessage('Failed to change password. Verify your current password.');
      return false;
    }
    return true;
  });
}

function showMainApp() {
  document.getElementById('auth-shell').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';

  const user = auth.getCurrentUser();
  if (user) {
    document.getElementById('topbar-user-name').textContent = user.fullName;
    const savedAv = localStorage.getItem('app_user_avatar');
    if (savedAv) {
      document.getElementById('topbar-user-avatar').innerHTML = `<img src="${savedAv}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      document.getElementById('topbar-user-avatar').textContent = user.fullName.substring(0, 2).toUpperCase();
    }

    // Hide navigation sections if unauthorized
    if (user.role !== 'ADMIN') {
      document.querySelectorAll('.admin-only-nav').forEach(el => el.style.display = 'none');
    }
  }

  // Initialize and synchronize Global Working Business Date
  initWorkingDateWidget();

  router.init();
  searchModule.init();
  const initialRoute = router.getRouteFromUrl();
  router.navigate(initialRoute);
}

/**
 * Global Working Business Date Manager
 * Keeps all modules (POS, Dispatch, Stock, Dues, Rojnamcha, Cashbook) in sync
 */
async function initWorkingDateWidget() {
  const dateInput = document.getElementById('topbar-working-date-input');
  const badge = document.getElementById('working-date-badge');
  const dot = document.getElementById('working-date-status-dot');
  const actionBtn = document.getElementById('btn-working-date-action');
  const widget = document.getElementById('topbar-working-date-widget');
  if (!dateInput) return;

  // Sync working date from server settings or fallback to localStorage
  try {
    const res = await api('getWorkingDate', {}, { loader: false, silentError: true });
    if (res.ok && res.data) {
      if (res.data.workingDate) {
        utils.setWorkingDate(res.data.workingDate);
      }
    }
  } catch (e) {}

  const updateUI = async () => {
    const curDate = utils.today();
    const realDate = utils.realToday();
    const isBackDate = (curDate !== realDate);
    dateInput.value = curDate;

    // Check if the current working date is closed in cashbook
    let isDayClosed = false;
    try {
      const cbRes = await api('getCashbook', { date: curDate }, { loader: false, silentError: true });
      if (cbRes.ok && cbRes.data && Number(cbRes.data.IsClosed) === 1) {
        isDayClosed = true;
      }
    } catch (e) {}

    if (badge && dot) {
      if (isDayClosed) {
        badge.className = 'badge badge-danger';
        badge.innerHTML = '<i class="fa-solid fa-lock"></i> CLOSED';
        dot.style.background = '#ef4444';
        dot.style.boxShadow = '0 0 6px #ef4444';
        if (widget) widget.style.borderColor = '#fca5a5';
      } else if (isBackDate) {
        badge.className = 'badge badge-warning';
        badge.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> BACK-DATE OPEN';
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 6px #f59e0b';
        if (widget) widget.style.borderColor = '#fde68a';
      } else {
        badge.className = 'badge badge-success';
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> TODAY OPEN';
        dot.style.background = '#10b981';
        dot.style.boxShadow = '0 0 6px #10b981';
        if (widget) widget.style.borderColor = 'var(--border)';
      }
    }
  };

  await updateUI();

  // On manual date picker change
  dateInput.addEventListener('change', async (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate) return;
    await setGlobalWorkingDate(selectedDate);
    await updateUI();
  });

  // Action button modal: Open Back Date, Today, or Close Day
  const handleActionClick = async () => {
    const curDate = utils.today();
    const realDate = utils.realToday();
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const htmlContent = `
      <div style="text-align:left; font-size:13px; line-height:1.6;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:14px;">
          <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Currently Active System Date:</div>
          <div style="font-size:16px; font-weight:800; color:#001f3f; margin-top:2px;">
            📅 ${utils.formatDate(curDate)} <span style="font-size:12px; font-weight:600; color:#64748b;">(${curDate})</span>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12.5px; font-weight:700; color:#1e293b; display:block; margin-bottom:6px;">
            Select / Pick New Working Date:
          </label>
          <input type="date" id="swal-pick-date" class="form-control" value="${curDate}" style="width:100%; height:40px; font-size:14px; font-family:'JetBrains Mono', monospace; font-weight:700;">
        </div>

        <div style="font-size:11.5px; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:6px;">Quick Presets:</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button type="button" id="swal-btn-today" class="btn btn-outline btn-sm" style="font-size:12px; font-weight:700; padding:8px;">
            <i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Today (${utils.formatDate(realDate)})
          </button>
          <button type="button" id="swal-btn-yesterday" class="btn btn-outline btn-sm" style="font-size:12px; font-weight:700; padding:8px;">
            <i class="fa-solid fa-clock-rotate-left" style="color:#f59e0b;"></i> Yesterday (${utils.formatDate(yesterdayDate)})
          </button>
        </div>
      </div>
    `;

    Swal.fire({
      title: 'Active Business Working Date',
      html: htmlContent,
      showCancelButton: true,
      confirmButtonColor: '#001f3f',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Apply Active Date',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'cool-swal-popup' },
      didOpen: () => {
        const inp = document.getElementById('swal-pick-date');
        document.getElementById('swal-btn-today')?.addEventListener('click', () => {
          if (inp) inp.value = realDate;
        });
        document.getElementById('swal-btn-yesterday')?.addEventListener('click', () => {
          if (inp) inp.value = yesterdayDate;
        });
      },
      preConfirm: () => {
        const picked = document.getElementById('swal-pick-date')?.value;
        if (!picked || !/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
          Swal.showValidationMessage('Please choose a valid date (YYYY-MM-DD)');
          return false;
        }
        return picked;
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        await setGlobalWorkingDate(result.value);
        await updateUI();
      }
    });
  };

  actionBtn?.addEventListener('click', handleActionClick);
  badge?.addEventListener('click', handleActionClick);
}

/**
 * Persist new working date to server settings and refresh current route view
 */
async function setGlobalWorkingDate(dateStr) {
  utils.setWorkingDate(dateStr);
  try {
    await api('setWorkingDate', { date: dateStr }, { loader: false, silentError: true });
  } catch (e) {}

  ui.toast(`Active System Working Date set to: ${utils.formatDate(dateStr)}`);

  // Reload current active module to immediately reflect the new working date
  const currentRoute = router.getCurrentRoute();
  if (currentRoute) {
    router.navigate(currentRoute, false);
  }
}

function bindGlobalEvents() {
  // Universal Sidebar Collapse / Expand Toggle
  const toggleBtn = document.getElementById('sidebar-toggle-btn') || document.getElementById('mobile-sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');
  if (toggleBtn && sidebar) {
    // Restore saved collapse state on desktop
    if (window.innerWidth > 1024 && localStorage.getItem('erp_sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('open');
      } else {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('erp_sidebar_collapsed', sidebar.classList.contains('collapsed'));
      }
    });

    // Close mobile sidebar when clicking on main content
    document.querySelector('.main-wrapper')?.addEventListener('click', () => {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // User Profile Dropdown / Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      auth.logout();
    });
  }

  // Change Password Trigger
  const changePwdBtn = document.getElementById('btn-change-password');
  if (changePwdBtn) {
    changePwdBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleUserPasswordChange();
    });
  }

  // Print Preview Modal Close
  const closePrintBtn = document.getElementById('print-modal-close-btn');
  if (closePrintBtn) {
    closePrintBtn.addEventListener('click', () => {
      printEngine.closePreview();
    });
  }

  // Theme Palette Dropdown Toggle
  const themePaletteBtn = document.getElementById('btn-theme-palette');
  const themeDropdown = document.getElementById('theme-palette-dropdown');
  if (themePaletteBtn && themeDropdown) {
    themePaletteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      themeDropdown.style.display = themeDropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!themeDropdown.contains(e.target) && e.target !== themePaletteBtn) {
        themeDropdown.style.display = 'none';
      }
    });

    // Theme swatch buttons
    themeDropdown.querySelectorAll('.theme-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.theme;
        let matched = null;
        if (t === 'navy') matched = UI_THEMES.find(u => u.name === 'Enterprise Navy');
        else if (t === 'graphite') matched = UI_THEMES.find(u => u.name === 'Graphite & Cyan');
        else if (t === 'emerald') matched = UI_THEMES.find(u => u.name === 'Emerald Corporate');
        else if (t === 'zinc') matched = UI_THEMES.find(u => u.name === 'Zinc & Sky');
        else if (t === 'arctic') matched = UI_THEMES.find(u => u.name === 'Arctic Frost');
        else if (t === 'carbon') matched = UI_THEMES.find(u => u.name === 'Carbon Electric');
        else if (t === 'amber') matched = UI_THEMES.find(u => u.name.includes('Amber') || u.name === 'Warm Analytics');

        if (matched) {
          themeManager.applyAndSaveTheme(matched, false);
        } else {
          document.body.setAttribute('data-theme', t);
        }
        themeDropdown.style.display = 'none';
      });
    });

    // Dark Mode Toggle
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) {
      darkToggle.checked = document.body.classList.contains('dark-mode');
      darkToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.add('dark-mode');
          localStorage.setItem(CONFIG.STORAGE_DARK, '1');
          ui.toast('Dark Mode enabled');
        } else {
          document.body.classList.remove('dark-mode');
          localStorage.setItem(CONFIG.STORAGE_DARK, '0');
          ui.toast('Light Mode enabled');
        }
      });
    }

    document.getElementById('topbar-open-themes-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      themeDropdown.style.display = 'none';
      router.navigate('settings');
      import('./modules/settings.js').then(m => m.settingsModule.switchTab('appearance'));
    });
  }
}

async function handleUserPasswordChange() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:6px; text-align:left;">
      <div class="modal-section-card">
        <div class="modal-section-header">
          <i class="fa-solid fa-key"></i>
          <span>Change Account Password</span>
        </div>
        <div class="modal-section-body">
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-lock"></i> Current Password *</label>
            <input type="password" id="up-old" class="form-control" placeholder="Enter current password" required>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fa-solid fa-shield-halved"></i> New Password * (Min 6 characters)</label>
            <input type="password" id="up-new" class="form-control" placeholder="Choose a new secure password" required>
          </div>
        </div>
      </div>
    </div>
  `;

  const data = await ui.formModal(html, 'Update Account Password', () => {
    const o = document.getElementById('up-old').value;
    const n = document.getElementById('up-new').value;
    if (!o || !n) {
      Swal.showValidationMessage('Both fields are required!');
      return false;
    }
    if (n.length < 6) {
      Swal.showValidationMessage('Password must be at least 6 characters long!');
      return false;
    }
    return { oldP: o, newP: n };
  });

  if (data) {
    await auth.changePassword(data.oldP, data.newP);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', bootstrap);
