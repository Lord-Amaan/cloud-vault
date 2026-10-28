// State management
let authToken = localStorage.getItem('vault_token') || null;
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('vault_user'));
} catch (e) {
  currentUser = null;
}
let authMode = 'login'; // 'login' or 'register'
let selectedFile = null;

// DOM Elements
const healthBadge = document.getElementById('healthBadge');
const userNav = document.getElementById('userNav');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const authCard = document.getElementById('authCard');
const uploadCard = document.getElementById('uploadCard');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authForm = document.getElementById('authForm');
const nameGroup = document.getElementById('nameGroup');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');

const uploadForm = document.getElementById('uploadForm');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const selectedFileInfo = document.getElementById('selectedFileInfo');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileSize = document.getElementById('selectedFileSize');
const uploadBtn = document.getElementById('uploadBtn');

const authPromptPlaceholder = document.getElementById('authPromptPlaceholder');
const fileListContainer = document.getElementById('fileListContainer');
const noFilesPlaceholder = document.getElementById('noFilesPlaceholder');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');

const kpiFileCount = document.getElementById('kpiFileCount');
const kpiStorageUsed = document.getElementById('kpiStorageUsed');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Helper: Show Toast
function showToast(message, isError = false) {
  toastMessage.textContent = message;
  toast.style.borderColor = isError ? 'var(--danger)' : 'var(--ink)';
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

// Format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check Cloud Health
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'UP') {
      healthBadge.textContent = 'System: Online';
      healthBadge.className = 'badge badge-mint mono';
    } else {
      healthBadge.textContent = `Status: ${data.status}`;
      healthBadge.className = 'badge badge-butter mono';
    }
  } catch (err) {
    healthBadge.textContent = 'System: Offline';
    healthBadge.className = 'badge badge-coral mono';
  }
}

// Update UI based on Auth State
function updateAuthUI() {
  if (authToken && currentUser) {
    userNav.style.display = 'flex';
    userNameDisplay.textContent = currentUser.name || currentUser.email;
    authCard.style.display = 'none';
    uploadCard.style.display = 'block';
    authPromptPlaceholder.style.display = 'none';
    fetchFiles();
  } else {
    userNav.style.display = 'none';
    authCard.style.display = 'block';
    uploadCard.style.display = 'none';
    authPromptPlaceholder.style.display = 'block';
    fileListContainer.style.display = 'none';
    noFilesPlaceholder.style.display = 'none';
    kpiFileCount.textContent = '0';
    kpiStorageUsed.textContent = '0 KB';
  }
}

// Tab Switching
tabLogin.addEventListener('click', () => {
  authMode = 'login';
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  nameGroup.style.display = 'none';
  authSubmitBtn.textContent = 'Log In to Vault';
});

tabRegister.addEventListener('click', () => {
  authMode = 'register';
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  nameGroup.style.display = 'block';
  authSubmitBtn.textContent = 'Create Vault Account';
});

// Auth Form Submit
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const name = authName.value.trim();

  const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const payload = authMode === 'register' ? { name, email, password } : { email, password };

  try {
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Processing...';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Authentication failed');
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('vault_token', authToken);
    localStorage.setItem('vault_user', JSON.stringify(currentUser));

    showToast(authMode === 'register' ? 'Registered & logged in!' : 'Welcome back!');
    authForm.reset();
    updateAuthUI();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === 'register' ? 'Create Vault Account' : 'Log In to Vault';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('vault_token');
  localStorage.removeItem('vault_user');
  updateAuthUI();
  showToast('Logged out.');
});

// Drag & Drop File Handling
dropzone.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(name => {
  dropzone.addEventListener(name, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFileSelected(fileInput.files[0]);
  }
});

function handleFileSelected(file) {
  selectedFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = formatBytes(file.size);
  selectedFileInfo.style.display = 'block';
  uploadBtn.disabled = false;
}

// File Upload Form Submit
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Streaming to Azure Blob...';

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'File upload failed');
    }

    showToast(`"${data.file.originalName}" uploaded!`);
    selectedFile = null;
    fileInput.value = '';
    selectedFileInfo.style.display = 'none';
    uploadBtn.disabled = true;
    fetchFiles();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    uploadBtn.textContent = 'Upload to Azure Blob';
  }
});

// Fetch user's files from vault
async function fetchFiles() {
  if (!authToken) return;

  try {
    refreshFilesBtn.textContent = 'Loading...';
    const res = await fetch('/api/files', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.status === 401) {
      logoutBtn.click();
      return;
    }

    const data = await res.json();
    const files = data.files || [];

    kpiFileCount.textContent = files.length;
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    kpiStorageUsed.textContent = formatBytes(totalBytes);

    if (files.length === 0) {
      fileListContainer.style.display = 'none';
      noFilesPlaceholder.style.display = 'block';
    } else {
      noFilesPlaceholder.style.display = 'none';
      fileListContainer.style.display = 'flex';
      renderFileList(files);
    }
  } catch (err) {
    showToast('Failed to load files', true);
  } finally {
    refreshFilesBtn.textContent = 'Refresh';
  }
}

// Render Files with SAS download buttons
function renderFileList(files) {
  fileListContainer.innerHTML = '';

  files.forEach((file) => {
    const ext = file.originalName.split('.').pop().toUpperCase().slice(0, 4);
    const row = document.createElement('div');
    row.className = 'file-row';

    row.innerHTML = `
      <div class="file-info">
        <div class="file-icon feature-sky mono">${ext || 'FILE'}</div>
        <div class="file-meta">
          <div class="file-name" title="${file.originalName}">${file.originalName}</div>
          <div class="file-sub">
            ${formatBytes(file.size)} • Uploaded ${new Date(file.uploadedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn btn-secondary btn-sm" onclick="openSasView('${file._id}', false)">
          View
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openSasView('${file._id}', true)">
          Download
        </button>
        <button class="btn btn-secondary btn-sm" onclick="copySasLink('${file._id}')" title="Copy 10-minute secure link">
          Copy Link
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteVaultFile('${file._id}')">
          Delete
        </button>
      </div>
    `;

    fileListContainer.appendChild(row);
  });
}

// Open file via SAS URL (inline view or attachment download)
async function openSasView(fileId, isDownload) {
  try {
    const res = await fetch(`/api/files/${fileId}/sas?download=${isDownload ? 'true' : 'false'}&expiry=15`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate SAS token');

    // Directly open the Azure Blob SAS URL in a new window/tab
    window.open(data.sasUrl, '_blank');
  } catch (err) {
    showToast(err.message, true);
  }
}

// Copy SAS URL to clipboard
async function copySasLink(fileId) {
  try {
    const res = await fetch(`/api/files/${fileId}/sas?expiry=15`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate SAS token');

    await navigator.clipboard.writeText(data.sasUrl);
    showToast('Secure SAS URL (15m expiry) copied to clipboard!');
  } catch (err) {
    showToast(err.message, true);
  }
}

// Delete file
async function deleteVaultFile(fileId) {
  if (!confirm('Are you sure you want to permanently delete this file from Azure Blob and MongoDB?')) return;

  try {
    const res = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete file');

    showToast('File deleted successfully.');
    fetchFiles();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Events
refreshFilesBtn.addEventListener('click', fetchFiles);

// Initialize
checkHealth();
setInterval(checkHealth, 15000);
updateAuthUI();
