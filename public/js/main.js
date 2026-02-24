document.addEventListener('DOMContentLoaded', () => {
  // ========== Header Navigation Dropdown ==========
  const dropdowns = Array.from(document.querySelectorAll('[data-nav-dd]'));

  const closeAllDropdowns = () => {
    dropdowns.forEach((dd) => {
      dd.classList.remove('is-open');
      const btn = dd.querySelector('.nav-dd__toggle');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  };

  dropdowns.forEach((dd) => {
    const btn = dd.querySelector('.nav-dd__toggle');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = dd.classList.contains('is-open');
      closeAllDropdowns();
      if (!isOpen) {
        dd.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav-dd]')) return;
    closeAllDropdowns();
  });

  // ========== Payment Modal Logic ==========
  const modal = document.getElementById('paymentModal');
  const buyNowButtons = document.querySelectorAll('.pricing-card__btn');
  const closeTriggers = modal?.querySelectorAll('[data-close="true"]');
  const paymentForm = document.getElementById('paymentForm');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
  const productNameEl = document.getElementById('productName');
  const productPriceEl = document.getElementById('productPrice');
  
  // Auth-related elements
  const loginRequiredNotice = document.getElementById('loginRequiredNotice');
  const paymentFormContainer = document.getElementById('paymentFormContainer');
  const loginToPayBtn = document.getElementById('loginToPayBtn');
  const signupToPayBtn = document.getElementById('signupToPayBtn');
  const paymentUserAvatar = document.getElementById('paymentUserAvatar');
  const paymentUserName = document.getElementById('paymentUserName');
  const paymentUserEmail = document.getElementById('paymentUserEmail');

  let currentProduct = null;

  function getInitials(username) {
    return username ? username.substring(0, 2).toUpperCase() : 'U';
  }

  function updatePaymentModalUI() {
    const isLoggedIn = window.CAN_Auth && window.CAN_Auth.isLoggedIn();
    const user = isLoggedIn ? window.CAN_Auth.getCurrentUser() : null;

    if (isLoggedIn && user) {
      // Show payment form
      loginRequiredNotice.style.display = 'none';
      paymentFormContainer.style.display = 'block';

      // Update user info
      paymentUserAvatar.textContent = getInitials(user.username);
      paymentUserName.textContent = user.username;
      paymentUserEmail.textContent = user.email || '';

      // Check if user is admin
      if (user.username.toLowerCase() === 'admin') {
        paymentUserAvatar.classList.add('user-avatar--admin');
      } else {
        paymentUserAvatar.classList.remove('user-avatar--admin');
      }
    } else {
      // Show login required notice
      loginRequiredNotice.style.display = 'block';
      paymentFormContainer.style.display = 'none';
    }
  }

  function openModal() {
    updatePaymentModalUI();
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    paymentMethodRadios.forEach(radio => radio.checked = false);
    updateSubmitButtonState();
  }

  function updateSubmitButtonState() {
    const isPaymentMethodSelected = Array.from(paymentMethodRadios).some(radio => radio.checked);
    submitPaymentBtn.disabled = !isPaymentMethodSelected;
  }

  // Open modal when clicking Buy Now buttons
  buyNowButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pricingCard = btn.closest('.pricing-card');
      const productName = pricingCard?.querySelector('.pricing-card__title')?.textContent.trim();
      const priceAmountText = pricingCard?.querySelector('.pricing-card__amount')?.textContent.trim();
      const currency = pricingCard?.querySelector('.pricing-card__currency')?.textContent.trim() || 'USD';

      // Extract numeric value from price text (remove $ and any whitespace)
      const priceValue = priceAmountText ? parseFloat(priceAmountText.replace(/[$\s]/g, '')) : 0;

      currentProduct = {
        name: productName,
        price: priceValue,
        currency: currency
      };

      // Update modal display
      if (productNameEl) productNameEl.textContent = currentProduct.name;
      if (productPriceEl) productPriceEl.textContent = `$${currentProduct.price.toFixed(2)} ${currentProduct.currency}`;

      openModal();
    });
  });

  // Close modal triggers
  closeTriggers?.forEach(trigger => {
    trigger.addEventListener('click', closeModal);
  });

  // Login/Signup buttons in payment modal
  loginToPayBtn?.addEventListener('click', () => {
    closeModal();
    if (window.CAN_Auth) {
      window.CAN_Auth.openAuthModal('login');
    }
  });

  signupToPayBtn?.addEventListener('click', () => {
    closeModal();
    if (window.CAN_Auth) {
      window.CAN_Auth.openAuthModal('register');
    }
  });

  // Payment method selection
  paymentMethodRadios?.forEach(radio => {
    radio.addEventListener('change', updateSubmitButtonState);
  });

  // Form submission
  paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if user is logged in
    if (!window.CAN_Auth || !window.CAN_Auth.isLoggedIn()) {
      alert("Please login to continue with your purchase.");
      return;
    }

    const user = window.CAN_Auth.getCurrentUser();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    if (!currentProduct) {
      alert("Product information is missing.");
      return;
    }

    if (!user.email) {
      alert("Your account does not have an email address. Please update your profile.");
      return;
    }

    try {
      submitPaymentBtn.disabled = true;
      submitPaymentBtn.textContent = "Processing...";

      const token = window.CAN_Auth.getToken();

      const response = await fetch("/api/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: currentProduct.name,
          productPrice: currentProduct.price,
          paymentMethod,
          currency: currentProduct.currency
        })
      });

      const result = await response.json();

      if (result.success && result.approveUrl) {
        window.location.href = result.approveUrl;
      } else {
        alert(result.error || "Failed to process payment. Please try again.");
        submitPaymentBtn.disabled = false;
        submitPaymentBtn.textContent = "Checkout";
      }
    } catch (error) {
      console.error("Error during payment:", error);
      alert("An error occurred. Please try again.");
      submitPaymentBtn.disabled = false;
      submitPaymentBtn.textContent = "Checkout";
    }
  });

  // Escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal?.classList.contains('is-open')) {
        closeModal();
      }
      closeAllDropdowns();
    }
  });

  // Initial state
  updateSubmitButtonState();
});

