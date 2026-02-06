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
  const emailInput = document.getElementById('emailInput');
  const emailError = document.getElementById('emailError');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
  const productNameEl = document.getElementById('productName');
  const productPriceEl = document.getElementById('productPrice');

  let currentProduct = null;

  function openModal() {
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden', 'false');
    emailInput?.focus();
  }

  function closeModal() {
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    emailInput.value = '';
    emailError.textContent = '';
    paymentMethodRadios.forEach(radio => radio.checked = false);
    updateSubmitButtonState();
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function updateSubmitButtonState() {
    const isEmailValid = validateEmail(emailInput?.value || '');
    const isPaymentMethodSelected = Array.from(paymentMethodRadios).some(radio => radio.checked);

    submitPaymentBtn.disabled = !(isEmailValid && isPaymentMethodSelected);
  }

  function handleEmailValidation() {
    const email = emailInput?.value || '';
    
    if (email === '') {
      emailError.textContent = '';
    } else if (!validateEmail(email)) {
      emailError.textContent = 'Please enter a valid email address.';
    } else {
      emailError.textContent = '';
    }
    updateSubmitButtonState();
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

  // Email input validation
  emailInput?.addEventListener('input', handleEmailValidation);

  // Payment method selection
  paymentMethodRadios?.forEach(radio => {
    radio.addEventListener('change', updateSubmitButtonState);
  });

  // Form submission
  paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput?.value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    emailError.textContent = "";

    if (!email) {
      emailError.textContent = "Email is required.";
      return;
    }

    if (!validateEmail(email)) {
      emailError.textContent = "Please enter a valid email address.";
      return;
    }

    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    if (!currentProduct) {
      alert("Product information is missing.");
      return;
    }

    try {
      submitPaymentBtn.disabled = true;
      submitPaymentBtn.textContent = "Processing...";

      const response = await fetch("/api/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
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

