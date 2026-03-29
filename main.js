/* ============================================
   PayFlow — main.js
   Handles Razorpay checkout, pricing toggle,
   scroll animations, navbar behaviour, dashboard
   section switching, modals, filters, and settings.
   ============================================ */

// ─── CONFIG ───────────────────────────────────
// Replace with your Razorpay Test Key ID
const RAZORPAY_KEY_ID = 'rzp_test_SUkHB2wTXHNDph';

// Plan name → Razorpay Plan ID mapping
// Replace with your actual Razorpay Plan IDs from the dashboard
const PLAN_IDS = {
  basic: 'plan_SUks272OUqVjKU',
  pro: 'plan_SUksnzMP0o86RQ',
  enterprise: 'plan_SUktbAuOcWhY5t',
};

let isYearly = false;

// ─── RAZORPAY CHECKOUT ───────────────────────
async function handleSubscribe(buttonEl) {
  // Guard: check if the key is still placeholder
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('YOUR_KEY_HERE')) {
    showToast('⚠️ Please set your Razorpay Test Key in main.js (line 9) before making payments.', 'error');
    return;
  }

  const plan = buttonEl.dataset.plan;
  const amountKey = isYearly ? 'amountYearly' : 'amountMonthly';
  const amount = parseInt(buttonEl.dataset[amountKey], 10); // in paise

  const planLabels = {
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  // Disable button and show loading
  const originalText = buttonEl.textContent;
  buttonEl.textContent = 'Processing...';
  buttonEl.disabled = true;

  try {
    // Step 1: Create order on backend
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        plan: plan,
        billing_cycle: isYearly ? 'yearly' : 'monthly',
      }),
    });

    const order = await res.json();

    if (!res.ok || !order.id) {
      throw new Error(order.error || 'Failed to create order');
    }

    // Step 2: Open Razorpay checkout with order_id
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'PayFlow',
      description: `${planLabels[plan]} Plan — ${isYearly ? 'Yearly' : 'Monthly'}`,
      handler: function (response) {
        showToast(`🎉 Payment successful! ID: ${response.razorpay_payment_id}`, 'success');
        console.log('Razorpay response:', response);
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      },
      prefill: {
        name: '',
        email: '',
        contact: '',
      },
      notes: {
        plan_name: plan,
        billing_cycle: isYearly ? 'yearly' : 'monthly',
      },
      theme: {
        color: '#6366f1',
      },
      modal: {
        ondismiss: function () {
          showToast('Checkout cancelled.', 'info');
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      showToast(`❌ Payment failed: ${response.error.description}`, 'error');
      console.error('Payment failed:', response.error);
    });
    rzp.open();

  } catch (err) {
    showToast(`⚠️ ${err.message}`, 'error');
    console.error('Checkout error:', err);
  } finally {
    buttonEl.textContent = originalText;
    buttonEl.disabled = false;
  }
}

// Quick pay button on dashboard billing section
async function handleQuickPay(amountPaise, planName) {
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('YOUR_KEY_HERE')) {
    showToast('⚠️ Please set your Razorpay Test Key in main.js (line 9) before making payments.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', plan: planName }),
    });

    const order = await res.json();
    if (!res.ok || !order.id) throw new Error(order.error || 'Order failed');

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'PayFlow',
      description: `${planName} Plan — Monthly Payment`,
      handler: function (response) {
        showToast(`🎉 Payment of ₹${amountPaise / 100} successful!`, 'success');
        console.log('Quick pay response:', response);
      },
      theme: { color: '#6366f1' },
      modal: {
        ondismiss: function () {
          showToast('Payment cancelled.', 'info');
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      showToast(`❌ Payment failed: ${resp.error.description}`, 'error');
    });
    rzp.open();

  } catch (err) {
    showToast(`⚠️ ${err.message}`, 'error');
    console.error('Quick pay error:', err);
  }
}

// ─── PRICING TOGGLE (Monthly ↔ Yearly) ──────
function initPricingToggle() {
  const toggle = document.getElementById('billing-toggle');
  const labelM = document.getElementById('label-monthly');
  const labelY = document.getElementById('label-yearly');
  const amounts = document.querySelectorAll('.pricing-amount');
  const intervals = document.querySelectorAll('.pricing-interval');

  if (!toggle) return;

  toggle.addEventListener('click', () => {
    isYearly = !isYearly;
    toggle.classList.toggle('yearly', isYearly);
    toggle.setAttribute('aria-checked', isYearly);
    if (labelM) labelM.classList.toggle('active', !isYearly);
    if (labelY) labelY.classList.toggle('active', isYearly);

    amounts.forEach(el => {
      el.textContent = isYearly ? el.dataset.yearly : el.dataset.monthly;
    });

    intervals.forEach(el => {
      el.textContent = isYearly ? 'per month, billed yearly' : 'per month';
    });
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle.click();
    }
  });
}

// ─── DASHBOARD SECTION SWITCHING ─────────────
function initSidebarNav() {
  const navLinks = document.querySelectorAll('.sidebar-nav a[data-section]');
  if (!navLinks.length) return;

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      switchSection(sectionId);
    });
  });
}

function switchSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.dash-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Show selected section
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.remove('active');
    if (a.dataset.section === sectionId) {
      a.classList.add('active');
    }
  });

  // Update page title
  const titleMap = {
    'section-overview': 'Overview',
    'section-billing': 'Billing',
    'section-notifications': 'Notifications',
    'section-webhooks': 'Webhooks Log',
    'section-settings': 'Settings',
  };
  const pageTitle = document.getElementById('page-title');
  if (pageTitle && titleMap[sectionId]) {
    pageTitle.textContent = titleMap[sectionId];
  }
}

// ─── INVOICE MODAL ───────────────────────────
function viewInvoice(invoiceId, amount, date, planName) {
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = `Invoice ${invoiceId}`;
  body.innerHTML = `
    <div class="invoice-detail">
      <div class="invoice-row">
        <span class="invoice-label">Invoice ID</span>
        <span class="invoice-value">${invoiceId}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Date</span>
        <span class="invoice-value">${date}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Plan</span>
        <span class="invoice-value">${planName}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Subtotal</span>
        <span class="invoice-value">₹${(amount / 100).toFixed(2)}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Tax (GST 18%)</span>
        <span class="invoice-value">₹${(amount * 0.18 / 100).toFixed(2)}</span>
      </div>
      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 12px 0;">
      <div class="invoice-row" style="font-weight: 700; font-size: 1.05rem;">
        <span class="invoice-label">Total</span>
        <span class="invoice-value">₹${((amount * 1.18) / 100).toFixed(2)}</span>
      </div>
      <div class="invoice-row" style="margin-top: 16px;">
        <span class="invoice-label">Status</span>
        <span class="status-pill status-success">● Paid</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Payment Method</span>
        <span class="invoice-value">Razorpay</span>
      </div>
    </div>
  `;

  modal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function showEventDetail(eventType, eventId, status) {
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = 'Webhook Event Detail';
  body.innerHTML = `
    <div class="invoice-detail">
      <div class="invoice-row">
        <span class="invoice-label">Event ID</span>
        <span class="invoice-value" style="font-family: monospace; font-size: 0.85rem;">${eventId}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Event Type</span>
        <span class="invoice-value"><code style="font-size: 0.85rem; padding: 2px 8px; background: var(--bg-card-hover); border-radius: 4px;">${eventType}</code></span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Status</span>
        <span class="status-pill ${status === 'completed' ? 'status-success' : 'status-failed'}">● ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-label">Processed At</span>
        <span class="invoice-value">${new Date().toLocaleString()}</span>
      </div>
      <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 12px 0;">
      <div style="margin-top: 8px;">
        <span class="invoice-label" style="display: block; margin-bottom: 8px;">Payload Preview</span>
        <pre style="font-size: 0.75rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 12px; border-radius: 8px; overflow-x: auto; max-height: 180px;">${JSON.stringify({
    event: eventType,
    payload: {
      subscription: { entity: { id: 'sub_' + eventId.slice(4), plan_id: 'plan_xyz_pro', status: 'active' } },
      payment: { entity: { id: 'pay_' + eventId.slice(4), amount: 2900, currency: 'INR' } }
    }
  }, null, 2)}</pre>
      </div>
    </div>
  `;

  modal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('modal-overlay');
  if (modal) {
    modal.classList.remove('visible');
    document.body.style.overflow = '';
  }
}

function downloadInvoice() {
  showToast('📄 Invoice download started...', 'info');
  setTimeout(() => {
    showToast('✅ Invoice saved as PDF.', 'success');
    closeModal();
  }, 1500);
}

// ─── WEBHOOK RETRY ───────────────────────────
function retryWebhook(eventId, btn) {
  btn.textContent = 'Retrying...';
  btn.disabled = true;
  btn.style.opacity = '0.6';

  setTimeout(() => {
    const row = btn.closest('tr');
    const statusCell = row.querySelector('.status-pill');
    statusCell.className = 'status-pill status-success';
    statusCell.textContent = '● Completed';
    row.dataset.whStatus = 'completed';
    btn.textContent = 'Details';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.onclick = function () {
      showEventDetail('payment.failed', eventId, 'completed');
    };
    showToast(`🔄 Event ${eventId} retried successfully!`, 'success');
  }, 2000);
}

// ─── NOTIFICATION FILTERS ────────────────────
function filterNotifications(type, btn) {
  // Update active button
  btn.closest('.data-table-header').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Filter rows
  const rows = document.querySelectorAll('#notifications-body tr');
  rows.forEach(row => {
    if (type === 'all' || row.dataset.type === type) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ─── WEBHOOK FILTERS ─────────────────────────
function filterWebhooks(status, btn) {
  btn.closest('.data-table-header').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const rows = document.querySelectorAll('#webhooks-body tr');
  rows.forEach(row => {
    if (status === 'all' || row.dataset.whStatus === status) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ─── SETTINGS ACTIONS ────────────────────────
function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();

  if (!name || !email) {
    showToast('⚠️ Please fill in both name and email.', 'error');
    return;
  }
  if (!email.includes('@')) {
    showToast('⚠️ Please enter a valid email address.', 'error');
    return;
  }

  // Update the avatar initials
  const avatar = document.querySelector('.dash-avatar');
  if (avatar) {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    avatar.textContent = initials;
  }

  showToast('✅ Profile updated successfully!', 'success');
}

function cancelSubscriptionFromSettings() {
  const confirmed = confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your billing period.');
  if (confirmed) {
    showToast('Your subscription has been scheduled for cancellation.', 'info');
    const btn = document.getElementById('btn-cancel-settings');
    btn.textContent = 'Cancellation Pending';
    btn.disabled = true;
    btn.style.opacity = '0.5';

    // Also update the overview section
    const planStatus = document.getElementById('stat-plan-status');
    if (planStatus) {
      planStatus.textContent = '⏳ Cancelling';
      planStatus.className = 'stat-change';
      planStatus.style.color = 'var(--accent-amber)';
    }
  }
}

function deleteAccount() {
  const confirmed = confirm('⚠️ This will permanently delete your account and all associated data. This action CANNOT be undone. Are you absolutely sure?');
  if (confirmed) {
    const doubleCheck = confirm('Final confirmation: Type OK to proceed with account deletion.');
    if (doubleCheck) {
      showToast('Account deletion has been scheduled. You will receive a confirmation email.', 'error');
    }
  }
}

// ─── SCROLL ANIMATIONS (Intersection Observer) ──
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in-up');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, index * 80);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach(el => observer.observe(el));
}

// ─── NAVBAR SCROLL EFFECT ────────────────────
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ─── SMOOTH SCROLL FOR ANCHOR LINKS ──────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      // Skip sidebar nav links (they use data-section)
      if (this.dataset.section) return;

      const href = this.getAttribute('href');
      if (href === '#') return; // skip empty anchors

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ─── TOAST NOTIFICATION ──────────────────────
function showToast(message, type = 'info') {
  document.querySelectorAll('.toast-notification').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;

  const colors = {
    success: 'rgba(16, 185, 129, 0.15)',
    error: 'rgba(244, 63, 94, 0.15)',
    info: 'rgba(99, 102, 241, 0.15)',
  };
  const borders = {
    success: 'rgba(16, 185, 129, 0.3)',
    error: 'rgba(244, 63, 94, 0.3)',
    info: 'rgba(99, 102, 241, 0.3)',
  };

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '14px 24px',
    borderRadius: '12px',
    background: colors[type] || colors.info,
    border: `1px solid ${borders[type] || borders.info}`,
    backdropFilter: 'blur(16px)',
    color: '#f0f0f5',
    fontSize: '0.875rem',
    fontWeight: '500',
    fontFamily: "'Inter', sans-serif",
    zIndex: '9999',
    opacity: '0',
    transform: 'translateY(16px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ─── DASHBOARD: CANCEL SUBSCRIPTION ──────────
function initDashboard() {
  const cancelBtn = document.getElementById('btn-cancel-sub');
  if (!cancelBtn) return;

  cancelBtn.addEventListener('click', () => {
    const confirmed = confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your billing period.');
    if (confirmed) {
      showToast('Your subscription has been scheduled for cancellation.', 'info');
      cancelBtn.textContent = 'Cancellation Pending';
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = '0.5';
      cancelBtn.style.cursor = 'not-allowed';

      // Update plan status
      const planStatus = document.getElementById('stat-plan-status');
      if (planStatus) {
        planStatus.textContent = '⏳ Cancelling';
        planStatus.className = 'stat-change';
        planStatus.style.color = 'var(--accent-amber)';
      }
    }
  });
}

// ─── MODAL CLOSE ON OVERLAY CLICK ────────────
function initModalClose() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// ─── SETTINGS TOGGLE LISTENERS ───────────────
function initSettingsToggles() {
  const toggles = document.querySelectorAll('.settings-toggles input[type="checkbox"]');
  toggles.forEach(toggle => {
    toggle.addEventListener('change', () => {
      const label = toggle.closest('.settings-toggle-row').querySelector('strong').textContent;
      if (toggle.checked) {
        showToast(`✅ ${label} enabled.`, 'success');
      } else {
        showToast(`${label} disabled.`, 'info');
      }
    });
  });
}

// ─── INIT ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPricingToggle();
  initScrollAnimations();
  initNavbarScroll();
  initSmoothScroll();
  initDashboard();
  initSidebarNav();
  initModalClose();
  initSettingsToggles();
});
