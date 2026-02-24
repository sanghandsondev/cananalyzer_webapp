/**
 * Shared Authentication Module for CAN Analyzer
 * Used across all pages for login/register/logout functionality
 */
(function() {
  'use strict';

  // ========== Constants ==========
  const AUTH_TOKEN_KEY = 'auth_token';
  const USER_DATA_KEY = 'user_data';

  // ========== State ==========
  let currentUser = null;
  let authModal = null;
  let userMenuOpen = false;

  // ========== Utility Functions ==========
  const getToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
  const setToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token);
  const removeToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

  const getStoredUser = () => {
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  };
  const setStoredUser = (user) => localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  const removeStoredUser = () => localStorage.removeItem(USER_DATA_KEY);

  const getInitials = (username) => {
    return username ? username.substring(0, 2).toUpperCase() : 'U';
  };

  const isAdmin = (username) => username?.toLowerCase() === 'admin';

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // ========== Create Auth Modal HTML ==========
  const createAuthModal = () => {
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal auth-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal__overlay" data-close="true"></div>
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
        <div class="modal__header">
          <h3 id="authModalTitle" class="modal__title">Login</h3>
          <button type="button" class="modal__close" aria-label="Close" data-close="true">×</button>
        </div>
        <div class="modal__body">
          <!-- Success/Info Message -->
          <div class="auth-message" id="authMessage" style="display: none;"></div>

          <!-- Login Form -->
          <form id="loginForm" class="auth-form" novalidate>
            <div class="form-group">
              <label for="loginUsername">Username or Email<span class="required-mark">*</span></label>
              <input 
                type="text" 
                id="loginUsername" 
                name="username" 
                class="form-control" 
                placeholder="Enter username or email..." 
                required 
              />
              <div class="form-error" id="loginUsernameError">&nbsp;</div>
            </div>

            <div class="form-group">
              <label for="loginPassword">Password<span class="required-mark">*</span></label>
              <input 
                type="password" 
                id="loginPassword" 
                name="password" 
                class="form-control" 
                placeholder="Enter your password..." 
                required 
              />
              <div class="form-error" id="loginPasswordError">&nbsp;</div>
            </div>

            <div class="form-error form-error--general" id="loginGeneralError"></div>

            <div class="modal__footer">
              <button type="submit" class="btn btn--primary btn--full" id="loginSubmitBtn">
                Login
              </button>
            </div>

            <div class="auth-links">
              <button type="button" class="auth-link" id="showForgotPasswordBtn">Forgot Password?</button>
            </div>

            <div class="auth-switch">
              <span>Don't have an account?</span>
              <button type="button" class="auth-switch__link" id="showRegisterBtn">Sign Up</button>
            </div>
          </form>

          <!-- Register Form -->
          <form id="registerForm" class="auth-form" style="display: none;" novalidate>
            <div class="form-group">
              <label for="registerEmail">Email<span class="required-mark">*</span></label>
              <input 
                type="email" 
                id="registerEmail" 
                name="email" 
                class="form-control" 
                placeholder="Enter your email..." 
                required 
              />
              <div class="form-error" id="registerEmailError">&nbsp;</div>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="registerUsername">Username<span class="required-mark">*</span></label>
                <small class="form-hint-inline">3-50 characters</small>
              </div>
              <input 
                type="text" 
                id="registerUsername" 
                name="username" 
                class="form-control" 
                placeholder="Choose a username..." 
                required 
                minlength="3"
                maxlength="50"
              />
              <div class="form-error" id="registerUsernameError">&nbsp;</div>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="registerPassword">Password<span class="required-mark">*</span></label>
                <small class="form-hint-inline">Minimum 6 characters</small>
              </div>
              <input 
                type="password" 
                id="registerPassword" 
                name="password" 
                class="form-control" 
                placeholder="Choose a password..." 
                required 
                minlength="6"
              />
              <div class="form-error" id="registerPasswordError">&nbsp;</div>
            </div>

            <div class="form-group">
              <label for="registerConfirmPassword">Confirm Password<span class="required-mark">*</span></label>
              <input 
                type="password" 
                id="registerConfirmPassword" 
                name="confirmPassword" 
                class="form-control" 
                placeholder="Confirm your password..." 
                required 
              />
              <div class="form-error" id="registerConfirmPasswordError">&nbsp;</div>
            </div>

            <div class="form-error form-error--general" id="registerGeneralError"></div>

            <div class="modal__footer">
              <button type="submit" class="btn btn--primary btn--full" id="registerSubmitBtn">
                Sign Up
              </button>
            </div>

            <div class="auth-switch">
              <span>Already have an account?</span>
              <button type="button" class="auth-switch__link" id="showLoginBtn">Login</button>
            </div>
          </form>

          <!-- Forgot Password Form -->
          <form id="forgotPasswordForm" class="auth-form" style="display: none;" novalidate>
            <p class="form-description">Enter your email address and we'll send you a link to reset your password.</p>
            
            <div class="form-group">
              <label for="forgotEmail">Email<span class="required-mark">*</span></label>
              <input 
                type="email" 
                id="forgotEmail" 
                name="email" 
                class="form-control" 
                placeholder="Enter your email..." 
                required 
              />
              <div class="form-error" id="forgotEmailError">&nbsp;</div>
            </div>

            <div class="form-error form-error--general" id="forgotGeneralError"></div>

            <div class="modal__footer">
              <button type="submit" class="btn btn--primary btn--full" id="forgotSubmitBtn">
                Send
              </button>
            </div>

            <div class="auth-switch">
              <button type="button" class="auth-switch__link" id="backToLoginBtn">← Back to Login</button>
            </div>
          </form>

          <!-- Change Password Form (when logged in) -->
          <form id="changePasswordForm" class="auth-form" style="display: none;" novalidate>
            <div class="form-group">
              <label for="currentPassword">Current Password<span class="required-mark">*</span></label>
              <input 
                type="password" 
                id="currentPassword" 
                name="currentPassword" 
                class="form-control" 
                placeholder="Enter current password..." 
                required 
              />
              <div class="form-error" id="currentPasswordError">&nbsp;</div>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="newPassword">New Password<span class="required-mark">*</span></label>
                <small class="form-hint-inline">Minimum 6 characters</small>
              </div>
              <input 
                type="password" 
                id="newPassword" 
                name="newPassword" 
                class="form-control" 
                placeholder="Enter new password..." 
                required 
                minlength="6"
              />
              <div class="form-error" id="newPasswordError">&nbsp;</div>
            </div>

            <div class="form-group">
              <label for="confirmNewPassword">Confirm New Password<span class="required-mark">*</span></label>
              <input 
                type="password" 
                id="confirmNewPassword" 
                name="confirmNewPassword" 
                class="form-control" 
                placeholder="Confirm new password..." 
                required 
              />
              <div class="form-error" id="confirmNewPasswordError">&nbsp;</div>
            </div>

            <div class="form-error form-error--general" id="changePasswordGeneralError"></div>

            <div class="modal__footer">
              <button type="submit" class="btn btn--primary btn--full" id="changePasswordSubmitBtn">
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  // ========== Auth UI Functions ==========
  const updateAuthUI = () => {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    if (currentUser) {
      const isUserAdmin = isAdmin(currentUser.username);
      const avatarClass = isUserAdmin ? 'user-avatar user-avatar--admin' : 'user-avatar';
      
      authSection.innerHTML = `
        <div class="user-menu-container">
          <button type="button" class="user-menu-trigger" id="userMenuTrigger">
            <div class="${avatarClass}">${getInitials(currentUser.username)}</div>
            <span class="user-name">${currentUser.username}</span>
            <i class="fa-solid fa-chevron-down user-menu-caret"></i>
          </button>
          <div class="user-menu" id="userMenu">
            <div class="user-menu__header">
              <div class="user-menu__email">${currentUser.email || ''}</div>
            </div>
            <div class="user-menu__divider"></div>
            <a href="/my-licenses" class="user-menu__item">
              <i class="fa-solid fa-key"></i>
              My Licenses
            </a>
            <button type="button" class="user-menu__item" id="changePasswordBtn">
              <i class="fa-solid fa-lock"></i>
              Change Password
            </button>
            <div class="user-menu__divider"></div>
            <button type="button" class="user-menu__item user-menu__item--danger" id="logoutBtn">
              <i class="fa-solid fa-right-from-bracket"></i>
              Logout
            </button>
          </div>
        </div>
      `;

      // Add event listeners
      const userMenuTrigger = document.getElementById('userMenuTrigger');
      const userMenu = document.getElementById('userMenu');
      
      userMenuTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuOpen = !userMenuOpen;
        userMenu.classList.toggle('is-open', userMenuOpen);
      });

      document.addEventListener('click', () => {
        if (userMenuOpen) {
          userMenuOpen = false;
          userMenu?.classList.remove('is-open');
        }
      });

      document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
        userMenuOpen = false;
        userMenu?.classList.remove('is-open');
        openChangePasswordModal();
      });

      document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    } else {
      authSection.innerHTML = `
        <button type="button" class="btn-auth btn-auth--login" id="loginBtn">
          <i class="fa-solid fa-right-to-bracket"></i>
          Login
        </button>
      `;

      document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
    }

    authSection.style.visibility = 'visible';
  };

  // ========== Modal Functions ==========
  const openAuthModal = (view = 'login') => {
    if (!authModal) {
      authModal = createAuthModal();
      setupModalListeners();
    }
    
    authModal.classList.add('is-open');
    authModal.setAttribute('aria-hidden', 'false');
    
    hideAllForms();
    clearFormErrors();
    hideAuthMessage();

    switch (view) {
      case 'register':
        showRegisterForm();
        break;
      case 'forgot':
        showForgotPasswordForm();
        break;
      case 'change':
        showChangePasswordForm();
        break;
      default:
        showLoginForm();
    }
  };

  const closeAuthModal = () => {
    if (!authModal) return;
    
    authModal.classList.remove('is-open');
    authModal.setAttribute('aria-hidden', 'true');
    
    clearFormErrors();
    hideAuthMessage();
    resetForms();
  };

  const openChangePasswordModal = () => {
    openAuthModal('change');
  };

  const hideAllForms = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
  };

  const showLoginForm = () => {
    hideAllForms();
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Login';
  };

  const showRegisterForm = () => {
    hideAllForms();
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Sign Up';
  };

  const showForgotPasswordForm = () => {
    hideAllForms();
    document.getElementById('forgotPasswordForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Forgot Password';
  };

  const showChangePasswordForm = () => {
    hideAllForms();
    document.getElementById('changePasswordForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Change Password';
  };

  const showAuthMessage = (message, type = 'success') => {
    const messageEl = document.getElementById('authMessage');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `auth-message auth-message--${type}`;
      messageEl.style.display = 'block';
    }
  };

  const hideAuthMessage = () => {
    const messageEl = document.getElementById('authMessage');
    if (messageEl) {
      messageEl.style.display = 'none';
    }
  };

  const clearFormErrors = () => {
    document.querySelectorAll('.form-error').forEach(el => {
      if (el.classList.contains('form-error--general')) {
        el.textContent = '';
      } else {
        el.innerHTML = '&nbsp;';
      }
    });
  };

  const resetForms = () => {
    document.getElementById('loginForm')?.reset();
    document.getElementById('registerForm')?.reset();
    document.getElementById('forgotPasswordForm')?.reset();
    document.getElementById('changePasswordForm')?.reset();
  };

  // ========== Setup Modal Listeners ==========
  const setupModalListeners = () => {
    // Close triggers
    authModal.querySelectorAll('[data-close="true"]').forEach(trigger => {
      trigger.addEventListener('click', closeAuthModal);
    });

    // Form switching
    document.getElementById('showRegisterBtn')?.addEventListener('click', () => {
      clearFormErrors();
      hideAuthMessage();
      showRegisterForm();
    });
    
    document.getElementById('showLoginBtn')?.addEventListener('click', () => {
      clearFormErrors();
      hideAuthMessage();
      showLoginForm();
    });
    
    document.getElementById('showForgotPasswordBtn')?.addEventListener('click', () => {
      clearFormErrors();
      hideAuthMessage();
      showForgotPasswordForm();
    });
    
    document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
      clearFormErrors();
      hideAuthMessage();
      showLoginForm();
    });

    // Form submissions
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
    document.getElementById('changePasswordForm')?.addEventListener('submit', handleChangePassword);

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && authModal?.classList.contains('is-open')) {
        closeAuthModal();
      }
    });
  };

  // ========== Auth Handlers ==========
  const handleLogin = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const usernameOrEmail = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    let hasError = false;

    if (!usernameOrEmail) {
      document.getElementById('loginUsernameError').textContent = 'Username or email is required';
      hasError = true;
    }

    if (!password) {
      document.getElementById('loginPasswordError').textContent = 'Password is required';
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = document.getElementById('loginSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, password })
      });

      const data = await response.json();

      if (!response.ok) {
        document.getElementById('loginGeneralError').textContent = data.error || 'Login failed';
        return;
      }

      setToken(data.token);
      setStoredUser(data.user);
      window.location.reload();
    } catch (error) {
      console.error('Login error:', error);
      document.getElementById('loginGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearFormErrors();
    hideAuthMessage();

    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    let hasError = false;

    if (!username) {
      document.getElementById('registerUsernameError').textContent = 'Username is required';
      hasError = true;
    } else if (username.length < 3) {
      document.getElementById('registerUsernameError').textContent = 'Username must be at least 3 characters';
      hasError = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      document.getElementById('registerUsernameError').textContent = 'Username can only contain letters, numbers, and underscores';
      hasError = true;
    }

    if (!email) {
      document.getElementById('registerEmailError').textContent = 'Email is required';
      hasError = true;
    } else if (!validateEmail(email)) {
      document.getElementById('registerEmailError').textContent = 'Please enter a valid email address';
      hasError = true;
    }

    if (!password) {
      document.getElementById('registerPasswordError').textContent = 'Password is required';
      hasError = true;
    } else if (password.length < 6) {
      document.getElementById('registerPasswordError').textContent = 'Password must be at least 6 characters';
      hasError = true;
    }

    if (!confirmPassword) {
      document.getElementById('registerConfirmPasswordError').textContent = 'Please confirm your password';
      hasError = true;
    } else if (password !== confirmPassword) {
      document.getElementById('registerConfirmPasswordError').textContent = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = document.getElementById('registerSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        document.getElementById('registerGeneralError').textContent = data.error || 'Registration failed';
        return;
      }

      // Show success message
      hideAllForms();
      showAuthMessage(`Verification email sent to ${email}. Please check your inbox and click the link to complete registration. The link expires in 5 minutes.\n\n⚠️ If you don't see the email, please check your Spam/Junk folder.`, 'success');
      document.getElementById('authModalTitle').textContent = 'Check Your Email';
    } catch (error) {
      console.error('Register error:', error);
      document.getElementById('registerGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearFormErrors();
    hideAuthMessage();

    const email = document.getElementById('forgotEmail').value.trim();

    if (!email) {
      document.getElementById('forgotEmailError').textContent = 'Email is required';
      return;
    }

    if (!validateEmail(email)) {
      document.getElementById('forgotEmailError').textContent = 'Please enter a valid email address';
      return;
    }

    const submitBtn = document.getElementById('forgotSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      // Show success message regardless (don't reveal if email exists)
      hideAllForms();
      showAuthMessage(`If an account exists with ${email}, you will receive a password reset link. The link expires in 5 minutes.\n\n⚠️ If you don't see the email, please check your Spam/Junk folder.`, 'success');
      document.getElementById('authModalTitle').textContent = 'Check Your Email';
    } catch (error) {
      console.error('Forgot password error:', error);
      document.getElementById('forgotGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    let hasError = false;

    if (!currentPassword) {
      document.getElementById('currentPasswordError').textContent = 'Current password is required';
      hasError = true;
    }

    if (!newPassword) {
      document.getElementById('newPasswordError').textContent = 'New password is required';
      hasError = true;
    } else if (newPassword.length < 6) {
      document.getElementById('newPasswordError').textContent = 'Password must be at least 6 characters';
      hasError = true;
    }

    if (!confirmNewPassword) {
      document.getElementById('confirmNewPasswordError').textContent = 'Please confirm your new password';
      hasError = true;
    } else if (newPassword !== confirmNewPassword) {
      document.getElementById('confirmNewPasswordError').textContent = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = document.getElementById('changePasswordSubmitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        document.getElementById('changePasswordGeneralError').textContent = data.error || 'Failed to change password';
        return;
      }

      hideAllForms();
      showAuthMessage('Password changed successfully!', 'success');
      document.getElementById('authModalTitle').textContent = 'Success';
      
      setTimeout(() => {
        closeAuthModal();
      }, 2000);
    } catch (error) {
      console.error('Change password error:', error);
      document.getElementById('changePasswordGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const handleLogout = () => {
    removeToken();
    removeStoredUser();
    currentUser = null;
    window.location.reload();
  };

  // ========== Token Verification ==========
  const verifyToken = async () => {
    const token = getToken();
    if (!token) {
      currentUser = null;
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        setStoredUser(data.user);
      } else {
        removeToken();
        removeStoredUser();
        currentUser = null;
      }
    } catch (error) {
      console.error('Token verification error:', error);
      currentUser = getStoredUser();
    }
  };

  // ========== Initialize ==========
  let authReady = false;
  let authReadyResolvers = [];

  const init = async () => {
    await verifyToken();
    updateAuthUI();
    
    // Mark auth as ready and resolve all waiting promises
    authReady = true;
    authReadyResolvers.forEach(resolve => resolve());
    authReadyResolvers = [];
    
    // Dispatch custom event for other scripts
    window.dispatchEvent(new CustomEvent('authReady', { detail: { user: currentUser } }));
  };

  // Wait for auth to be ready
  const waitForAuth = () => {
    if (authReady) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      authReadyResolvers.push(resolve);
    });
  };

  // ========== Public API ==========
  window.CAN_Auth = {
    init,
    waitForAuth,
    openAuthModal,
    closeAuthModal,
    getCurrentUser: () => currentUser,
    getToken,
    isLoggedIn: () => !!currentUser,
    isAdmin: () => currentUser && isAdmin(currentUser.username),
    onAuthRequired: (callback) => {
      if (!currentUser) {
        openAuthModal('login');
        return false;
      }
      return true;
    }
  };

  // Auto-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
