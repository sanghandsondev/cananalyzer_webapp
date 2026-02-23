document.addEventListener('DOMContentLoaded', () => {
  // ========== Constants ==========
  const AUTH_TOKEN_KEY = 'auth_token';
  const USER_DATA_KEY = 'user_data';
  const COMMENTS_PER_PAGE = 10;

  // ========== DOM Elements ==========
  const authSection = document.getElementById('authSection');
  const loginBtn = document.getElementById('loginBtn');
  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const closeTriggers = authModal?.querySelectorAll('[data-close="true"]');

  const commentInput = document.getElementById('commentInput');
  const submitCommentBtn = document.getElementById('submitCommentBtn');
  const commentsList = document.getElementById('commentsList');
  const commentsCount = document.getElementById('commentsCount');
  const commentsLoading = document.getElementById('commentsLoading');
  const commentsEmpty = document.getElementById('commentsEmpty');
  const loadMoreSection = document.getElementById('loadMoreSection');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  // ========== State ==========
  let currentUser = null;
  let commentsPage = 0;
  let hasMoreComments = true;
  let isLoadingComments = false;

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

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // ========== Auth UI Functions ==========
  const isAdmin = (username) => username?.toLowerCase() === 'admin';
  
  const updateAuthUI = () => {
    if (!authSection) return;

    if (currentUser) {
      const isUserAdmin = isAdmin(currentUser.username);
      const avatarClass = isUserAdmin ? 'user-avatar user-avatar--admin' : 'user-avatar';
      
      authSection.innerHTML = `
        <div class="user-info">
          <div class="${avatarClass}">${getInitials(currentUser.username)}</div>
          <span class="user-name">${currentUser.username}</span>
        </div>
        <button type="button" class="btn-auth btn-auth--logout" id="logoutBtn">
          <i class="fa-solid fa-right-from-bracket"></i>
          Logout
        </button>
      `;

      // Add logout listener
      document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
      
      // Update comment input avatar with user initials
      const commentInputAvatar = document.getElementById('commentInputAvatar');
      if (commentInputAvatar) {
        commentInputAvatar.innerHTML = getInitials(currentUser.username);
        commentInputAvatar.classList.remove('comment-avatar--user', 'comment-avatar--admin');
        commentInputAvatar.classList.add(isUserAdmin ? 'comment-avatar--admin' : 'comment-avatar--user');
      }
    } else {
      authSection.innerHTML = `
        <button type="button" class="btn-auth btn-auth--login" id="loginBtn">
          <i class="fa-solid fa-right-to-bracket"></i>
          Login
        </button>
      `;

      // Add login listener - explicitly pass false to show login form
      document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal(false));
      
      // Reset comment input avatar to default icon
      const commentInputAvatar = document.getElementById('commentInputAvatar');
      if (commentInputAvatar) {
        commentInputAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        commentInputAvatar.classList.remove('comment-avatar--user', 'comment-avatar--admin');
      }
    }

    // Show auth section after content is ready
    authSection.style.visibility = 'visible';
    
    updateCommentInputState();
  };

  const MAX_COMMENT_LENGTH = 500;

  const updateCommentInputState = () => {
    if (!commentInput || !submitCommentBtn) return;

    const content = commentInput.value;
    const length = content.length;
    const hasContent = content.trim().length > 0;
    
    // Update character counter
    const charCounter = document.getElementById('charCounter');
    if (charCounter) {
      charCounter.textContent = `${length}/${MAX_COMMENT_LENGTH}`;
      charCounter.classList.remove('char-counter--warning', 'char-counter--error');
      
      if (length >= MAX_COMMENT_LENGTH) {
        charCounter.classList.add('char-counter--error');
      } else if (length >= MAX_COMMENT_LENGTH * 0.8) {
        charCounter.classList.add('char-counter--warning');
      }
    }
    
    submitCommentBtn.disabled = !hasContent || !currentUser || length > MAX_COMMENT_LENGTH;
  };

  // ========== Modal Functions ==========
  const openAuthModal = (showRegister = false) => {
    if (!authModal) return;
    
    authModal.classList.add('is-open');
    authModal.setAttribute('aria-hidden', 'false');
    
    if (showRegister) {
      showRegisterForm();
    } else {
      showLoginForm();
    }
  };

  const closeAuthModal = () => {
    if (!authModal) return;
    
    authModal.classList.remove('is-open');
    authModal.setAttribute('aria-hidden', 'true');
    
    // Reset forms
    loginForm?.reset();
    registerForm?.reset();
    clearFormErrors();
  };

  const showLoginForm = () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    authModalTitle.textContent = 'Login';
    clearFormErrors();
  };

  const showRegisterForm = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authModalTitle.textContent = 'Sign Up';
    clearFormErrors();
  };

  const clearFormErrors = () => {
    document.querySelectorAll('.form-error').forEach(el => {
      // Keep the space to maintain height, except for general error
      if (el.classList.contains('form-error--general')) {
        el.textContent = '';
      } else {
        el.innerHTML = '&nbsp;';
      }
    });
  };

  // ========== Auth Functions ==========
  const handleLogin = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validation
    let hasError = false;

    if (!username) {
      document.getElementById('loginUsernameError').textContent = 'Username is required';
      hasError = true;
    } else if (username.length < 3) {
      document.getElementById('loginUsernameError').textContent = 'Username must be at least 3 characters';
      hasError = true;
    }

    if (!password) {
      document.getElementById('loginPasswordError').textContent = 'Password is required';
      hasError = true;
    } else if (password.length < 6) {
      document.getElementById('loginPasswordError').textContent = 'Password must be at least 6 characters';
      hasError = true;
    }

    if (hasError) return;

    // Show loading state
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const originalBtnText = loginSubmitBtn.innerHTML;
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        document.getElementById('loginGeneralError').textContent = data.error || 'Login failed';
        return;
      }

      // Success - save token and reload page
      setToken(data.token);
      setStoredUser(data.user);
      window.location.href = '/feedback';
    } catch (error) {
      console.error('Login error:', error);
      document.getElementById('loginGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      // Restore button state
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = originalBtnText;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validation
    let hasError = false;

    if (!username) {
      document.getElementById('registerUsernameError').textContent = 'Username is required';
      hasError = true;
    } else if (username.length < 3) {
      document.getElementById('registerUsernameError').textContent = 'Username must be at least 3 characters';
      hasError = true;
    } else if (username.length > 50) {
      document.getElementById('registerUsernameError').textContent = 'Username must be at most 50 characters';
      hasError = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      document.getElementById('registerUsernameError').textContent = 'Username can only contain letters, numbers, and underscores';
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

    // Show loading state
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    const originalBtnText = registerSubmitBtn.innerHTML;
    registerSubmitBtn.disabled = true;
    registerSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        document.getElementById('registerGeneralError').textContent = data.error || 'Registration failed';
        return;
      }

      // Success - save token and reload page
      setToken(data.token);
      setStoredUser(data.user);
      window.location.href = '/feedback';
    } catch (error) {
      console.error('Register error:', error);
      document.getElementById('registerGeneralError').textContent = 'An error occurred. Please try again.';
    } finally {
      // Restore button state
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.innerHTML = originalBtnText;
    }
  };

  const handleLogout = () => {
    removeToken();
    removeStoredUser();
    currentUser = null;
    // Reload the page to reset state
    window.location.href = '/feedback';
  };

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
        // Token invalid
        removeToken();
        removeStoredUser();
        currentUser = null;
      }
    } catch (error) {
      console.error('Token verification error:', error);
      currentUser = getStoredUser();
    }
  };

  // ========== Comments Functions ==========
  const loadComments = async (reset = false) => {
    if (isLoadingComments || (!reset && !hasMoreComments)) return;

    isLoadingComments = true;

    if (reset) {
      commentsPage = 0;
      hasMoreComments = true;
      // Clear existing comments but keep loading indicator
      const existingComments = commentsList.querySelectorAll('.comment-item');
      existingComments.forEach(el => el.remove());
    }

    commentsLoading.style.display = 'block';
    commentsEmpty.style.display = 'none';

    try {
      const response = await fetch(`/api/comments?page=${commentsPage}&limit=${COMMENTS_PER_PAGE}`);
      const data = await response.json();

      commentsLoading.style.display = 'none';

      if (!response.ok) {
        console.error('Failed to load comments:', data.error);
        return;
      }

      const { comments, total, hasMore } = data;
      hasMoreComments = hasMore;

      // Update count
      commentsCount.textContent = `(${total})`;

      if (comments.length === 0 && commentsPage === 0) {
        commentsEmpty.style.display = 'block';
      } else {
        commentsEmpty.style.display = 'none';
        
        // Render comments - append to comments list
        comments.forEach(comment => {
          const commentEl = createCommentElement(comment);
          commentsList.appendChild(commentEl);
        });
      }

      // Show/hide see more link
      loadMoreSection.style.display = hasMore ? 'block' : 'none';

      commentsPage++;
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsLoading.style.display = 'none';
    } finally {
      isLoadingComments = false;
    }
  };

  const createCommentElement = (comment) => {
    const isCommentAdmin = isAdmin(comment.username);
    const avatarClass = isCommentAdmin ? 'comment-avatar--admin' : 'comment-avatar--user';
    const usernameClass = isCommentAdmin ? 'comment-username comment-username--admin' : 'comment-username';
    
    // Check if current user can edit (owner only) or delete (admin only)
    const canEdit = currentUser && currentUser.id === comment.user_id;
    const canDelete = currentUser && isAdmin(currentUser.username);
    const isEdited = comment.updated_at !== null;
    
    // Build time display - always show created_at, add (Edited) tag if edited
    let timeDisplay = formatTime(comment.created_at);
    if (isEdited) {
      timeDisplay += ' <span class="comment-edited">(Edited)</span>';
    }
    
    // Build actions
    let actionsHtml = '';
    if (canEdit || canDelete) {
      actionsHtml = '<div class="comment-actions">';
      if (canEdit) {
        actionsHtml += `<button class="comment-action-btn comment-edit-btn" data-id="${comment.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>`;
      }
      if (canDelete) {
        actionsHtml += `<button class="comment-action-btn comment-delete-btn" data-id="${comment.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
      }
      actionsHtml += '</div>';
    }
    
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment.id;
    div.innerHTML = `
      <div class="comment-avatar comment-avatar--small ${avatarClass}">
        ${getInitials(comment.username)}
      </div>
      <div class="comment-content">
        <div class="comment-header">
          <span class="${usernameClass}">${escapeHtml(comment.username)}</span>
          <span class="comment-time">${timeDisplay}</span>
          ${actionsHtml}
        </div>
        <p class="comment-text">${escapeHtml(comment.content)}</p>
      </div>
    `;
    
    // Add event listeners for edit/delete buttons
    if (canEdit) {
      div.querySelector('.comment-edit-btn')?.addEventListener('click', () => openEditModal(comment));
    }
    if (canDelete) {
      div.querySelector('.comment-delete-btn')?.addEventListener('click', () => openDeleteModal(comment.id));
    }
    
    return div;
  };

  // ========== Edit/Delete Modal Functions ==========
  let editingCommentId = null;
  let editingComment = null; // Store full comment object for UI update
  let deletingCommentId = null;

  const createEditModal = () => {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__overlay" data-close="true"></div>
      <div class="modal__dialog modal__dialog--large" role="dialog" aria-modal="true">
        <div class="modal__header">
          <h3 class="modal__title">Edit Comment</h3>
          <button type="button" class="modal__close" aria-label="Close" data-close="true">×</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <textarea id="editCommentInput" class="comment-textarea" rows="4" maxlength="${MAX_COMMENT_LENGTH}"></textarea>
          </div>
          <div class="edit-char-counter">
            <span id="editCharCounter">0/${MAX_COMMENT_LENGTH}</span>
          </div>
        </div>
        <div class="modal__footer modal__footer--actions">
          <button type="button" class="btn btn--secondary" id="editCancelBtn">Cancel</button>
          <button type="button" class="btn btn--primary" id="editSaveBtn">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll('[data-close="true"]').forEach(el => {
      el.addEventListener('click', closeEditModal);
    });
    document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
    document.getElementById('editSaveBtn').addEventListener('click', saveEditedComment);
    document.getElementById('editCommentInput').addEventListener('input', updateEditCharCounter);

    return modal;
  };

  const createDeleteModal = () => {
    const modal = document.createElement('div');
    modal.id = 'deleteModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__overlay" data-close="true"></div>
      <div class="modal__dialog modal__dialog--small" role="dialog" aria-modal="true">
        <div class="modal__header">
          <h3 class="modal__title">Delete Comment</h3>
          <button type="button" class="modal__close" aria-label="Close" data-close="true">×</button>
        </div>
        <div class="modal__body">
          <p class="confirm-text">Are you sure you want to delete this comment? This action cannot be undone.</p>
        </div>
        <div class="modal__footer modal__footer--actions">
          <button type="button" class="btn btn--secondary" id="deleteCancelBtn">Cancel</button>
          <button type="button" class="btn btn--danger" id="deleteConfirmBtn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll('[data-close="true"]').forEach(el => {
      el.addEventListener('click', closeDeleteModal);
    });
    document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDeleteComment);

    return modal;
  };

  const openEditModal = (comment) => {
    let modal = document.getElementById('editModal');
    if (!modal) {
      modal = createEditModal();
    }
    
    editingCommentId = comment.id;
    editingComment = comment; // Store full comment for later update
    const textarea = document.getElementById('editCommentInput');
    textarea.value = comment.content;
    updateEditCharCounter();
    
    modal.classList.add('is-open');
    textarea.focus();
  };

  const closeEditModal = () => {
    const modal = document.getElementById('editModal');
    if (modal) {
      modal.classList.remove('is-open');
      editingCommentId = null;
      editingComment = null;
    }
  };

  const updateEditCharCounter = () => {
    const textarea = document.getElementById('editCommentInput');
    const counter = document.getElementById('editCharCounter');
    if (textarea && counter) {
      const length = textarea.value.length;
      counter.textContent = `${length}/${MAX_COMMENT_LENGTH}`;
      counter.className = '';
      if (length >= MAX_COMMENT_LENGTH) {
        counter.classList.add('char-counter--error');
      } else if (length >= MAX_COMMENT_LENGTH * 0.8) {
        counter.classList.add('char-counter--warning');
      }
    }
  };

  const saveEditedComment = async () => {
    const textarea = document.getElementById('editCommentInput');
    const content = textarea.value.trim();

    if (!content) {
      alert('Comment cannot be empty');
      return;
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      alert(`Comment is too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    await updateComment(editingCommentId, content);
  };

  const openDeleteModal = (commentId) => {
    let modal = document.getElementById('deleteModal');
    if (!modal) {
      modal = createDeleteModal();
    }
    
    deletingCommentId = commentId;
    modal.classList.add('is-open');
  };

  const closeDeleteModal = () => {
    const modal = document.getElementById('deleteModal');
    if (modal) {
      modal.classList.remove('is-open');
      deletingCommentId = null;
    }
  };

  const confirmDeleteComment = async () => {
    if (deletingCommentId) {
      await deleteComment(deletingCommentId);
    }
  };

  const updateComment = async (commentId, content) => {
    const token = getToken();
    if (!token) return;

    const saveBtn = document.getElementById('editSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to update comment');
        return;
      }

      const data = await response.json();
      
      // Update UI directly without reload
      const commentEl = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
      if (commentEl) {
        // Update the comment text
        const commentText = commentEl.querySelector('.comment-text');
        if (commentText) {
          commentText.textContent = content;
        }
        
        // Add (Edited) tag if not already present
        const commentTime = commentEl.querySelector('.comment-time');
        if (commentTime && !commentTime.querySelector('.comment-edited')) {
          commentTime.innerHTML = formatTime(editingComment.created_at) + ' <span class="comment-edited">(Edited)</span>';
        }
        
        // Update stored comment data for future edits
        if (editingComment) {
          editingComment.content = content;
          editingComment.updated_at = data.comment?.updated_at || new Date().toISOString();
        }
      }
      
      closeEditModal();
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('An error occurred. Please try again.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save';
      }
    }
  };

  const deleteComment = async (commentId) => {
    const token = getToken();
    if (!token) return;

    const confirmBtn = document.getElementById('deleteConfirmBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to delete comment');
        return;
      }

      // Update UI directly without reload
      const commentEl = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
      if (commentEl) {
        // Animate removal
        commentEl.style.transition = 'opacity 0.3s, transform 0.3s';
        commentEl.style.opacity = '0';
        commentEl.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
          commentEl.remove();
          
          // Update comment count
          const currentCount = parseInt(commentsCount.textContent.replace(/[()]/g, '')) || 0;
          commentsCount.textContent = `(${Math.max(0, currentCount - 1)})`;
          
          // Show empty message if no comments left
          const remainingComments = commentsList.querySelectorAll('.comment-item');
          if (remainingComments.length === 0) {
            commentsEmpty.style.display = 'block';
          }
        }, 300);
      }
      
      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('An error occurred. Please try again.');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Delete';
      }
    }
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const submitComment = async () => {
    const content = commentInput.value.trim();
    if (!content || !currentUser) return;

    const token = getToken();
    if (!token) {
      openAuthModal();
      return;
    }

    submitCommentBtn.disabled = true;
    submitCommentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to submit comment');
        return;
      }

      // Clear input and reload page to sync comments
      commentInput.value = '';
      window.location.href = '/feedback';
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('An error occurred. Please try again.');
    } finally {
      submitCommentBtn.disabled = false;
      submitCommentBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Feedback';
      updateCommentInputState();
    }
  };

  // ========== Event Listeners ==========
  
  // Auth modal triggers
  loginBtn?.addEventListener('click', () => openAuthModal(false));
  
  closeTriggers?.forEach(trigger => {
    trigger.addEventListener('click', closeAuthModal);
  });

  // Switch between login/register
  showRegisterBtn?.addEventListener('click', showRegisterForm);
  showLoginBtn?.addEventListener('click', showLoginForm);

  // Form submissions
  loginForm?.addEventListener('submit', handleLogin);
  registerForm?.addEventListener('submit', handleRegister);

  // Comment input
  commentInput?.addEventListener('input', updateCommentInputState);
  
  commentInput?.addEventListener('focus', () => {
    if (!currentUser) {
      openAuthModal();
    }
  });

  submitCommentBtn?.addEventListener('click', submitComment);

  // Load more comments
  loadMoreBtn?.addEventListener('click', () => loadComments(false));

  // Escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal?.classList.contains('is-open')) {
      closeAuthModal();
    }
  });

  // ========== Initialize ==========
  const init = async () => {
    // Check for existing token
    await verifyToken();
    updateAuthUI();
    
    // Load comments
    await loadComments(true);
  };

  init();
});
