document.addEventListener('DOMContentLoaded', () => {
  // Get all Buy Now buttons (now there are multiple in pricing cards)
  const buyNowButtons = document.querySelectorAll('.pricing-card__btn');
  const modal = document.getElementById('paymentModal');
  const closeTriggers = modal.querySelectorAll('[data-close="true"]');
  const paymentForm = document.getElementById('paymentForm');
  const emailInput = document.getElementById('emailInput');
  const emailError = document.getElementById('emailError');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');

  let selectedProduct = null;

  function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    emailInput.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function updateSubmitButtonState() {
    const isEmailValid = validateEmail(emailInput.value);
    let isPaymentMethodSelected = false;
    paymentMethodRadios.forEach(radio => {
      if (radio.checked) {
        isPaymentMethodSelected = true;
      }
    });

    if (isEmailValid && isPaymentMethodSelected) {
      submitPaymentBtn.disabled = false;
    } else {
      submitPaymentBtn.disabled = true;
    }
  }

  function handleEmailValidation() {
    if (emailInput.value === '') {
      emailError.textContent = '';
    } else if (!validateEmail(emailInput.value)) {
      emailError.textContent = 'Please enter a valid email address.';
    } else {
      emailError.textContent = '';
    }
    updateSubmitButtonState();
  }

  // Add click event to all Buy Now buttons
  buyNowButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Extract product info from the pricing card
      const pricingCard = btn.closest('.pricing-card');
      const productName = pricingCard.querySelector('.pricing-card__title').textContent.trim();
      const priceAmount = pricingCard.querySelector('.pricing-card__amount').textContent.replace('$', '').trim();
      
      selectedProduct = {
        name: productName,
        price: parseFloat(priceAmount)
      };
      
      openModal();
    });
  });

  closeTriggers.forEach(trigger => {
    trigger.addEventListener('click', closeModal);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  emailInput.addEventListener('input', handleEmailValidation);

  paymentMethodRadios.forEach(radio => {
    radio.addEventListener('change', updateSubmitButtonState);
  });

  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    handleEmailValidation(); // Final check

    if (!submitPaymentBtn.disabled && selectedProduct) {
      const email = emailInput.value;
      const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

      if (selectedPaymentMethod === 'paypal') {
        try {
          // Send POST request to payment API
          const response = await fetch('/api/pay', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              paymentMethod: selectedPaymentMethod,
              productName: selectedProduct.name,
              price: selectedProduct.price
            })
          });

          if (!response.ok) {
            throw new Error('Payment request failed');
          }

          const data = await response.json();
          
          // Redirect to PayPal approval URL
          if (data.approvalUrl) {
            window.location.href = data.approvalUrl;
          }
        } catch (error) {
          console.error('Payment error:', error);
          alert('Payment failed. Please try again.');
        }
      }
      // Add other payment methods here if needed
    }
  });

  // Initial state check
  updateSubmitButtonState();

  // Products dropdown (header)
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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllDropdowns();
  });

  // Modal logic
  const openModalButtons = document.querySelectorAll('.pricing-card__btn');
  const closeModalTriggers = modal?.querySelectorAll('[data-close]');

  let currentProduct = null;

  openModalButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Get product information from the pricing card
      const pricingCard = btn.closest('.pricing-card');
      const productName = pricingCard?.querySelector('.pricing-card__title')?.textContent;
      const productPrice = pricingCard?.querySelector('.pricing-card__amount')?.textContent;
      const productCurrency = pricingCard?.querySelector('.pricing-card__currency')?.textContent;

      // Store product info
      currentProduct = {
        name: productName,
        price: productPrice,
        currency: productCurrency
      };

      // Update modal with product info
      const productNameEl = document.getElementById('productName');
      const productPriceEl = document.getElementById('productPrice');
      
      if (productNameEl && currentProduct.name) {
        productNameEl.textContent = currentProduct.name;
      }
      
      if (productPriceEl && currentProduct.price) {
        productPriceEl.textContent = `${currentProduct.price} ${currentProduct.currency || ''}`;
      }

      modal?.classList.add('is-open');
      modal?.setAttribute('aria-hidden', 'false');
    });
  });
});

