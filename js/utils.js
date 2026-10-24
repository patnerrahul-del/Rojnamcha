/**
 * SHIV SHAKTI HP GAS - CORE UTILITIES & HELPERS
 * Financial formatting, Integer Paise, Dates, CSV Exporter, Base64 Logo Handler & Sanitization
 */

export const utils = {
  /**
   * Currency Formatter in INR ₹ with JetBrains Mono numbers
   */
  formatCurrency(amount) {
    const val = Number(amount) || 0;
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /**
   * Convert Rupee amount to Integer Paise
   */
  toPaise(amount) {
    return Math.round((Number(amount) || 0) * 100);
  },

  /**
   * Convert Integer Paise to Rupee float
   */
  fromPaise(paise) {
    return (Number(paise) || 0) / 100;
  },

  /**
   * System Working Business Date in YYYY-MM-DD
   * If a specific business date is active/open, returns that date;
   * otherwise falls back to system actual date.
   */
  today() {
    try {
      const activeWorkingDate = localStorage.getItem('erp_active_working_date');
      if (activeWorkingDate && /^\d{4}-\d{2}-\d{2}$/.test(activeWorkingDate)) {
        return activeWorkingDate;
      }
    } catch (e) {}
    return this.realToday();
  },

  /**
   * Actual Real Calendar Date in YYYY-MM-DD
   */
  realToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Check if current working date is a Back-Dated session
   */
  isBackDateActive() {
    return this.today() !== this.realToday();
  },

  /**
   * Set active business working date
   */
  setWorkingDate(dateStr) {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      localStorage.setItem('erp_active_working_date', dateStr);
    } else {
      localStorage.removeItem('erp_active_working_date');
    }
  },

  /**
   * Format Date to standard Indian business format: DD-MM-YYYY
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      if (typeof dateStr === 'string' && dateStr.includes(' to ')) {
        const [d1, d2] = dateStr.split(' to ');
        return `${this.formatDate(d1.trim())} to ${this.formatDate(d2.trim())}`;
      }
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  },

  /**
   * Debounce execution
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Export array of objects to CSV download
   */
  exportCSV(filename, columns, data) {
    if (!data || !data.length) {
      alert('No data available to export.');
      return;
    }

    const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => {
      return columns.map(col => {
        let val = row[col.key];
        if (col.format) val = col.format(val, row);
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${this.today()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Convert file to Base64 with MIME and size validation and high-fidelity scaling
   * Uses maxDimension 400px to guarantee ultra-crisp display while keeping base64 < 100KB (well below MySQL 1MB packet limit)
   */
  async logoToBase64(file, maxSizeMB = 5, maxDimension = 400) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected'));

      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        return reject(new Error('Only PNG, JPG, WEBP, and SVG formats are permitted.'));
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        return reject(new Error(`File size exceeds maximum limit of ${maxSizeMB}MB.`));
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // If SVG, return as is (keep vector scalability)
        if (file.type === 'image/svg+xml') {
          const base64Data = result.split(',')[1];
          if (base64Data.length > 500000) {
            return reject(new Error('SVG logo file is too large (> 500KB). Please optimize your SVG.'));
          }
          return resolve({
            base64: base64Data,
            dataUrl: result,
            mimeType: file.type,
            size: file.size
          });
        }

        // For raster images, always draw on canvas constrained to maxDimension (e.g. 400px)
        const img = new Image();
        img.onload = () => {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use PNG for transparency, or JPEG if input was JPEG
          const outMime = (file.type === 'image/jpeg') ? 'image/jpeg' : 'image/png';
          let dataUrl = canvas.toDataURL(outMime, 0.90);
          let base64Data = dataUrl.split(',')[1];

          // If still over 500KB, optimize to high quality JPEG
          if (base64Data.length > 500000 && outMime === 'image/png') {
            dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            base64Data = dataUrl.split(',')[1];
          }

          resolve({
            base64: base64Data,
            dataUrl,
            mimeType: outMime,
            size: Math.round((base64Data.length * 3) / 4)
          });
        };
        img.onerror = () => {
          const base64Data = result.split(',')[1];
          if (base64Data.length > 600000) {
            return reject(new Error('Image is too large. Please select an image under 500KB.'));
          }
          resolve({
            base64: base64Data,
            dataUrl: result,
            mimeType: file.type,
            size: file.size
          });
        };
        img.src = result;
      };
      reader.onerror = () => reject(new Error('Failed to read file contents.'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Render Company Logo or high-fidelity Initials fallback
   */
  renderCompanyLogo(element, company, fallbackText = 'HP') {
    if (!element) return;
    const b64 = company ? (company.LogoBase64 || company.logobase64) : null;
    const mime = company ? (company.LogoMimeType || company.logomimetype || 'image/png') : 'image/png';
    if (b64) {
      element.innerHTML = `<img src="data:${mime};base64,${b64}" alt="${company.CompanyName || 'Logo'}" class="company-logo-img" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    } else {
      element.innerHTML = `<img src="favicon.svg" alt="HP Gas" class="company-logo-img" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" onerror="this.outerHTML='<div class=\\'logo-fallback\\'>HP</div>'">`;
    }
  }
};
