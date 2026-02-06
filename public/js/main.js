document.addEventListener('DOMContentLoaded', () => {
  const buyNowBtn = document.getElementById('buyNowBtn');
  const modal = document.getElementById('paymentModal');
  const closeTriggers = modal.querySelectorAll('[data-close="true"]');
  const paymentForm = document.getElementById('paymentForm');
  const emailInput = document.getElementById('emailInput');
  const emailError = document.getElementById('emailError');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');

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

  buyNowBtn.addEventListener('click', openModal);

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

  paymentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleEmailValidation(); // Final check

    if (!submitPaymentBtn.disabled) {
      const email = emailInput.value;
      const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

      if (selectedPaymentMethod === 'paypal') {
        // Redirect to PayPal payment route with email
        window.location.href = `/api/paypal/pay?email=${encodeURIComponent(email)}`;
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
});

