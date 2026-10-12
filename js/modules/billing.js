/**
 * SHIV SHAKTI HP GAS - POS BILLING & NEW SV CONNECTION MODULE
 * Multi-Line Cart, Integer-Paise Balance Guard, Live Settlement Validation & Printing
 */

import { api } from '../api.js';
import { ui } from '../ui.js';
import { utils } from '../utils.js';
import { auth } from '../auth.js';
import { printEngine } from './print.js';

let availableItems = [];
let availableCustomers = [];
let cart = [];

export const billingModule = {
  activeMode: 'sale', // 'sale' | 'sv_package' | 'tv_out'

  async init() {
    this.renderContainer();
    await Promise.all([this.loadItems(), this.loadCustomers(), this.loadHawkers(), this.loadRecentBills()]);
    this.initCart();
  },

  renderContainer() {
    const root = document.getElementById('view-billing');
    if (!root) return;

    root.innerHTML = `
      <!-- POS Counter Billing Unified Screen -->
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <h2 style="font-size:18px; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:8px; margin:0;">
            <i class="fa-solid fa-cash-register" style="color:var(--primary);"></i> POS Counter Billing
          </h2>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="pos-quick-cust-btn" class="btn btn-outline btn-sm">
              <i class="fa-solid fa-user-plus"></i> Add Customer
            </button>
          </div>
        </div>

        <!-- Mode Navigation Tabs: Sale / SV Package / TV Out -->
        <div class="pos-billing-mode-tabs" style="display:flex; gap:8px; background:var(--bg-body); padding:6px; border-radius:var(--radius-md); border:1px solid var(--border);">
          <button type="button" class="btn btn-sm pos-mode-tab active" data-mode="sale" style="flex:1; padding:9px 12px; font-weight:700; border-radius:var(--radius-sm); font-size:13px; display:flex; align-items:center; justify-content:center; gap:8px;">
            <i class="fa-solid fa-cart-shopping"></i> 1. Regular Sale / Refill
          </button>
          <button type="button" class="btn btn-sm pos-mode-tab" data-mode="sv_package" style="flex:1; padding:9px 12px; font-weight:700; border-radius:var(--radius-sm); font-size:13px; display:flex; align-items:center; justify-content:center; gap:8px;">
            <i class="fa-solid fa-box-open"></i> 2. New SV Package Billing
          </button>
          <button type="button" class="btn btn-sm pos-mode-tab" data-mode="tv_out" style="flex:1; padding:9px 12px; font-weight:700; border-radius:var(--radius-sm); font-size:13px; display:flex; align-items:center; justify-content:center; gap:8px;">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> 3. TV Out Billing (Caution Money Return)
          </button>
        </div>
      </div>

      <!-- VIEW 1: REGULAR SALE & NEW SV PACKAGE BILLING VIEW -->
      <div id="pos-main-sale-view" class="pos-layout-grid">
        <!-- Left: Customer, Presets, Product Selector & Cart -->
        <div>
          <!-- Customer & Header Details Card -->
          <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:grid; grid-template-columns: 1.5fr 1.2fr 1fr; gap:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-user"></i> Customer Selection</label>
                  <select id="pos-customer-select" class="form-select">
                    <option value="">Counter Walk-in Customer</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-truck-ramp-box"></i> Delivery Hawker / Staff</label>
                  <select id="pos-hawker-select" class="form-select">
                    <option value="">-- Direct Counter (No Hawker) --</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-id-badge"></i> Cust Type</label>
                  <input list="pos-cust-types" id="pos-customer-type" class="form-control" value="DOMESTIC" placeholder="DOMESTIC / COMMERCIAL">
                  <datalist id="pos-cust-types">
                    <option value="DOMESTIC">
                    <option value="COMMERCIAL">
                    <option value="HAWKER DISPATCH">
                    <option value="HOME DELIVERY">
                    <option value="INSTITUTIONAL">
                    <option value="NFR">
                    <option value="WALK-IN">
                  </datalist>
                </div>
              </div>

              <!-- SV Specific Customer Fields (Visible only in New SV Package Mode) -->
              <div id="pos-sv-cust-fields" style="display:none; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; background:var(--bg-body); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:11px;">Customer Name *</label>
                  <input type="text" id="pos-sv-name" class="form-control" placeholder="Full Name">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:11px;">Mobile *</label>
                  <input type="tel" id="pos-sv-mobile" class="form-control" placeholder="10-digit mobile" maxlength="10">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:11px;">Village / Address</label>
                  <input type="text" id="pos-sv-addr" class="form-control" placeholder="Address">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label" style="font-size:11px;">Aadhaar Last 4 / Consumer No</label>
                  <input type="text" id="pos-sv-aadhaar" class="form-control" placeholder="Aadhaar / Cons #">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Billing Date</label>
                  <input type="date" id="pos-bill-date" class="form-control" value="${utils.today()}">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Discount (₹)</label>
                  <input type="number" id="pos-discount" class="form-control" value="0" min="0" step="any">
                </div>
              </div>
            </div>
          </div>

          <!-- SV Package Presets Bar (Visible in New SV Package Mode) -->
          <div id="pos-sv-presets-bar" style="display:none; padding:12px; border:1px solid #bae6fd; background:#f0f9ff; border-radius:var(--radius-md); margin-bottom:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-weight:700; font-size:13px; color:#0369a1;"><i class="fa-solid fa-boxes-packing"></i> Choose SV Package Preset:</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Loads package items directly into the cart below (rates and quantities remain editable)</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-sm sv-preset-btn active" data-preset="sbc_14" style="font-weight:700;">
                <i class="fa-solid fa-bottle-water"></i> 14.2 KG SBC (Single)
              </button>
              <button type="button" class="btn btn-outline btn-sm sv-preset-btn" data-preset="dbc_14" style="font-weight:700;">
                <i class="fa-solid fa-boxes-stacked"></i> 14.2 KG DBC (Double)
              </button>
              <button type="button" class="btn btn-outline btn-sm sv-preset-btn" data-preset="commercial_19" style="font-weight:700;">
                <i class="fa-solid fa-fire"></i> 19 KG Commercial
              </button>
              <button type="button" class="btn btn-outline btn-sm sv-preset-btn" data-preset="custom" style="font-weight:700; color:var(--text-muted);">
                <i class="fa-solid fa-rotate-left"></i> Clear / Custom
              </button>
            </div>
          </div>

          <!-- Product Line Selector with Editable Rate -->
          <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
              <div class="form-group" style="flex:2; min-width:180px;">
                <label class="form-label"><i class="fa-solid fa-cubes"></i> Select Product / Service Refill</label>
                <select id="pos-item-select" class="form-select">
                  <option value="">-- Choose Item --</option>
                </select>
              </div>
              <div class="form-group" style="width:120px;">
                <label class="form-label"><i class="fa-solid fa-tag"></i> Rate (₹) *</label>
                <input type="number" id="pos-item-rate" class="form-control num-font" step="any" placeholder="Rate">
              </div>
              <div class="form-group" style="width:85px;">
                <label class="form-label">Quantity</label>
                <input type="number" id="pos-item-qty" class="form-control" value="1" min="1" step="1">
              </div>
              <button id="pos-add-to-cart-btn" class="btn btn-primary" style="height:40px;">
                <i class="fa-solid fa-cart-plus"></i> Add Item
              </button>
            </div>
          </div>

          <!-- Cart Items Table -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Cart Items (<span id="pos-cart-count">0</span>)</div>
              <button id="pos-clear-cart-btn" class="btn btn-outline btn-sm" style="color:var(--color-danger);">
                <i class="fa-solid fa-trash"></i> Clear Cart
              </button>
            </div>

            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Category</th>
                    <th class="text-center" style="width:80px;">Qty</th>
                    <th class="text-right" style="width:115px;">Rate (₹)</th>
                    <th class="text-right" style="width:110px;">Total</th>
                    <th class="text-center" style="width:50px;">Action</th>
                  </tr>
                </thead>
                <tbody id="pos-cart-table-body">
                  <tr><td colspan="6" class="text-center" style="color:var(--text-muted); padding:24px;">Cart is empty. Select an item above to add.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right: Multi-Tender Settlement & Balance Guard -->
        <div>
          <div class="card" style="position:sticky; top:20px;">
            <div class="card-header">
              <div class="card-title"><i class="fa-solid fa-wallet"></i> Settlement Tender</div>
            </div>

            <div class="card-body" style="padding:18px 20px;">
              <!-- Bill Totals Summary -->
              <div style="background:var(--bg-body); border-radius:var(--radius-md); padding:14px; margin-bottom:16px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
                  <span>Subtotal:</span>
                  <span id="pos-summary-subtotal" class="num-font">₹0.00</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
                  <span>GST Tax:</span>
                  <span id="pos-summary-tax" class="num-font">₹0.00</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
                  <span>Discount:</span>
                  <span id="pos-summary-discount" class="num-font">₹0.00</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:800; font-size:18px; border-top:1px dashed var(--border); padding-top:8px;">
                  <span>Net Total:</span>
                  <span id="pos-summary-net" class="num-font" style="color:var(--primary);">₹0.00</span>
                </div>
              </div>

              <!-- Payment Inputs -->
              <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                <div class="form-group">
                  <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span><i class="fa-solid fa-money-bill-1-wave" style="color:var(--color-success);"></i> Cash Tender</span>
                    <a href="#" id="pos-auto-cash-btn" style="font-size:11px; color:var(--primary);">Fill All</a>
                  </label>
                  <input type="number" id="pos-pay-cash" class="form-control num-font" value="0" min="0" step="any">
                </div>

                <div class="form-group">
                  <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span><i class="fa-solid fa-qrcode" style="color:var(--color-info);"></i> UPI / QR</span>
                    <a href="#" id="pos-auto-upi-btn" style="font-size:11px; color:var(--primary);">Fill All</a>
                  </label>
                  <input type="number" id="pos-pay-upi" class="form-control num-font" value="0" min="0" step="any">
                </div>

                <div class="form-group">
                  <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid fa-gas-pump" style="color:#e94560;"></i> HP Pay</span>
                    <a href="#" id="pos-calc-hppay-btn" style="font-size:11px; color:var(--primary); text-decoration:none;"><i class="fa-solid fa-calculator"></i> Calc by Count</a>
                  </label>
                  <input type="number" id="pos-pay-hppay" class="form-control num-font" value="0" min="0" step="any">
                  <div id="pos-hppay-calc-box" style="display:none; margin-top:6px; padding:8px 10px; background:rgba(233,69,96,0.06); border-radius:6px; border:1px solid rgba(233,69,96,0.2); font-size:11.5px;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                      <span>Count:</span>
                      <input type="number" id="pos-hppay-count-input" class="form-control num-font" style="width:55px; height:26px; padding:2px 6px; font-size:12px;" min="0" value="0">
                      <span>=</span>
                      <span id="pos-hppay-calc-preview" style="font-weight:700; color:#e94560;">₹0.00</span>
                      <button type="button" id="pos-hppay-apply-btn" class="btn btn-primary" style="padding:2px 8px; font-size:11px; height:26px; margin-left:auto;">Apply</button>
                    </div>
                    <!-- Dynamic HPCL 6-Digit Consumer Numbers Grid -->
                    <div id="pos-hppay-cno-box" style="display:none; border-top:1px dashed rgba(233,69,96,0.25); padding-top:6px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-weight:700; color:#b91c1c; font-size:11px;"><i class="fa-solid fa-users"></i> Consumer Nos (6-Digit):</span>
                        <span id="pos-hppay-cno-badge" class="badge" style="background:#e94560; color:#fff; font-size:10px;">0 / 0</span>
                      </div>
                      <div id="pos-hppay-cno-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:6px; max-height:140px; overflow-y:auto; padding:2px;"></div>
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="display:flex; justify-content:space-between;">
                    <span><i class="fa-solid fa-hand-holding-dollar" style="color:var(--color-warning);"></i> Credit Dues</span>
                    <span style="font-size:11px; color:var(--text-muted);">Requires Customer</span>
                  </label>
                  <input type="number" id="pos-pay-dues" class="form-control num-font" value="0" min="0" step="any">
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <span><i class="fa-solid fa-building-columns"></i> Bank / Cheque / RTGS</span>
                  </label>
                  <input type="number" id="pos-pay-bank" class="form-control num-font" value="0" min="0" step="any">
                </div>
              </div>

              <!-- Balance Guard Banner -->
              <div id="pos-balance-guard" style="padding:10px; border-radius:var(--radius-sm); font-size:12px; font-weight:700; text-align:center; margin-bottom:16px; background:var(--color-success-bg); color:var(--color-success);">
                Settlement Balanced (₹0.00 difference)
              </div>

              <!-- Action Button -->
              <button id="pos-generate-bill-btn" class="btn btn-primary" style="width:100%; height:44px; font-size:15px; margin-bottom:8px;">
                <i class="fa-solid fa-file-invoice-dollar"></i> Generate & Save Bill
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW 2: TV OUT (TERMINATION & CAUTION MONEY REFUND) INLINE BILLING VIEW -->
      <div id="pos-main-tvout-view" class="pos-layout-grid" style="display:none;">
        <!-- Left: Consumer Details, Equipment Returned, Security Deposit, Deductions -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- Card 1: Consumer & Surrender Details -->
          <div class="card">
            <div class="card-header">
              <div class="card-title" style="color:#d97706;"><i class="fa-solid fa-user-xmark"></i> Consumer & Connection Details</div>
            </div>
            <div class="card-body">
              <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-search"></i> Select Existing Customer</label>
                  <select id="tv-cust-select" class="form-select">
                    <option value="">-- Choose Existing Consumer --</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-hashtag"></i> Consumer Number *</label>
                  <input type="text" id="tv-cust-consumerno" class="form-control" placeholder="e.g. 123456" required>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1.5fr 1fr 1fr; gap:12px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-user"></i> Full Consumer Name *</label>
                  <input type="text" id="tv-cust-name" class="form-control" placeholder="Consumer Name" required>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-phone"></i> Mobile *</label>
                  <input type="tel" id="tv-cust-mobile" class="form-control" placeholder="10-digit mobile" maxlength="10" required>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-id-badge"></i> Cust Type</label>
                  <input list="pos-cust-types" id="tv-cust-type" class="form-control" value="DOMESTIC">
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Equipment Returned & SV Tariff Era -->
          <div class="card">
            <div class="card-header">
              <div class="card-title" style="color:var(--primary);"><i class="fa-solid fa-boxes-packing"></i> Equipment Returned & Original SV Era</div>
            </div>
            <div class="card-body">
              <div style="display:grid; grid-template-columns: 1.2fr 2fr; gap:12px; margin-bottom:14px; align-items:center;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-fire"></i> Cylinder Variant</label>
                  <select id="tv-cyl-type" class="form-select">
                    <option value="14.2 KG Domestic" selected>14.2 KG Domestic</option>
                    <option value="19 KG Commercial">19 KG Commercial</option>
                    <option value="5 KG Domestic">5 KG Domestic</option>
                    <option value="47.5 KG Commercial">47.5 KG Commercial</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-clock-rotate-left"></i> Original SV Tariff Era Preset</label>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline btn-sm tv-era-btn active" data-era="standard" style="font-size:11.5px; font-weight:700;">
                      Current Standard (₹1,450 + ₹250)
                    </button>
                    <button type="button" class="btn btn-outline btn-sm tv-era-btn" data-era="vintage" style="font-size:11.5px; font-weight:700;">
                      Vintage Pre-2015 (₹900 + ₹100)
                    </button>
                    <button type="button" class="btn btn-outline btn-sm tv-era-btn" data-era="commercial" style="font-size:11.5px; font-weight:700;">
                      19 KG (₹3,500 + ₹250)
                    </button>
                  </div>
                </div>
              </div>

              <!-- Checkboxes for Equipment Returned -->
              <div style="display:grid; grid-template-columns: 1.5fr 1.2fr 1.2fr; gap:12px; background:var(--bg-body); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border); align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" id="tv-chk-cyl" checked style="width:18px; height:18px; accent-color:#16a34a;">
                  <label for="tv-chk-cyl" style="margin:0; font-weight:700; font-size:12.5px;">Cylinder Returned</label>
                  <input type="number" id="tv-qty-cyl" class="form-control text-center" value="1" min="1" max="10" style="width:54px; height:30px; display:inline-block; font-weight:700;">
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" id="tv-chk-reg" checked style="width:18px; height:18px; accent-color:#16a34a;">
                  <label for="tv-chk-reg" style="margin:0; font-weight:700; font-size:12.5px;">Regulator Returned</label>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" id="tv-chk-passbook" checked style="width:18px; height:18px; accent-color:#16a34a;">
                  <label for="tv-chk-passbook" style="margin:0; font-weight:700; font-size:12.5px;">Passbook Surrendered</label>
                </div>
              </div>
              <div style="font-size:11px; color:#16a34a; margin-top:6px; font-weight:600;">
                <i class="fa-solid fa-circle-check"></i> Cylinder return automatically adds +1 Empty Cylinder to Godown inventory stock.
              </div>
            </div>
          </div>

          <!-- Card 3 & 4: Security Deposit Held & Itemized Deductions -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <!-- Card 3: Security Deposit Held -->
            <div class="card" style="border:1px solid #bfdbfe; background:#f0f9ff;">
              <div class="card-header" style="background:#e0f2fe; padding:10px 14px;">
                <div class="card-title" style="font-size:13px; color:#0369a1;"><i class="fa-solid fa-shield-halved"></i> Security Deposit Held (₹)</div>
              </div>
              <div class="card-body" style="padding:14px;">
                <div class="form-group" style="margin-bottom:8px;">
                  <label class="form-label" style="font-size:11.5px;">Cylinder Deposit Rate (₹)</label>
                  <input type="number" id="tv-cyl-deposit" class="form-control num-font" value="1450.00" min="0" step="any">
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                  <label class="form-label" style="font-size:11.5px;">Regulator Deposit (₹)</label>
                  <input type="number" id="tv-reg-deposit" class="form-control num-font" value="250.00" min="0" step="any">
                </div>
                <div class="form-group" style="margin-bottom:0; border-top:1px dashed #bae6fd; padding-top:8px;">
                  <label class="form-label" style="font-size:12px; font-weight:800; color:#0369a1;">Total Security Held (₹)</label>
                  <input type="number" id="tv-sec-total" class="form-control num-font" value="1700.00" readonly style="font-weight:800; background:#fff; color:#0369a1;">
                </div>
              </div>
            </div>

            <!-- Card 4: Deductions Cut From Security -->
            <div class="card" style="border:1px solid #fecaca; background:#fff5f5;">
              <div class="card-header" style="background:#fee2e2; padding:10px 14px;">
                <div class="card-title" style="font-size:13px; color:#b91c1c;"><i class="fa-solid fa-scissors"></i> Deductions Cut From Security (₹)</div>
              </div>
              <div class="card-body" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
                <div>
                  <label class="form-label" style="font-size:11.5px; color:#b91c1c; margin-bottom:4px;">TV Out Charge (₹) *</label>
                  <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:8px;">
                    <select id="tv-item-tvout" class="form-select form-select-sm" style="font-size:12px;">
                      <option value="" data-rate="100.00">Standard TV Out (₹100)</option>
                    </select>
                    <input type="number" id="tv-charge-tvout" class="form-control num-font" value="100.00" min="0" step="any" placeholder="Rate">
                  </div>
                </div>

                <div>
                  <label class="form-label" style="font-size:11.5px; color:#b91c1c; margin-bottom:4px;">Administration Charge (₹) *</label>
                  <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:8px;">
                    <select id="tv-item-admin" class="form-select form-select-sm" style="font-size:12px;">
                      <option value="" data-rate="100.00">Standard Admin Fee (₹100)</option>
                    </select>
                    <input type="number" id="tv-charge-admin" class="form-control num-font" value="100.00" min="0" step="any" placeholder="Rate">
                  </div>
                </div>

                <div>
                  <label class="form-label" style="font-size:11.5px; color:#b91c1c; margin-bottom:4px;">Imprest Fund / Custom Deduction (₹)</label>
                  <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:8px;">
                    <select id="tv-item-imprest" class="form-select form-select-sm" style="font-size:12px;">
                      <option value="" data-rate="0.00">-- Select Fund / Item (₹0) --</option>
                    </select>
                    <input type="number" id="tv-charge-imprest" class="form-control num-font" value="0.00" min="0" step="any" placeholder="Amount">
                  </div>
                </div>

                <!-- Extra Dynamic Deductions List -->
                <div id="tv-extra-deductions-list" style="display:flex; flex-direction:column; gap:8px;"></div>

                <div style="margin-top:2px;">
                  <button type="button" id="tv-add-deduction-btn" class="btn btn-outline btn-xs" style="color:#b91c1c; border-color:#fca5a5; font-size:11.5px; font-weight:700;">
                    <i class="fa-solid fa-plus"></i> Add Extra Deduction / Product Fee
                  </button>
                </div>

                <div class="form-group" style="margin-bottom:0; border-top:1px dashed #fecaca; padding-top:8px;">
                  <label class="form-label" style="font-size:12px; font-weight:800; color:#b91c1c;">Total Deductions Cut (₹)</label>
                  <input type="number" id="tv-deduction-total" class="form-control num-font" value="200.00" readonly style="font-weight:800; background:#fff; color:#b91c1c;">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: TV Out Settlement & Cash Refund Payout -->
        <div>
          <div class="card" style="position:sticky; top:20px; border:2px solid #86efac; background:#f0fdf4;">
            <div class="card-header" style="background:#dcfce7;">
              <div class="card-title" style="color:#15803d;"><i class="fa-solid fa-hand-holding-dollar"></i> Net Refund Payout</div>
            </div>

            <div class="card-body" style="padding:18px 20px;">
              <!-- Large Highlight Display: Net Cash Returned -->
              <div style="background:#dcfce7; border:2px solid #86efac; border-radius:var(--radius-md); padding:16px; text-align:center; margin-bottom:18px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#15803d; letter-spacing:0.5px;">Net Cash Returned to Customer</div>
                <div style="font-size:11px; color:#166534; margin-top:2px;">(Total Security Deposit − Total Deductions)</div>
                <div id="tv-net-refund-display" class="num-font" style="font-size:28px; font-weight:900; color:#15803d; margin-top:8px;">
                  ₹1,500.00
                </div>
                <input type="hidden" id="tv-net-refund-val" value="1500.00">
              </div>

              <!-- Payout Form Fields -->
              <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:18px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-money-bill-transfer"></i> Payout Payment Mode</label>
                  <select id="tv-pay-mode" class="form-select">
                    <option value="CASH" selected>CASH (Paid from Daily Counter Till)</option>
                    <option value="UPI">UPI / Digital Transfer</option>
                    <option value="BANK">BANK / NEFT / Cheque</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-calendar-day"></i> Voucher Date</label>
                  <input type="date" id="tv-bill-date" class="form-control" value="${utils.today()}">
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-receipt"></i> Reference / Cheque No</label>
                  <input type="text" id="tv-ref-no" class="form-control" placeholder="Optional reference">
                </div>

                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label"><i class="fa-solid fa-note-sticky"></i> Remarks / Reason</label>
                  <input type="text" id="tv-reason" class="form-control" value="TV Out Connection Surrender & Caution Money Refund">
                </div>
              </div>

              <!-- Save TV Out Button -->
              <button id="pos-save-tvout-btn" class="btn btn-warning" style="width:100%; height:46px; font-size:15px; font-weight:800; background:#d97706; border-color:#d97706; color:#fff; box-shadow:0 2px 6px rgba(217,119,6,0.3);">
                <i class="fa-solid fa-arrow-right-from-bracket"></i> Save & Issue TV Out Voucher
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Bills Log Table (Common to all views) -->
      <div class="card" style="margin-top:24px;">
        <div class="card-header">
          <div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Today's Bills Register</div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="pos-search-bill" class="form-control" placeholder="Search bill no or customer..." style="width:240px; height:34px; font-size:12px;">
            <button id="pos-reload-bills-btn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrows-rotate"></i></button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Date</th>
                <th>Customer</th>
                <th class="text-right">Total Amount</th>
                <th>Payment Modes</th>
                <th class="text-center">Status</th>
                <th class="text-center">Print / Actions</th>
              </tr>
            </thead>
            <tbody id="pos-recent-bills-body">
              <tr><td colspan="7" class="text-center" style="color:var(--text-muted); padding:20px;">Loading bills...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  setMode(mode) {
    this.activeMode = mode;
    document.querySelectorAll('.pos-mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });

    const saleView = document.getElementById('pos-main-sale-view');
    const tvoutView = document.getElementById('pos-main-tvout-view');
    const svPresetsBar = document.getElementById('pos-sv-presets-bar');
    const svCustFields = document.getElementById('pos-sv-cust-fields');
    const genBillBtn = document.getElementById('pos-generate-bill-btn');

    if (mode === 'tv_out') {
      if (saleView) saleView.style.display = 'none';
      if (tvoutView) tvoutView.style.display = 'grid';
      this.calcTvOut();
    } else {
      if (saleView) saleView.style.display = 'grid';
      if (tvoutView) tvoutView.style.display = 'none';

      if (mode === 'sv_package') {
        if (svPresetsBar) svPresetsBar.style.display = 'flex';
        if (svCustFields) svCustFields.style.display = 'grid';
        if (genBillBtn) {
          genBillBtn.innerHTML = '<i class="fa-solid fa-box-open"></i> Issue New SV Connection & Bill';
          genBillBtn.className = 'btn btn-info';
          genBillBtn.style.background = '#0284c7';
          genBillBtn.style.borderColor = '#0284c7';
          genBillBtn.style.color = '#fff';
        }
        if (!cart.length || (cart.length === 1 && cart[0].Category === 'SALE')) {
          this.loadSVPackagePreset('sbc_14');
        }
      } else {
        // Regular sale
        if (svPresetsBar) svPresetsBar.style.display = 'none';
        if (svCustFields) svCustFields.style.display = 'none';
        if (genBillBtn) {
          genBillBtn.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i> Generate & Save Bill';
          genBillBtn.className = 'btn btn-primary';
          genBillBtn.style.background = '';
          genBillBtn.style.borderColor = '';
          genBillBtn.style.color = '';
        }
      }
    }
  },

  loadSVPackagePreset(presetKey) {
    document.querySelectorAll('.sv-preset-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.preset === presetKey);
    });

    if (presetKey === 'custom') {
      cart = [];
      this.renderCart();
      return;
    }

    const templates = {
      sbc_14: [
        { name: '14.2 KG Domestic Cylinder Security Deposit', cat: 'SECURITY_DEPOSIT', cyl: '14.2 KG Domestic', qty: 1, rate: 2200 },
        { name: 'LPG Pressure Regulator Security Deposit', cat: 'SECURITY_DEPOSIT', cyl: '14.2 KG Domestic', qty: 1, rate: 250 },
        { name: 'Suraksha LPG Hose Pipe (1.5M)', cat: 'EQUIPMENT', cyl: '14.2 KG Domestic', qty: 1, rate: 190 },
        { name: 'Domestic Gas Consumer Card (DGCC Blue Book)', cat: 'SERVICE', cyl: '14.2 KG Domestic', qty: 1, rate: 59 },
        { name: '14.2 KG Domestic Refill (First Cylinder Gas)', cat: 'CYLINDER', cyl: '14.2 KG Domestic', qty: 1, rate: 1042 }
      ],
      dbc_14: [
        { name: '14.2 KG Domestic Cylinder Security Deposit', cat: 'SECURITY_DEPOSIT', cyl: '14.2 KG Domestic', qty: 2, rate: 2200 },
        { name: 'LPG Pressure Regulator Security Deposit', cat: 'SECURITY_DEPOSIT', cyl: '14.2 KG Domestic', qty: 1, rate: 250 },
        { name: 'Suraksha LPG Hose Pipe (1.5M)', cat: 'EQUIPMENT', cyl: '14.2 KG Domestic', qty: 1, rate: 190 },
        { name: 'Domestic Gas Consumer Card (DGCC Blue Book)', cat: 'SERVICE', cyl: '14.2 KG Domestic', qty: 1, rate: 59 },
        { name: '14.2 KG Domestic Refill (First Cylinder Gas)', cat: 'CYLINDER', cyl: '14.2 KG Domestic', qty: 1, rate: 1042 }
      ],
      commercial_19: [
        { name: '19 KG Commercial Cylinder Security Deposit', cat: 'SECURITY_DEPOSIT', cyl: '19 KG Commercial', qty: 1, rate: 3500 },
        { name: 'Commercial High Pressure / LOT Regulator', cat: 'EQUIPMENT', cyl: '19 KG Commercial', qty: 1, rate: 450 },
        { name: '19 KG Commercial Refill (First Gas)', cat: 'CYLINDER', cyl: '19 KG Commercial', qty: 1, rate: 1850 }
      ]
    };

    const tItems = templates[presetKey];
    if (!tItems) return;

    cart = tItems.map(ti => {
      const match = availableItems.find(ai => ai.ItemName && ai.ItemName.toLowerCase().includes(ti.name.toLowerCase().slice(0, 10)));
      return {
        ItemID: match ? match.ItemID : null,
        ItemName: ti.name,
        Category: ti.cat,
        CylinderType: ti.cyl,
        Quantity: ti.qty,
        Rate: ti.rate,
        RatePaise: utils.toPaise(ti.rate),
        TaxPercent: 0,
        Total: ti.qty * ti.rate
      };
    });

    this.renderCart();
  },

  setTvOutEra(eraKey) {
    document.querySelectorAll('.tv-era-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.era === eraKey);
    });

    const cylDep = document.getElementById('tv-cyl-deposit');
    const regDep = document.getElementById('tv-reg-deposit');
    const cylType = document.getElementById('tv-cyl-type');

    if (eraKey === 'standard') {
      if (cylDep) cylDep.value = '1450.00';
      if (regDep) regDep.value = '250.00';
      if (cylType) cylType.value = '14.2 KG Domestic';
    } else if (eraKey === 'vintage') {
      if (cylDep) cylDep.value = '900.00';
      if (regDep) regDep.value = '100.00';
      if (cylType) cylType.value = '14.2 KG Domestic';
    } else if (eraKey === 'commercial') {
      if (cylDep) cylDep.value = '3500.00';
      if (regDep) regDep.value = '250.00';
      if (cylType) cylType.value = '19 KG Commercial';
    }
    this.calcTvOut();
  },

  calcTvOut() {
    const cDep = parseFloat(document.getElementById('tv-cyl-deposit')?.value) || 0;
    const rDep = parseFloat(document.getElementById('tv-reg-deposit')?.value) || 0;
    const isCyl = document.getElementById('tv-chk-cyl')?.checked;
    const isReg = document.getElementById('tv-chk-reg')?.checked;
    const cQty = isCyl ? (parseInt(document.getElementById('tv-qty-cyl')?.value) || 1) : 0;
    const rQty = isReg ? 1 : 0;

    const totalSec = (cDep * cQty) + (rDep * rQty);
    const secEl = document.getElementById('tv-sec-total');
    if (secEl) secEl.value = totalSec.toFixed(2);

    const tvOut = Math.max(0, parseFloat(document.getElementById('tv-charge-tvout')?.value) || 0);
    const admin = Math.max(0, parseFloat(document.getElementById('tv-charge-admin')?.value) || 0);
    const imprest = Math.max(0, parseFloat(document.getElementById('tv-charge-imprest')?.value) || 0);
    let extraDed = 0;
    document.querySelectorAll('.tv-extra-ded-rate').forEach(inp => {
      extraDed += Math.max(0, parseFloat(inp.value) || 0);
    });
    const totalDed = tvOut + admin + imprest + extraDed;

    const dedEl = document.getElementById('tv-deduction-total');
    if (dedEl) dedEl.value = totalDed.toFixed(2);

    const netRefund = Math.max(0, totalSec - totalDed);
    const netDisp = document.getElementById('tv-net-refund-display');
    const netVal = document.getElementById('tv-net-refund-val');

    if (netDisp) netDisp.textContent = utils.formatCurrency(netRefund);
    if (netVal) netVal.value = netRefund.toFixed(2);
  },

  addExtraDeductionRow() {
    const container = document.getElementById('tv-extra-deductions-list');
    if (!container) return;

    const itemOptions = availableItems.map(it => `
      <option value="${it.ItemID}" data-rate="${it.Rate}" data-name="${utils.escapeHtml(it.ItemName)}">
        ${utils.escapeHtml(it.ItemName)} (${utils.formatCurrency(it.Rate)})
      </option>
    `).join('');

    const row = document.createElement('div');
    row.className = 'tv-extra-ded-row';
    row.style = 'display:grid; grid-template-columns: 1.4fr 1fr 28px; gap:8px; align-items:center;';
    row.innerHTML = `
      <select class="form-select form-select-sm tv-extra-ded-item" style="font-size:12px;">
        <option value="" data-rate="0">-- Select Product / Fee --</option>
        ${itemOptions}
      </select>
      <input type="number" class="form-control form-control-sm num-font tv-extra-ded-rate" value="0.00" min="0" step="any" placeholder="Rate">
      <button type="button" class="btn btn-outline btn-xs tv-extra-ded-remove" style="color:var(--color-danger); border:none; height:28px; width:28px; padding:0; display:flex; align-items:center; justify-content:center;" title="Remove Fee">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    const sel = row.querySelector('.tv-extra-ded-item');
    const rateIn = row.querySelector('.tv-extra-ded-rate');
    const remBtn = row.querySelector('.tv-extra-ded-remove');

    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      if (opt && opt.dataset.rate !== undefined) {
        rateIn.value = parseFloat(opt.dataset.rate).toFixed(2);
        this.calcTvOut();
      }
    });

    rateIn.addEventListener('input', () => this.calcTvOut());

    remBtn.addEventListener('click', () => {
      row.remove();
      this.calcTvOut();
    });

    container.appendChild(row);
  },

  bindEvents() {
    // Mode Switcher Tabs
    document.querySelectorAll('.pos-mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.setMode(mode);
      });
    });

    // SV Presets Toolbar
    document.querySelectorAll('.sv-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.currentTarget.dataset.preset;
        this.loadSVPackagePreset(preset);
      });
    });

    // TV Out Era Presets
    document.querySelectorAll('.tv-era-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const era = e.currentTarget.dataset.era;
        this.setTvOutEra(era);
      });
    });

    // TV Out Live Calculations
    ['tv-cyl-deposit', 'tv-reg-deposit', 'tv-charge-tvout', 'tv-charge-admin', 'tv-charge-imprest', 'tv-qty-cyl'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.calcTvOut());
    });
    ['tv-chk-cyl', 'tv-chk-reg'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.calcTvOut());
    });

    // TV Out deduction product selection auto-fill
    [
      { sel: 'tv-item-tvout', inp: 'tv-charge-tvout' },
      { sel: 'tv-item-admin', inp: 'tv-charge-admin' },
      { sel: 'tv-item-imprest', inp: 'tv-charge-imprest' }
    ].forEach(({ sel, inp }) => {
      document.getElementById(sel)?.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        const rateIn = document.getElementById(inp);
        if (opt && rateIn) {
          const rate = opt.dataset.rate !== undefined ? parseFloat(opt.dataset.rate) : 0;
          if (!isNaN(rate)) {
            rateIn.value = rate.toFixed(2);
            this.calcTvOut();
          }
        }
      });
    });

    // TV Out Customer Select Auto-fill
    document.getElementById('tv-cust-select')?.addEventListener('change', (e) => {
      const sel = e.target;
      const opt = sel.options[sel.selectedIndex];
      if (opt && opt.value) {
        const nameIn = document.getElementById('tv-cust-name');
        const mobIn = document.getElementById('tv-cust-mobile');
        const consIn = document.getElementById('tv-cust-consumerno');
        const typeIn = document.getElementById('tv-cust-type');
        if (nameIn) nameIn.value = opt.dataset.name || '';
        if (mobIn) mobIn.value = opt.dataset.mob || '';
        if (consIn) consIn.value = opt.dataset.cons || '';
        if (typeIn && opt.dataset.type) typeIn.value = opt.dataset.type;
      }
    });

    // Add Extra Deduction Line
    document.getElementById('tv-add-deduction-btn')?.addEventListener('click', () => this.addExtraDeductionRow());

    // Save TV Out Voucher Button
    document.getElementById('pos-save-tvout-btn')?.addEventListener('click', () => this.generateTvOutBill());

    // Add to cart
    document.getElementById('pos-add-to-cart-btn')?.addEventListener('click', () => this.addItemToCart());

    // Clear cart
    document.getElementById('pos-clear-cart-btn')?.addEventListener('click', () => {
      cart = [];
      this.renderCart();
    });

    // Discount & Payments live updates
    const paymentInputs = ['pos-discount', 'pos-pay-cash', 'pos-pay-upi', 'pos-pay-hppay', 'pos-pay-dues', 'pos-pay-bank'];
    paymentInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateTotalsAndGuard());
    });

    // Auto fill buttons
    document.getElementById('pos-auto-cash-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.autoFillPayment('pos-pay-cash');
    });

    document.getElementById('pos-auto-upi-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.autoFillPayment('pos-pay-upi');
    });

    // Generate Bill
    document.getElementById('pos-generate-bill-btn')?.addEventListener('click', () => this.generateBill());

    // Quick Add Customer
    document.getElementById('pos-quick-cust-btn')?.addEventListener('click', () => this.openQuickCustomerModal());

    // Delivery Hawker selection auto-updates Customer Type
    document.getElementById('pos-hawker-select')?.addEventListener('change', (e) => {
      const typeIn = document.getElementById('pos-customer-type');
      if (e.target.value && typeIn && (typeIn.value === 'DOMESTIC' || !typeIn.value)) {
        typeIn.value = 'HAWKER DISPATCH';
      }
    });

    // HP Pay By-Count Calculator
    const calcHpBtn = document.getElementById('pos-calc-hppay-btn');
    const calcHpBox = document.getElementById('pos-hppay-calc-box');
    const hpCountIn = document.getElementById('pos-hppay-count-input');
    const hpPreview = document.getElementById('pos-hppay-calc-preview');
    const hpApplyBtn = document.getElementById('pos-hppay-apply-btn');
    const hpPayInput = document.getElementById('pos-pay-hppay');

    const renderHpCnoInputs = (count) => {
      const box = document.getElementById('pos-hppay-cno-box');
      const grid = document.getElementById('pos-hppay-cno-grid');
      const badge = document.getElementById('pos-hppay-cno-badge');
      if (!box || !grid) return;

      if (count <= 0) {
        box.style.display = 'none';
        grid.innerHTML = '';
        return;
      }

      box.style.display = 'block';
      const existingVals = Array.from(grid.querySelectorAll('.pos-hp-cno-input')).map(i => i.value.trim());

      let html = '';
      for (let i = 0; i < count; i++) {
        const val = existingVals[i] || '';
        html += `
          <div>
            <label style="font-size:10px; color:#b91c1c; font-weight:700; margin-bottom:1px; display:block;">Cons #${i + 1}:</label>
            <input type="text" class="form-control form-control-sm pos-hp-cno-input" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="e.g. 201452" value="${val}" style="font-family:monospace; font-weight:700; text-align:center; height:26px; font-size:11.5px; padding:2px 4px;">
          </div>
        `;
      }
      grid.innerHTML = html;

      const updateBadge = () => {
        const filled = Array.from(grid.querySelectorAll('.pos-hp-cno-input')).filter(i => i.value.trim().length === 6).length;
        if (badge) {
          badge.textContent = `${filled} / ${count}`;
          badge.style.background = (filled === count) ? '#16a34a' : '#e94560';
        }
      };

      grid.querySelectorAll('.pos-hp-cno-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
          updateBadge();
        });
      });
      updateBadge();
    };

    const updateHpPreview = () => {
      const count = parseInt(hpCountIn?.value) || 0;
      let cylRate = 1042.00;
      const saleItem = cart.find(it => it.Category === 'SALE' || (it.CylinderType && it.CylinderType.includes('14.2')));
      if (saleItem && saleItem.Rate) {
        cylRate = saleItem.Rate;
      }
      const amt = count * cylRate;
      if (hpPreview) hpPreview.textContent = utils.formatCurrency(amt);
      renderHpCnoInputs(count);
      return amt;
    };

    if (calcHpBtn && calcHpBox) {
      calcHpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = calcHpBox.style.display === 'none';
        calcHpBox.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          updateHpPreview();
          if (hpCountIn) hpCountIn.focus();
        }
      });
    }

    if (hpCountIn) {
      hpCountIn.addEventListener('input', updateHpPreview);
    }

    if (hpApplyBtn) {
      hpApplyBtn.addEventListener('click', () => {
        const amt = updateHpPreview();
        if (hpPayInput) {
          hpPayInput.value = amt.toFixed(2);
          this.updateTotalsAndGuard();
        }
        if (calcHpBox) calcHpBox.style.display = 'none';
        ui.info('HP Pay amount ' + utils.formatCurrency(amt) + ' applied.');
      });
    }

    // Customer selection auto-fills Customer Type (CustType)
    document.getElementById('pos-customer-select')?.addEventListener('change', (e) => {
      const sel = e.target;
      const opt = sel.options[sel.selectedIndex];
      const typeIn = document.getElementById('pos-customer-type');
      if (opt && opt.dataset.type && typeIn) {
        typeIn.value = opt.dataset.type;
      }
    });

    // Item selection auto-fills Rate input field
    document.getElementById('pos-item-select')?.addEventListener('change', (e) => {
      const itemId = parseInt(e.target.value);
      const it = availableItems.find(i => i.ItemID === itemId);
      const rateIn = document.getElementById('pos-item-rate');
      if (it && rateIn) {
        rateIn.value = Number(it.Rate).toFixed(2);
      }
    });

    // Reload Bills
    document.getElementById('pos-reload-bills-btn')?.addEventListener('click', () => this.loadRecentBills());

    // Filter Bills
    document.getElementById('pos-search-bill')?.addEventListener('input', utils.debounce((e) => {
      this.loadRecentBills(e.target.value);
    }, 300));
  },

  async loadItems() {
    const res = await api('listItems', { status: 'active' }, { loader: false });
    if (res.ok && res.data) {
      availableItems = res.data;
      const select = document.getElementById('pos-item-select');
      if (select) {
        select.innerHTML = '<option value="">-- Choose Item --</option>' +
          availableItems.map(it => `
            <option value="${it.ItemID}" data-rate="${it.Rate}" data-tax="${it.TaxPercent || 0}" data-cat="${it.Category}" data-cyl="${it.CylinderType || ''}">
              ${utils.escapeHtml(it.ItemName)} (${utils.formatCurrency(it.Rate)})
            </option>
          `).join('');
      }

      // Populate TV Out deduction item selectors
      const tvOutSel = document.getElementById('tv-item-tvout');
      const adminSel = document.getElementById('tv-item-admin');
      const imprestSel = document.getElementById('tv-item-imprest');

      const itemOptions = availableItems.map(it => `
        <option value="${it.ItemID}" data-rate="${it.Rate}">
          ${utils.escapeHtml(it.ItemName)} (${utils.formatCurrency(it.Rate)})
        </option>
      `).join('');

      if (tvOutSel) {
        tvOutSel.innerHTML = '<option value="" data-rate="100.00">Standard TV Out (₹100)</option>' + itemOptions;
      }
      if (adminSel) {
        adminSel.innerHTML = '<option value="" data-rate="100.00">Standard Admin Fee (₹100)</option>' + itemOptions;
        // Auto-match if user has an item like "Administrator"
        const adminItem = availableItems.find(it => it.ItemName.toLowerCase().includes('admin'));
        if (adminItem) {
          adminSel.value = adminItem.ItemID;
          const adminRateInput = document.getElementById('tv-charge-admin');
          if (adminRateInput) adminRateInput.value = Number(adminItem.Rate).toFixed(2);
        }
      }
      if (imprestSel) {
        imprestSel.innerHTML = '<option value="" data-rate="0.00">-- Select Fund / Item (₹0) --</option>' + itemOptions;
        // Auto-match if user has an item like "IMPRESS FUND"
        const imprestItem = availableItems.find(it => it.ItemName.toLowerCase().includes('impress') || it.ItemName.toLowerCase().includes('imprest'));
        if (imprestItem) {
          imprestSel.value = imprestItem.ItemID;
          const imprestRateInput = document.getElementById('tv-charge-imprest');
          if (imprestRateInput && Number(imprestItem.Rate) > 0) imprestRateInput.value = Number(imprestItem.Rate).toFixed(2);
        }
      }
      this.calcTvOut();
    }
  },

    async loadHawkers() {
    try {
      const res = await api('listEmployees', { status: 'active' }, { loader: false });
      if (res.ok && res.data) {
        const select = document.getElementById('pos-hawker-select');
        if (select) {
          const opts = res.data.map(h => `
            <option value="${h.EmpID}" data-name="${utils.escapeHtml(h.Name)}">
              ${utils.escapeHtml(h.Name)} (${utils.escapeHtml(h.Role || 'Staff')})
            </option>
          `).join('');
          select.innerHTML = '<option value="">-- Direct Counter (No Hawker) --</option>' + opts;
        }
      }
    } catch (e) {
      console.warn('Failed to load hawkers:', e);
    }
  },

async loadCustomers() {
    const res = await api('listCustomers', { status: 'active' }, { loader: false });
    if (res.ok && res.data) {
      availableCustomers = res.data;
      const select = document.getElementById('pos-customer-select');
      const tvSelect = document.getElementById('tv-cust-select');
      const opts = availableCustomers.map(c => `
        <option value="${c.CustomerID}" data-name="${utils.escapeHtml(c.Name)}" data-mob="${c.Mobile}" data-cons="${c.ConsumerNo || ''}" data-type="${utils.escapeHtml(c.ConnectionType || 'DOMESTIC')}">
          ${utils.escapeHtml(c.Name)} (${c.Mobile}) ${c.ConsumerNo ? '• #' + c.ConsumerNo : ''}
        </option>
      `).join('');

      if (select) {
        select.innerHTML = '<option value="">Counter Walk-in Customer</option>' + opts;
      }
      if (tvSelect) {
        tvSelect.innerHTML = '<option value="">-- Choose Existing Consumer --</option>' + opts;
      }
    }
  },

  initCart() {
    // If empty, auto-add default 14.2 KG Domestic Refill
    if (availableItems.length && !cart.length) {
      const defaultItem = availableItems.find(i => i.CylinderType === '14.2 KG Domestic' && i.Category === 'SALE');
      if (defaultItem) {
        cart.push({
          ItemID: defaultItem.ItemID,
          ItemName: defaultItem.ItemName,
          Category: defaultItem.Category,
          CylinderType: defaultItem.CylinderType,
          Quantity: 1,
          Rate: Number(defaultItem.Rate),
          RatePaise: utils.toPaise(defaultItem.Rate),
          TaxPercent: Number(defaultItem.TaxPercent || 0),
          Total: Number(defaultItem.Rate)
        });
      }
    }
    this.renderCart();
  },

  addItemToCart() {
    const select = document.getElementById('pos-item-select');
    const qtyInput = document.getElementById('pos-item-qty');
    const rateInput = document.getElementById('pos-item-rate');
    const itemId = parseInt(select.value);
    const qty = parseInt(qtyInput.value) || 1;

    if (!itemId) {
      ui.warn('Please select a product from the list.');
      return;
    }

    const itemObj = availableItems.find(i => i.ItemID === itemId);
    if (!itemObj) return;

    // Use manually typed rate if present and valid; else fallback to item's default rate
    const typedRate = parseFloat(rateInput?.value);
    const rate = (!isNaN(typedRate) && typedRate >= 0) ? typedRate : Number(itemObj.Rate);

    // Check if already in cart with matching itemId and rate
    const existing = cart.find(c => c.ItemID === itemId && Math.abs(c.Rate - rate) < 0.001);
    if (existing) {
      existing.Quantity += qty;
      existing.Total = existing.Quantity * existing.Rate;
    } else {
      cart.push({
        ItemID: itemObj.ItemID,
        ItemName: itemObj.ItemName,
        Category: itemObj.Category,
        CylinderType: itemObj.CylinderType,
        Quantity: qty,
        Rate: rate,
        RatePaise: utils.toPaise(rate),
        TaxPercent: Number(itemObj.TaxPercent || 0),
        Total: qty * rate
      });
    }

    // Reset selectors
    select.value = '';
    qtyInput.value = '1';
    if (rateInput) rateInput.value = '';
    this.renderCart();
  },

  renderCart() {
    const tbody = document.getElementById('pos-cart-table-body');
    const countEl = document.getElementById('pos-cart-count');
    if (!tbody) return;

    countEl.textContent = cart.length;

    if (!cart.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--text-muted); padding:24px;">Cart is empty. Select an item above to add.</td></tr>';
      this.updateTotalsAndGuard();
      return;
    }

    tbody.innerHTML = cart.map((it, idx) => `
      <tr>
        <td><strong>${utils.escapeHtml(it.ItemName)}</strong></td>
        <td><span class="badge badge-info">${it.Category}</span></td>
        <td class="text-center">
          <input type="number" class="form-control text-center cart-qty-edit" data-idx="${idx}" value="${it.Quantity}" min="1" style="width:65px; height:32px; display:inline-block;">
        </td>
        <td class="text-right">
          <input type="number" class="form-control text-right cart-rate-edit num-font" data-idx="${idx}" value="${it.Rate}" min="0" step="any" style="width:95px; height:32px; display:inline-block; font-weight:700;">
        </td>
        <td class="text-right num-font" style="font-weight:700;">${utils.formatCurrency(it.Total)}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm cart-remove-item" data-idx="${idx}" style="color:var(--color-danger); border:none;" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Bind quantity edit listeners
    tbody.querySelectorAll('.cart-qty-edit').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = parseInt(e.target.value) || 1;
        cart[idx].Quantity = Math.max(1, val);
        cart[idx].Total = cart[idx].Quantity * cart[idx].Rate;
        this.renderCart();
      });
    });

    // Bind rate edit listeners (user can edit rate inside cart)
    tbody.querySelectorAll('.cart-rate-edit').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const val = parseFloat(e.target.value);
        cart[idx].Rate = isNaN(val) ? 0 : Math.max(0, val);
        cart[idx].RatePaise = utils.toPaise(cart[idx].Rate);
        cart[idx].Total = cart[idx].Quantity * cart[idx].Rate;
        this.renderCart();
      });
    });

    tbody.querySelectorAll('.cart-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        cart.splice(idx, 1);
        this.renderCart();
      });
    });

    this.updateTotalsAndGuard();
  },

  updateTotalsAndGuard() {
    let subtotalPaise = 0;
    let taxPaise = 0;

    cart.forEach(it => {
      const lineTotalPaise = it.RatePaise * it.Quantity;
      const lineTaxPaise = Math.round((lineTotalPaise * it.TaxPercent) / 100);
      subtotalPaise += lineTotalPaise;
      taxPaise += lineTaxPaise;
    });

    const discountAmount = parseFloat(document.getElementById('pos-discount')?.value || 0);
    const discountPaise = utils.toPaise(discountAmount);

    let netBillPaise = subtotalPaise + taxPaise - discountPaise;
    if (netBillPaise < 0) netBillPaise = 0;

    // Update Totals Display
    const subEl = document.getElementById('pos-summary-subtotal');
    const taxEl = document.getElementById('pos-summary-tax');
    const discEl = document.getElementById('pos-summary-discount');
    const netEl = document.getElementById('pos-summary-net');

    if (subEl) subEl.textContent = utils.formatCurrency(subtotalPaise / 100);
    if (taxEl) taxEl.textContent = utils.formatCurrency(taxPaise / 100);
    if (discEl) discEl.textContent = utils.formatCurrency(discountPaise / 100);
    if (netEl) netEl.textContent = utils.formatCurrency(netBillPaise / 100);

    // Read Payment Inputs in Paise
    const cashPaise = utils.toPaise(document.getElementById('pos-pay-cash')?.value || 0);
    const upiPaise = utils.toPaise(document.getElementById('pos-pay-upi')?.value || 0);
    const hpPayPaise = utils.toPaise(document.getElementById('pos-pay-hppay')?.value || 0);
    const duesPaise = utils.toPaise(document.getElementById('pos-pay-dues')?.value || 0);
    const bankPaise = utils.toPaise(document.getElementById('pos-pay-bank')?.value || 0);

    const totalSettlementPaise = cashPaise + upiPaise + hpPayPaise + duesPaise + bankPaise;
    const diffPaise = netBillPaise - totalSettlementPaise;

    const guardEl = document.getElementById('pos-balance-guard');
    if (guardEl) {
      if (diffPaise === 0) {
        guardEl.style.background = 'var(--color-success-bg)';
        guardEl.style.color = 'var(--color-success)';
        guardEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Settlement Balanced (₹0.00 difference)';
      } else if (diffPaise > 0) {
        guardEl.style.background = 'var(--color-danger-bg)';
        guardEl.style.color = 'var(--color-danger)';
        guardEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Underpaid: Enter remaining ${utils.formatCurrency(diffPaise / 100)}`;
      } else {
        guardEl.style.background = 'var(--color-warning-bg)';
        guardEl.style.color = 'var(--color-warning)';
        guardEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Overpaid by ${utils.formatCurrency(Math.abs(diffPaise) / 100)}`;
      }
    }

    return { netBillPaise, totalSettlementPaise, diffPaise };
  },

  autoFillPayment(targetFieldId) {
    const { netBillPaise } = this.updateTotalsAndGuard();
    // Zero out others
    ['pos-pay-cash', 'pos-pay-upi', 'pos-pay-hppay', 'pos-pay-dues', 'pos-pay-bank'].forEach(id => {
      document.getElementById(id).value = '0';
    });
    document.getElementById(targetFieldId).value = (netBillPaise / 100).toFixed(2);
    this.updateTotalsAndGuard();
  },

  async generateBill() {
    if (!cart.length) {
      ui.warn('Cart is empty. Please add items to generate a bill.');
      return;
    }

    const { netBillPaise, totalSettlementPaise, diffPaise } = this.updateTotalsAndGuard();

    // Guard Check
    if (diffPaise !== 0) {
      ui.error(`Settlement mismatch! Net bill total is ${utils.formatCurrency(netBillPaise / 100)} but tenders sum to ${utils.formatCurrency(totalSettlementPaise / 100)}. Difference: ${utils.formatCurrency(Math.abs(diffPaise) / 100)}`);
      return;
    }

    const custSelect = document.getElementById('pos-customer-select');
    const custId = custSelect.value ? parseInt(custSelect.value) : null;
    const selectedOption = custSelect.options[custSelect.selectedIndex];

    const duesAmount = parseFloat(document.getElementById('pos-pay-dues')?.value || 0);
    if (duesAmount > 0 && !custId) {
      ui.warn('Customer selection is mandatory when credit dues payment mode is used.');
      return;
    }

    // If New SV Package Mode, validate customer fields and call issueNewConnectionPackage
    if (this.activeMode === 'sv_package') {
      const svName = document.getElementById('pos-sv-name')?.value.trim();
      const svMobile = document.getElementById('pos-sv-mobile')?.value.trim();
      const svAddr = document.getElementById('pos-sv-addr')?.value.trim() || '';
      const svAadhaar = document.getElementById('pos-sv-aadhaar')?.value.trim() || '';

      if (!custId && (!svName || !svMobile)) {
        ui.warn('Customer Name and 10-digit Mobile are required for New SV Connection Package!');
        return;
      }

      const payload = {
        BillDate: document.getElementById('pos-bill-date').value,
        CustomerID: custId,
        CustomerName: custId ? selectedOption.dataset.name : svName,
        CustomerMobile: custId ? selectedOption.dataset.mob : svMobile,
        Mobile: custId ? selectedOption.dataset.mob : svMobile,
        Address: svAddr,
        AadhaarLast4: svAadhaar,
        ConsumerNo: custId ? selectedOption.dataset.cons : svAadhaar,
        CustomerType: document.getElementById('pos-customer-type')?.value.trim() || 'DOMESTIC',
        DiscountAmount: parseFloat(document.getElementById('pos-discount')?.value || 0),
        PaidCash: parseFloat(document.getElementById('pos-pay-cash')?.value || 0),
        PaidUPI: parseFloat(document.getElementById('pos-pay-upi')?.value || 0),
        PaidHPPay: parseFloat(document.getElementById('pos-pay-hppay')?.value || 0),
        PaidDues: duesAmount,
        PaidBank: parseFloat(document.getElementById('pos-pay-bank')?.value || 0),
        items: cart,
        packageItems: cart
      };

      const res = await api('issueNewConnectionPackage', payload, { loaderMessage: 'Issuing New SV Connection & Bill...' });
      if (res.ok && res.data) {
        ui.success(`New SV Connection & Bill ${res.data.BillNumber} issued successfully!`);
        const shouldPrint = await ui.confirm(`Bill ${res.data.BillNumber} generated successfully! Would you like to print the receipt now?`, 'Print Bill', 'Print Receipt');
        if (shouldPrint) {
          const fullBillRes = await api('getBill', { BillID: res.data.BillID });
          if (fullBillRes.ok && fullBillRes.data) {
            printEngine.openPreview('pos_invoice', fullBillRes.data, '80mm');
          }
        }
        cart = [];
        this.initCart();
        ['pos-discount', 'pos-pay-cash', 'pos-pay-upi', 'pos-pay-hppay', 'pos-pay-dues', 'pos-pay-bank'].forEach(id => {
          document.getElementById(id).value = '0';
        });
        custSelect.value = '';
        if (document.getElementById('pos-sv-name')) document.getElementById('pos-sv-name').value = '';
        if (document.getElementById('pos-sv-mobile')) document.getElementById('pos-sv-mobile').value = '';
        if (document.getElementById('pos-sv-addr')) document.getElementById('pos-sv-addr').value = '';
        if (document.getElementById('pos-sv-aadhaar')) document.getElementById('pos-sv-aadhaar').value = '';
        await this.loadCustomers();
        this.loadRecentBills();
      }
      return;
    }

    // Regular Bill flow
    const hawkerSelect = document.getElementById('pos-hawker-select');
    const hawkerId = hawkerSelect ? hawkerSelect.value : '';
    const hawkerName = (hawkerSelect && hawkerSelect.selectedOptions[0] && hawkerSelect.value) ? (hawkerSelect.selectedOptions[0].dataset.name || '') : '';

    const hpConsumerInputs = Array.from(document.querySelectorAll('.pos-hp-cno-input')).map(i => i.value.trim()).filter(Boolean);
    let billNotes = hawkerName ? `Delivery Staff / Hawker: ${hawkerName}` : '';
    if (hpConsumerInputs.length > 0) {
      const hpNote = `HP Pay Consumers (${hpConsumerInputs.length}): ${hpConsumerInputs.join(', ')}`;
      billNotes = billNotes ? (billNotes + ' | ' + hpNote) : hpNote;
    }

    const payload = {
      BillDate: document.getElementById('pos-bill-date').value,
      CustomerID: custId,
      CustomerName: custId ? selectedOption.dataset.name : (hawkerName ? `Counter (${hawkerName})` : 'Counter Walk-in'),
      CustomerMobile: custId ? selectedOption.dataset.mob : '',
      ConsumerNo: custId ? selectedOption.dataset.cons : '',
      CustomerType: document.getElementById('pos-customer-type')?.value.trim() || 'DOMESTIC',
      HawkerID: hawkerId || null,
      HawkerName: hawkerName || '',
      HPPayReference: hpConsumerInputs.length > 0 ? hpConsumerInputs.join(', ') : '',
      HPPayConsumerDetails: hpConsumerInputs.length > 0 ? hpConsumerInputs.join(', ') : '',
      Notes: billNotes,
      DiscountAmount: parseFloat(document.getElementById('pos-discount')?.value || 0),
      PaidCash: parseFloat(document.getElementById('pos-pay-cash')?.value || 0),
      PaidUPI: parseFloat(document.getElementById('pos-pay-upi')?.value || 0),
      PaidHPPay: parseFloat(document.getElementById('pos-pay-hppay')?.value || 0),
      PaidDues: duesAmount,
      PaidBank: parseFloat(document.getElementById('pos-pay-bank')?.value || 0),
      items: cart
    };

    const res = await api('addBill', payload, { loaderMessage: 'Generating tax invoice...' });
    if (res.ok && res.data) {
      ui.toast(`Bill ${res.data.BillNumber} saved!`);

      // Ask to print
      const shouldPrint = await ui.confirm(`Bill ${res.data.BillNumber} generated successfully! Would you like to print the receipt now?`, 'Print Bill', 'Print Receipt');
      if (shouldPrint) {
        const fullBillRes = await api('getBill', { BillID: res.data.BillID });
        if (fullBillRes.ok && fullBillRes.data) {
          printEngine.openPreview('pos_invoice', fullBillRes.data, '80mm');
        }
      }

      // Reset Form & Reload Bills
      cart = [];
      this.initCart();
      ['pos-discount', 'pos-pay-cash', 'pos-pay-upi', 'pos-pay-hppay', 'pos-pay-dues', 'pos-pay-bank'].forEach(id => {
        document.getElementById(id).value = '0';
      });
      custSelect.value = '';
      if (document.getElementById('pos-hawker-select')) document.getElementById('pos-hawker-select').value = '';
      if (document.getElementById('pos-hppay-calc-box')) document.getElementById('pos-hppay-calc-box').style.display = 'none';
      if (document.getElementById('pos-hppay-count-input')) document.getElementById('pos-hppay-count-input').value = '0';
      this.loadRecentBills();
    }
  },

  async generateTvOutBill() {
    const custSel = document.getElementById('tv-cust-select');
    const custId = custSel?.value ? parseInt(custSel.value) : null;
    const name = document.getElementById('tv-cust-name')?.value.trim();
    const mobile = document.getElementById('tv-cust-mobile')?.value.trim();
    const consumerNo = document.getElementById('tv-cust-consumerno')?.value.trim();
    const custType = document.getElementById('tv-cust-type')?.value.trim() || 'DOMESTIC';
    const date = document.getElementById('tv-bill-date')?.value || utils.today();

    if (!name || !mobile) {
      ui.warn('Consumer Name and Mobile Number are required for TV Out!');
      return;
    }

    const cylRet = document.getElementById('tv-chk-cyl')?.checked ? (parseInt(document.getElementById('tv-qty-cyl')?.value) || 1) : 0;
    const regRet = document.getElementById('tv-chk-reg')?.checked ? 1 : 0;
    const passRet = document.getElementById('tv-chk-passbook')?.checked ? 1 : 0;

    const cylDeposit = parseFloat(document.getElementById('tv-cyl-deposit')?.value) || 0;
    const regDeposit = parseFloat(document.getElementById('tv-reg-deposit')?.value) || 0;
    const secTotal = parseFloat(document.getElementById('tv-sec-total')?.value) || (cylDeposit + regDeposit);

    const tvOutCharge = parseFloat(document.getElementById('tv-charge-tvout')?.value) || 0;
    const adminCharge = parseFloat(document.getElementById('tv-charge-admin')?.value) || 0;
    const imprestFund = parseFloat(document.getElementById('tv-charge-imprest')?.value) || 0;
    const totalDeductions = tvOutCharge + adminCharge + imprestFund;

    const netRefund = Math.max(0, secTotal - totalDeductions);

    if (secTotal <= 0) {
      ui.warn('Total Security Deposit must be greater than zero!');
      return;
    }

    const confirmed = await ui.confirm(
      `Issue TV Out Voucher for ${name}?\n\n• Total Security Held: ${utils.formatCurrency(secTotal)}\n• Total Deductions: -${utils.formatCurrency(totalDeductions)}\n• Net Cash Returned: ${utils.formatCurrency(netRefund)}\n• Empty Cylinder Returned: ${cylRet}`,
      'Confirm TV Out Voucher',
      'Issue TV Out Voucher'
    );
    if (!confirmed) return;

    const payload = {
      CustomerID: custId,
      CustomerName: name,
      CustomerMobile: mobile,
      Mobile: mobile,
      ConsumerNo: consumerNo,
      CustomerType: custType,
      Date: date,
      CylinderType: document.getElementById('tv-cyl-type')?.value || '14.2 KG Domestic',
      CylindersReturned: cylRet,
      RegulatorReturned: regRet,
      PassbookReturned: passRet,
      CylinderDepositAmount: cylDeposit,
      RegulatorDepositAmount: regDeposit,
      SecurityAmount: secTotal,
      TvOutCharge: tvOutCharge,
      AdminCharge: adminCharge,
      ImprestFund: imprestFund,
      DeductionAmount: totalDeductions,
      RefundAmount: netRefund,
      PaymentMode: document.getElementById('tv-pay-mode')?.value || 'CASH',
      ReferenceNo: document.getElementById('tv-ref-no')?.value.trim() || '',
      Reason: (() => {
        let r = document.getElementById('tv-reason')?.value.trim() || 'TV Out Connection Surrender & Caution Money Refund';
        const extras = [];
        document.querySelectorAll('.tv-extra-ded-row').forEach(row => {
          const sel = row.querySelector('.tv-extra-ded-item');
          const rateIn = row.querySelector('.tv-extra-ded-rate');
          const amt = parseFloat(rateIn?.value) || 0;
          if (amt > 0) {
            const name = (sel && sel.selectedOptions[0] && sel.selectedOptions[0].value) ? sel.selectedOptions[0].textContent.trim() : 'Extra Fee';
            extras.push(`${name}: ₹${amt.toFixed(2)}`);
          }
        });
        if (extras.length > 0) {
          r += ' | Extra Deductions: ' + extras.join('; ');
        }
        return r;
      })(),
      VoucherType: 'TV_OUT'
    };

    const res = await api('saveTvOutBill', payload, { loaderMessage: 'Processing TV Out & updating stock/cash...' });
    if (res.ok && res.data) {
      ui.success(`TV Out Voucher ${res.data.RefundNumber} created successfully! Net Return: ${utils.formatCurrency(res.data.RefundAmount)}`);

      // Print voucher preview
      printEngine.openPreview('security_refund', res.data, '80mm');

      // Reset TV Out form
      if (custSel) custSel.value = '';
      document.getElementById('tv-cust-name').value = '';
      document.getElementById('tv-cust-mobile').value = '';
      document.getElementById('tv-cust-consumerno').value = '';
      document.getElementById('tv-ref-no').value = '';
      const extraContainer = document.getElementById('tv-extra-deductions-list');
      if (extraContainer) extraContainer.innerHTML = '';
      this.calcTvOut();

      // Reload register
      await this.loadCustomers();
      this.loadRecentBills();
    }
  },

  async loadRecentBills(search = '') {
    const res = await api('listBills', { date: utils.today(), search }, { loader: false });
    const tbody = document.getElementById('pos-recent-bills-body');
    if (!tbody) return;

    if (!res.ok || !res.data || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--text-muted); padding:20px;">No bills generated for today yet.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(b => {
      const isTvOut = (b.BillType === 'TV_OUT');
      const pmList = [];
      if (Number(b.PaidCash) > 0) pmList.push('Cash');
      if (Number(b.PaidUPI) > 0) pmList.push('UPI');
      if (Number(b.PaidHPPay) > 0) pmList.push('HP Pay');
      if (Number(b.PaidDues) > 0) pmList.push('Dues');
      if (Number(b.PaidBank) > 0) pmList.push('Bank');

      return `
        <tr style="${b.IsCancelled ? 'opacity:0.6; text-decoration:line-through;' : ''}">
          <td>
            <strong>${utils.escapeHtml(b.BillNumber)}</strong>
            ${isTvOut ? '<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:10px; margin-left:4px; font-weight:700;"><i class="fa-solid fa-arrow-right-from-bracket"></i> TV OUT</span>' : ''}
          </td>
          <td>${utils.formatDate(b.BillDate)}</td>
          <td>
            ${utils.escapeHtml(b.CustomerName)}
            ${b.CustomerType ? `<span style="font-size:10.5px; color:var(--text-muted); display:block;">(${utils.escapeHtml(b.CustomerType)})</span>` : ''}
          </td>
          <td class="text-right num-font" style="font-weight:700; ${isTvOut ? 'color:#b45309;' : ''}">
            ${isTvOut ? '-' : ''}${utils.formatCurrency(b.TotalAmount)}
          </td>
          <td><span class="badge badge-secondary">${pmList.join(', ') || (isTvOut ? 'Cash Outflow' : 'N/A')}</span></td>
          <td class="text-center">
            ${b.IsCancelled ? '<span class="badge badge-danger">CANCELLED</span>' : (isTvOut ? '<span class="badge" style="background:#ecfdf5; color:#047857;">REFUNDED</span>' : '<span class="badge badge-success">FINAL</span>')}
          </td>
          <td class="text-center" style="white-space:nowrap;">
            <button class="action-icon view-icon view-bill-action" data-id="${b.BillID}" data-type="${b.BillType || 'SALE'}" title="View Details">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="action-icon print-icon print-bill-action" data-id="${b.BillID}" data-type="${b.BillType || 'SALE'}" title="Print Receipt">
              <i class="fa-solid fa-print"></i>
            </button>
            ${!b.IsCancelled && !isTvOut && auth.can('billing', 'delete') ? `
            <button class="action-icon delete-icon cancel-bill-action" data-id="${b.BillID}" data-no="${b.BillNumber}" title="Cancel Bill">
              <i class="fa-solid fa-ban"></i>
            </button>` : ''}
            ${(auth.currentUser?.role === 'ADMIN' || auth.can('billing', 'delete')) ? `
            <button class="action-icon delete-icon delete-bill-action" data-id="${b.BillID}" data-no="${b.BillNumber}" data-type="${b.BillType || 'SALE'}" style="color:var(--color-danger);" title="Delete Bill (Admin Only)">
              <i class="fa-solid fa-trash-can"></i>
            </button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Bind Eye Button (View Details)
    tbody.querySelectorAll('.view-bill-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bId = parseInt(e.currentTarget.dataset.id);
        const bType = e.currentTarget.dataset.type;
        if (bType === 'TV_OUT') {
          const tvRes = await api('getTvOutBill', { RefundID: bId });
          if (tvRes.ok && tvRes.data) {
            this.viewTvOutDetails(tvRes.data);
          }
          return;
        }
        const billRes = await api('getBill', { BillID: bId });
        if (billRes.ok && billRes.data) {
          this.viewBillDetails(billRes.data);
        }
      });
    });

    // Bind Print Button
    tbody.querySelectorAll('.print-bill-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bId = parseInt(e.currentTarget.dataset.id);
        const bType = e.currentTarget.dataset.type;
        if (bType === 'TV_OUT') {
          const tvRes = await api('getTvOutBill', { RefundID: bId });
          if (tvRes.ok && tvRes.data) {
            printEngine.openPreview('security_refund', tvRes.data, '80mm');
          }
          return;
        }
        const billRes = await api('getBill', { BillID: bId });
        if (billRes.ok && billRes.data) {
          printEngine.openPreview('pos_invoice', billRes.data, 'a4_tax');
        }
      });
    });

    tbody.querySelectorAll('.cancel-bill-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bId = parseInt(e.currentTarget.dataset.id);
        const bNo = e.currentTarget.dataset.no;
        const reason = await ui.prompt(`Cancel Bill ${bNo}`, 'Mandatory reason for bill cancellation...');
        if (reason) {
          const res = await api('cancelBill', { BillID: bId, Reason: reason });
          if (res.ok) {
            ui.success(`Bill ${bNo} cancelled and stock/dues effects reversed.`);
            this.loadRecentBills();
          }
        }
      });
    });

    // Bind Delete Bill (Admin Only)
    tbody.querySelectorAll('.delete-bill-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const bId = parseInt(e.currentTarget.dataset.id);
        const bNo = e.currentTarget.dataset.no;
        const bType = e.currentTarget.dataset.type || 'SALE';

        const confirmed = await ui.confirm(
          `Are you sure you want to permanently DELETE ${bType === 'TV_OUT' ? 'TV Out Voucher' : 'Bill'} ${bNo}?\n\nThis action is irreversible and reverses all stock and cash entries!`,
          'Permanently Delete Bill (Admin Only)',
          'Delete Permanently',
          'danger'
        );
        if (!confirmed) return;

        const reason = await ui.prompt(`Delete ${bNo}`, 'Reason for permanent deletion (e.g. Wrong Entry / Test Bill)...');
        if (reason !== null) {
          const res = await api('deleteBill', { BillID: bId, BillType: bType, Reason: reason || 'Deleted by Admin' }, { loaderMessage: 'Permanently deleting bill and reversing ledger...' });
          if (res.ok) {
            ui.success(`${bType === 'TV_OUT' ? 'TV Out Voucher' : 'Bill'} ${bNo} deleted successfully.`);
            this.loadRecentBills();
          }
        }
      });
    });
  },

  viewTvOutDetails(tv) {
    const html = `
      <div style="display:flex; flex-direction:column; gap:14px; text-align:left;">
        <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:var(--r-sm); padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Voucher Number</div>
            <div style="font-size:16px; font-weight:800; color:#d97706; margin-top:2px;">${utils.escapeHtml(tv.RefundNumber)}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Date: <strong>${utils.formatDate(tv.Date)}</strong></div>
            <div style="margin-top:6px;"><span class="badge" style="background:#ecfdf5; color:#047857; font-weight:700;">TV OUT COMPLETED</span></div>
          </div>
          <div>
            <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Consumer Details</div>
            <div style="font-size:14px; font-weight:700; margin-top:2px;">${utils.escapeHtml(tv.CustomerName)}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Mobile: <strong>${utils.escapeHtml(tv.CustomerMobile || '-')}</strong></div>
            <div style="font-size:12px; color:var(--text-muted);">Consumer No: <strong>${utils.escapeHtml(tv.ConsumerNo || '-')}</strong></div>
            <div style="font-size:12px; color:var(--text-muted);">Cust Type: <strong>${utils.escapeHtml(tv.CustomerType || 'DOMESTIC')}</strong></div>
          </div>
        </div>

        <div style="border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; background:var(--bg-surface);">
          <div style="font-weight:700; margin-bottom:8px; font-size:13px;"><i class="fa-solid fa-boxes-packing"></i> Equipment Returned:</div>
          <div style="font-size:12px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div>• Cylinder: <strong>${utils.escapeHtml(tv.CylinderType || '14.2 KG Domestic')}</strong> (${tv.CylindersReturned || 1} Empty)</div>
            <div>• Regulator: <strong>${tv.RegulatorReturned ? 'Returned' : 'Not Returned'}</strong></div>
            <div>• Passbook: <strong>${tv.PassbookReturned ? 'Surrendered' : 'No'}</strong></div>
          </div>
        </div>

        <div style="border:1px solid var(--border); border-radius:var(--r-sm); overflow:hidden;">
          <table class="data-table" style="margin:0;">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Security Deposit Held</td>
                <td class="text-right num-font font-weight-bold">${utils.formatCurrency(tv.SecurityAmount || 0)}</td>
              </tr>
              ${Number(tv.TvOutCharge) > 0 ? `
              <tr style="color:#b91c1c;">
                <td>Less: TV Out Charge</td>
                <td class="text-right num-font">-${utils.formatCurrency(tv.TvOutCharge)}</td>
              </tr>` : ''}
              ${Number(tv.AdminCharge) > 0 ? `
              <tr style="color:#b91c1c;">
                <td>Less: Administration Charge</td>
                <td class="text-right num-font">-${utils.formatCurrency(tv.AdminCharge)}</td>
              </tr>` : ''}
              ${Number(tv.ImprestFund) > 0 ? `
              <tr style="color:#b91c1c;">
                <td>Less: Imprest Fund / Custom Deduction</td>
                <td class="text-right num-font">-${utils.formatCurrency(tv.ImprestFund)}</td>
              </tr>` : ''}
              <tr style="background:var(--bg-body); font-weight:800; font-size:15px; color:#15803d;">
                <td>NET CASH RETURNED TO CUSTOMER</td>
                <td class="text-right num-font">${utils.formatCurrency(tv.RefundAmount || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    ui.modal(html, `TV Out Voucher - ${tv.RefundNumber}`);
  },

  viewBillDetails(bill) {
    const items = bill.items || bill.Items || [];
    const itemRows = items.map((it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${utils.escapeHtml(it.ItemName || 'Item')}</strong></td>
        <td style="text-align:center;">${it.Quantity || 1}</td>
        <td class="num text-right">${utils.formatCurrency(it.Rate || 0)}</td>
        <td class="num text-right font-weight-bold">${utils.formatCurrency(it.Total || 0)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header Info -->
        <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:var(--r-sm); padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Invoice Information</div>
            <div style="font-size:16px; font-weight:800; color:var(--primary); margin-top:2px;">${utils.escapeHtml(bill.BillNumber)}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Date: <strong>${utils.formatDate(bill.BillDate)}</strong></div>
            <div style="margin-top:6px;">
              ${bill.IsCancelled ? '<span class="badge badge-danger">CANCELLED</span>' : '<span class="badge badge-success">FINAL INVOICE</span>'}
            </div>
          </div>
          <div>
            <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Customer Information</div>
            <div style="font-size:14px; font-weight:700; margin-top:2px;">${utils.escapeHtml(bill.CustomerName || 'Counter Sale')}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Mobile: <strong>${utils.escapeHtml(bill.CustomerMobile || '-')}</strong></div>
            <div style="font-size:12px; color:var(--text-muted);">Consumer No: <strong>${utils.escapeHtml(bill.ConsumerNo || 'COUNTER')}</strong></div>
          </div>
        </div>

        <!-- Line items -->
        <div style="border:1px solid var(--border); border-radius:var(--r-sm); overflow:hidden;">
          <table class="data-table" style="margin:0;">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">#</th>
                <th>Item Description</th>
                <th style="width:60px; text-align:center;">Qty</th>
                <th style="width:100px;" class="text-right">Rate</th>
                <th style="width:110px;" class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || '<tr><td colspan="5" class="text-center">No items found.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Totals & Payment Breakdown -->
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:16px; align-items:start;">
          <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; font-size:12.5px;">
            <div style="font-weight:700; color:var(--primary); margin-bottom:6px; font-size:11px; text-transform:uppercase;">Settlement Details</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Cash Tendered:</span> <strong class="num-font">${utils.formatCurrency(bill.PaidCash || 0)}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>UPI / Digital:</span> <strong class="num-font">${utils.formatCurrency(bill.PaidUPI || 0)}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>HP Pay:</span> <strong class="num-font">${utils.formatCurrency(bill.PaidHPPay || 0)}</strong></div>
            <div style="display:flex; justify-content:space-between; color:#b91c1c;"><span>Credit Dues:</span> <strong class="num-font">${utils.formatCurrency(bill.PaidDues || 0)}</strong></div>
          </div>

          <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Subtotal:</span> <span class="num-font">${utils.formatCurrency(bill.Subtotal || 0)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>GST Tax:</span> <span class="num-font">${utils.formatCurrency(bill.TaxAmount || 0)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Discount:</span> <span class="num-font">-${utils.formatCurrency(bill.DiscountAmount || 0)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:800; border-top:1px dashed var(--border); padding-top:6px; color:var(--primary);">
              <span>Grand Total:</span>
              <span class="num-font">${utils.formatCurrency(bill.TotalAmount || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    ui.viewDetails(`Bill #${bill.BillNumber}`, html, () => {
      printEngine.openPreview('pos_invoice', bill, 'a4_tax');
    });
  },

  async openQuickCustomerModal() {
    const html = `
      <div style="display:flex; flex-direction:column; gap:6px; text-align:left;">
        <div class="modal-section-card">
          <div class="modal-section-header">
            <i class="fa-solid fa-user-plus"></i>
            <span>Quick Customer Registration</span>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label"><i class="fa-solid fa-user"></i> Full Legal Name *</label>
              <input type="text" id="qc-name" class="form-control" required placeholder="Full Name">
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fa-solid fa-phone"></i> 10-Digit Mobile *</label>
              <input type="tel" id="qc-mobile" class="form-control" required placeholder="9876543210" maxlength="10">
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fa-solid fa-hashtag"></i> Consumer Number</label>
              <input type="text" id="qc-consumer" class="form-control" placeholder="Optional Consumer No">
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fa-solid fa-location-dot"></i> Village / Area</label>
              <input type="text" id="qc-area" class="form-control" placeholder="Village or Bazar">
            </div>
          </div>
        </div>
      </div>
    `;

    const data = await ui.formModal(html, 'Quick Add Customer', () => {
      const name = document.getElementById('qc-name').value.trim();
      const mobile = document.getElementById('qc-mobile').value.trim();
      if (!name || !mobile) {
        Swal.showValidationMessage('Name and Mobile are required!');
        return false;
      }
      if (!/^\d{10}$/.test(mobile)) {
        Swal.showValidationMessage('Enter a valid 10-digit mobile number!');
        return false;
      }
      return {
        Name: name,
        Mobile: mobile,
        ConsumerNo: document.getElementById('qc-consumer').value.trim(),
        Area: document.getElementById('qc-area').value.trim()
      };
    });

    if (data) {
      const res = await api('saveCustomer', data, { loaderMessage: 'Registering customer...' });
      if (res.ok && res.data) {
        ui.success('Customer registered successfully!');
        await this.loadCustomers();
        document.getElementById('pos-customer-select').value = res.data.CustomerID;
      }
    }
  },

  /**
   * New SV Package Builder - Switches to New SV Package mode in POS screen
   */
  openSVPackageModal() {
    this.setMode('sv_package');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * TV Out Billing / Security Deposit Refund - Switches to TV Out mode in POS screen
   */
  openSecurityRefundModal(preselectedCustomer = null) {
    this.setMode('tv_out');
    if (preselectedCustomer) {
      const nameIn = document.getElementById('tv-cust-name');
      const mobIn = document.getElementById('tv-cust-mobile');
      const consIn = document.getElementById('tv-cust-consumerno');
      const typeIn = document.getElementById('tv-cust-type');
      const custSel = document.getElementById('tv-cust-select');
      if (nameIn) nameIn.value = preselectedCustomer.Name || '';
      if (mobIn) mobIn.value = preselectedCustomer.Mobile || '';
      if (consIn) consIn.value = preselectedCustomer.ConsumerNo || '';
      if (typeIn) typeIn.value = preselectedCustomer.ConnectionType || 'DOMESTIC';
      if (custSel && preselectedCustomer.CustomerID) custSel.value = preselectedCustomer.CustomerID;
      this.calcTvOut();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },


};
