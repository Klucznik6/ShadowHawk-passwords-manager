// --- User/Folders/Passwords, localStorage, encryption, UI logic ---

// Simple icons for services
const ICONS = [
  "bi bi-box", "bi bi-key", "bi bi-envelope", "bi bi-globe", "bi bi-credit-card-2-front", "bi bi-person-badge", "bi bi-lock", "bi bi-shield-check", "bi bi-chat-square-text"
];
function pickIcon(idx) { return ICONS[idx % ICONS.length]; }

// ---- Authentication ----
const USERS_KEY = "pmx_users";
const LOGGED_IN_KEY = "pmx_loggedin";
let CURRENT_USER = null;
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}
function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function generateRecoveryCode() {
  // 12 random words or a long hex string
  const words = [];
  for (let i = 0; i < 12; i++) {
    words.push(Math.random().toString(36).slice(2, 6));
  }
  return words.join('-');
}
function registerUser(username, password) {
  let users = getUsers();
  if (users[username]) return "Username already exists";
  const encKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  const recoveryCode = generateRecoveryCode();
  const recoveryHash = hashPassword(recoveryCode);
  users[username] = { passwordHash: hashPassword(password), encKey, recoveryHash };
  saveUsers(users);
  localStorage.setItem(getEncKeyKey(username), encKey);
  localStorage.setItem(LOGGED_IN_KEY, username);
  CURRENT_USER = username;
  localStorage.setItem(getFoldersKey(username), JSON.stringify(defaultFolders()));
  // Show recovery code to user
  showInfoModal(
    "Your recovery code (write it down and keep it safe):\n\n" +
    recoveryCode +
    "\n\nYou will need this to reset your password if you forget it.",
    () => {}
  );
  return null;
}
function loginUser(username, password) {
  let users = getUsers();
  if (!users[username]) return "Username not found";
  if (users[username].passwordHash !== hashPassword(password)) return "Incorrect password";
  localStorage.setItem(getEncKeyKey(username), users[username].encKey);
  localStorage.setItem(LOGGED_IN_KEY, username);
  CURRENT_USER = username;
  // Create folders if missing (upgrade from old version)
  if (!localStorage.getItem(getFoldersKey(username))) {
    localStorage.setItem(getFoldersKey(username), JSON.stringify(defaultFolders()));
  }
  return null;
}
function logoutUser() {
  CURRENT_USER = null;
  localStorage.removeItem(LOGGED_IN_KEY);
}



// --- Folder/Password storage ---
function getFoldersKey(username) { return `pmx_folders_${username}`; }
function getPasswordsKey(username, folderId) { return `pmx_pwds_${username}_${folderId}`; }
function getEncKeyKey(username) { return `pmx_enckey_${username}`; }
function getEncryptionKey() {
  if (!CURRENT_USER) return "";
  let key = localStorage.getItem(getEncKeyKey(CURRENT_USER));
  if (!key) {
    let users = getUsers();
    if (users[CURRENT_USER]) {
      key = users[CURRENT_USER].encKey;
      localStorage.setItem(getEncKeyKey(CURRENT_USER), key);
    }
  }
  return key;
}
function encrypt(text) { return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString(); }
function decrypt(cipher) {
  try {
    let bytes = CryptoJS.AES.decrypt(cipher, getEncryptionKey());
    return bytes.toString(CryptoJS.enc.Utf8) || '[error]';
  } catch { return '[error]'; }
}
function defaultFolders() {
  return [
    { id: "all", name: "All Items", icon: "bi-shield-lock-fill", system: true },
    { id: "favorites", name: "Favorites", icon: "bi-star-fill", system: true }
  ];
}
function getFolders() {
  if (!CURRENT_USER) return [];
  let raw = localStorage.getItem(getFoldersKey(CURRENT_USER));
  if (!raw) {
    localStorage.setItem(getFoldersKey(CURRENT_USER), JSON.stringify(defaultFolders()));
    return defaultFolders();
  }
  return JSON.parse(raw);
}
function saveFolders(folders) {
  if (!CURRENT_USER) return;
  localStorage.setItem(getFoldersKey(CURRENT_USER), JSON.stringify(folders));
}
function getPasswords(folderId, searchTerm="") {
  if (!CURRENT_USER) return [];
  let folders = getFolders();
  let allFolders = folders.filter(f => !f.system || f.id === "favorites" || f.id === "all").map(f => f.id);
  let out = [];
  if (folderId === "all") {
    for (const f of folders.filter(f=>!f.system || f.id==="favorites"||f.id==="all")) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, f.id)) || "[]");
      out.push(...items.map(it => ({...it, folderId: f.id})));
    }
  } else if (folderId === "favorites") {
    for (const fId of allFolders) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, fId)) || "[]");
      out.push(...items.filter(it => it.favorite).map(it => ({...it, folderId: fId})));
    }
  } else {
    out = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, folderId)) || "[]");
  }
  if (searchTerm?.trim()) {
    const q = searchTerm.trim().toLowerCase();
    out = out.filter(pw =>
      decrypt(pw.title||"").toLowerCase().includes(q) ||
      decrypt(pw.username||"").toLowerCase().includes(q)
    );
  }
  return out;
}
function savePasswords(folderId, items) {
  if (!CURRENT_USER) return;
  localStorage.setItem(getPasswordsKey(CURRENT_USER, folderId), JSON.stringify(items));
}

// --- UI state ---
let selectedFolder = "all";
let selectedPasswordId = null;
let addEditMode = null; // null | "add" | "edit"

// --- UI Rendering ---
function renderFolders() {
  const folders = getFolders();
  const list = document.getElementById('foldersList');
  list.innerHTML = "";
  folders.forEach((f, idx) => {
    let li = document.createElement('li');
    li.className = [];
    li.classList.add(f.system ? (f.id === "all" ? "default-folder" : "favorites-folder") : "custom-folder");
    if (f.id === selectedFolder) li.classList.add("selected");
    li.innerHTML = `<i class="bi ${f.icon}"></i> <span>${f.name}</span>`;
    if (!f.system) li.innerHTML += `<i class="bi bi-trash folder-delete ms-2" title="Delete" data-folder="${f.id}"></i>`;
    li.onclick = () => { selectedFolder = f.id; selectedPasswordId = null; addEditMode = null; renderAll(); };
    if (!f.system) {
      li.querySelector('.folder-delete').onclick = (e) => {
        e.stopPropagation();
        showConfirmModal(`Delete folder "${f.name}" and all its passwords?`, () => {
          // Yes
          localStorage.removeItem(getPasswordsKey(CURRENT_USER, f.id));
          let folders = getFolders().filter(ff => ff.id !== f.id);
          saveFolders(folders);
          if (selectedFolder === f.id) selectedFolder = "all";
          renderAll();
        });
      };
    }
    list.appendChild(li);
  });
}

function renderPasswordsList() {
  const list = document.getElementById('passwordsList');
  let searchTerm = document.getElementById('searchInput')?.value || "";
  const passwords = getPasswords(selectedFolder, searchTerm);
  list.innerHTML = "";
  if (passwords.length === 0) {
    list.innerHTML = `<li class="text-muted text-center py-4">No passwords.</li>`;
    return;
  }
  passwords.forEach((pw, idx) => {
    let li = document.createElement('li');
    li.className = "d-flex";
    if (pw.id === selectedPasswordId) li.classList.add("selected");
    let icon = pickIcon(idx);
    let fav = pw.favorite ? "" : "inactive";
    li.innerHTML = `<i class="pw-icon bi ${icon}"></i>
      <div class="flex-grow-1">
        <div class="item-title">${decrypt(pw.title)}</div>
        <div class="item-sub">${decrypt(pw.username)}</div>
      </div>
      <i class="pw-fav bi bi-star-fill ${fav}" title="Favorite"></i>`;
    li.onclick = (e) => {
      if (e.target.classList.contains('pw-fav')) return;
      selectedPasswordId = pw.id;
      addEditMode = null;
      renderDetails();
      renderPasswordsList();
    };
    li.querySelector('.pw-fav').onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(pw, pw.folderId||selectedFolder);
      renderPasswordsList();
      renderDetails();
    };
    list.appendChild(li);
  });
}

function toggleFavorite(pw, folderId) {
  let items = getPasswords(folderId);
  let idx = items.findIndex(x => x.id === pw.id);
  if (idx >= 0) {
    items[idx].favorite = !items[idx].favorite;
    savePasswords(folderId, items);
  }
}

function renderDetails() {
  const pane = document.getElementById('detailPane');
  if (addEditMode === "add") {
    renderAddEditForm();
    return;
  }
  if (addEditMode === "edit") {
    renderAddEditForm(selectedPasswordId);
    return;
  }
  if (!selectedPasswordId) {
    pane.innerHTML = `<div class="text-center text-muted mt-5">
      <i class="bi bi-arrow-left-right fs-1 mb-2"></i>
      <p>Select a password or create a new one.</p>
    </div>`;
    return;
  }
  // Show details for selected password
  let pw = findPasswordById(selectedPasswordId);
  if (!pw) {
    pane.innerHTML = `<div class="text-muted">Item not found.</div>`;
    return;
  }
  let icon = pickIcon(0);
  pane.innerHTML = `
    <div class="mb-4 text-center">
      <i class="pw-icon bi ${icon}"></i>
      <div class="fs-4 mt-2 fw-bold">${decrypt(pw.title)}</div>
      <div class="small text-muted">${decrypt(pw.username)}</div>
    </div>
    <div class="mb-4">
      <label class="form-label mt-2">Password</label>
      <div class="input-group">
        <input type="password" class="form-control" id="detailPassword" value="********" readonly>
        <button class="btn btn-outline-secondary" id="showHidePwBtn" title="Show/Hide"><i class="bi bi-eye"></i></button>
        <button class="btn btn-outline-secondary" id="copyPwBtn" title="Copy"><i class="bi bi-clipboard"></i></button>
      </div>
    </div>
    <div class="mb-2">
      <label class="form-label mt-2">Notes</label>
      <textarea class="form-control" rows="2" readonly>${decrypt(pw.notes||"")}</textarea>
    </div>
    <div class="pw-actions d-flex">
      <button class="btn btn-outline-info" id="editPwBtn"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn btn-outline-danger" id="deletePwBtn"><i class="bi bi-trash"></i> Delete</button>
    </div>
    <div class="text-muted small mt-3">
      Created: ${pw.created || "-"}
      <br>Modified: ${pw.updated || "-"}
    </div>
  `;
  // Show/Hide password logic
  const showBtn = document.getElementById('showHidePwBtn');
  const pwInput = document.getElementById('detailPassword');
  let shown = false;
  showBtn.onclick = (e) => {
    e.preventDefault();
    shown = !shown;
    pwInput.type = shown ? "text" : "password";
    pwInput.value = shown ? decrypt(pw.password) : "********";
    showBtn.innerHTML = shown ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  };
  document.getElementById('copyPwBtn').onclick = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(decrypt(pw.password));
  };
  document.getElementById('editPwBtn').onclick = (e) => {
    e.preventDefault();
    addEditMode = "edit";
    renderDetails();
  };
  document.getElementById('deletePwBtn').onclick = (e) => {
    e.preventDefault();
    showConfirmModal("Do you want to remove this element?", () => {
      deletePassword(pw, pw.folderId || selectedFolder);
      selectedPasswordId = null;
      renderAll();
    });
  };
}

function renderAddEditForm(editId) {
  const pane = document.getElementById('detailPane');
  let editing = !!editId;
  let pw = editing ? findPasswordById(editId) : {};
  let icon = pw.icon || pickIcon(0);

  // Get folders for the dropdown (exclude system folders except "all")
  const folders = getFolders().filter(f => !f.system);

  // Add "All Items" as a selectable option
  const allItemsOption = `<option value="all"${selectedFolder === "all" ? " selected" : ""}>All Items</option>`;

  // Determine selected folder for the password
  let selectedFolderId = editing ? pw.folderId : (selectedFolder === "favorites" ? (folders[0]?.id || "all") : selectedFolder);

  pane.innerHTML = `
    <form id="passwordForm" autocomplete="off">
      <div class="mb-3 text-center">
        <button type="button" id="pwIconPickerBtn" class="btn btn-light border-0 p-0" style="background: none;">
          <i class="pw-icon ${icon}" style="font-size:2.9em;"></i>
        </button>
      </div>
      <div class="mb-3">
        <label class="form-label">Folder</label>
        <select class="form-select" name="folder" required>
          ${allItemsOption}
          ${folders.map(f => `<option value="${f.id}" ${f.id === selectedFolderId ? "selected" : ""}>${f.name}</option>`).join("")}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Title/Service</label>
        <input type="text" class="form-control" name="title" value="${editing?decrypt(pw.title):""}" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Username/Email</label>
        <input type="text" class="form-control" name="username" value="${editing?decrypt(pw.username):""}" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input type="password" class="form-control" name="password" value="${editing?decrypt(pw.password):""}" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Notes</label>
        <textarea class="form-control" name="notes" rows="2">${editing?decrypt(pw.notes||""):''}</textarea>
      </div>
      <div class="d-flex">
        <button class="btn btn-success me-2" type="submit">${editing?"Save":"Add"}</button>
        <button class="btn btn-outline-secondary" type="button" id="cancelAddEditBtn">Cancel</button>
      </div>
    </form>
  `;

  // Icon picker logic
  let chosenIcon = icon;
  document.getElementById('pwIconPickerBtn').onclick = (e) => {
    e.preventDefault();
    showIconPicker(chosenIcon, (newIcon) => {
      chosenIcon = newIcon;
      document.querySelector('#pwIconPickerBtn i').className = `pw-icon ${newIcon}`;
    });
  };

  document.getElementById('cancelAddEditBtn').onclick = () => {
    addEditMode = null;
    renderDetails();
  };
  document.getElementById('passwordForm').onsubmit = (e) => {
    e.preventDefault();
    let data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.title || !data.username || !data.password || !data.folder) return;
    let folderId = data.folder;
    let items = getPasswords(folderId);
    let now = new Date().toLocaleString();

    // --- Uniqueness check ---
    let allFolders = getFolders().map(f => f.id);
    let isDuplicate = false;
    for (let fId of allFolders) {
      let pwds = getPasswords(fId);
      if (pwds.some(pw =>
        decrypt(pw.title) === data.title &&
        (!editId || pw.id !== editId)
      )) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) {
      showInfoModal("A password with the same Title/Service already exists.");
      return;
    }
    // --- End uniqueness check ---

    if (editing) {
      // Remove from old folder if folder changed
      if (pw.folderId !== folderId) {
        let oldItems = getPasswords(pw.folderId);
        let idx = oldItems.findIndex(x => x.id === editId);
        if (idx >= 0) {
          oldItems.splice(idx, 1);
          savePasswords(pw.folderId, oldItems);
        }
        pw = {}; // reset for new folder
        items = getPasswords(folderId);
      } else {
        let idx = items.findIndex(x => x.id === editId);
        if (idx >= 0) {
          items[idx].title = encrypt(data.title);
          items[idx].username = encrypt(data.username);
          items[idx].password = encrypt(data.password);
          items[idx].notes = encrypt(data.notes || "");
          items[idx].updated = now;
          items[idx].icon = chosenIcon;
          savePasswords(folderId, items);
          addEditMode = null;
          selectedPasswordId = editId;
          renderAll();
          return;
        }
      }
    }
    // Add new password
    let newId = Math.random().toString(36).slice(2);
    items.push({
      id: newId,
      title: encrypt(data.title),
      username: encrypt(data.username),
      password: encrypt(data.password),
      notes: encrypt(data.notes || ""),
      created: now,
      updated: now,
      favorite: false,
      icon: chosenIcon
    });
    savePasswords(folderId, items);
    addEditMode = null;
    selectedPasswordId = newId;
    selectedFolder = folderId;
    renderAll();
  };
}

function findPasswordById(id) {
  let folders = getFolders();
  for (let f of folders) {
    let items = getPasswords(f.id);
    let found = items.find(x => x.id === id);
    if (found) {
      found.folderId = f.id;
      return found;
    }
  }
  return null;
}

function deletePassword(pw, folderId) {
  let items = getPasswords(folderId);
  let idx = items.findIndex(x => x.id === pw.id);
  if (idx >= 0) {
    items.splice(idx, 1);
    savePasswords(folderId, items);
  }
}

function renderAll() {
  renderFolders();
  renderPasswordsList();
  renderDetails();
  document.getElementById('currentFolderName').textContent =
    getFolders().find(f => f.id === selectedFolder)?.name || "All Items";
  document.getElementById('currentUser').textContent = CURRENT_USER ? `@${CURRENT_USER}` : "";
  document.getElementById('searchInput').value = "";
}

// --- Event handlers ---
document.getElementById('addFolderBtn').onclick = () => {
  // Prevent multiple inputs
  if (document.getElementById('newFolderInput')) return;

  const btn = document.getElementById('addFolderBtn');
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'newFolderInput';
  input.className = 'form-control form-control-sm mt-2';
  input.placeholder = 'Enter folder name...';

  btn.parentNode.appendChild(input);
  input.focus();

  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const name = input.value.trim();
      if (!name) return;
      let folders = getFolders();
      let id = Math.random().toString(36).slice(2);
      folders.push({ id, name, icon: "bi-folder-fill", system: false });
      saveFolders(folders);
      selectedFolder = id;
      renderAll();
      input.remove();
    }
    if (e.key === 'Escape') {
      input.remove();
    }
  };
  input.onblur = () => input.remove();
};

document.getElementById('addPasswordBtn').onclick = () => {
  addEditMode = "add";
  selectedPasswordId = null;
  renderDetails();
};
document.getElementById('logoutBtn').onclick = () => {
  logoutUser();
  document.getElementById('mainLayout').style.display = "none";
  let overlay = document.getElementById('authOverlay');
  overlay.classList.remove("d-none");
  overlay.style.display = "flex";
  showAuth(true);
};
document.getElementById('searchInput').oninput = function() {
  renderPasswordsList();
};

document.getElementById('exportPwdsBtn').onclick = () => {
  exportPasswords();
};

document.getElementById('importPwdsBtn').onclick = () => {
  document.getElementById('importFileInput').click();
};

document.getElementById('importFileInput').onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    importPasswords(evt.target.result);
  };
  reader.readAsText(file);
  // Reset input so user can import the same file again if needed
  e.target.value = "";
};

// --- Authentication overlay logic ---
function showAuth(isLogin) {
  document.getElementById('authTitle').textContent = isLogin ? "Login" : "Register";
  document.getElementById('authBtn').textContent = isLogin ? "Login" : "Register";
  document.getElementById('toggleText').textContent = isLogin ? "Don't have an account?" : "Already have an account?";
  document.getElementById('toggleAuth').textContent = isLogin ? "Register" : "Login";
  document.getElementById('authError').classList.add('d-none');
  document.getElementById('authForm').reset();
  setTimeout(()=>document.getElementById('authUsername').focus(),100);
}
let isLogin = true;
document.getElementById('toggleAuth').onclick = function(e) {
  e.preventDefault();
  isLogin = !isLogin;
  showAuth(isLogin);
};
document.getElementById('authForm').onsubmit = function(e) {
  e.preventDefault();
  let username = document.getElementById('authUsername').value.trim();
  let password = document.getElementById('authPassword').value;
  let error = isLogin ? loginUser(username, password) : registerUser(username, password);
  if (error) {
    let errDiv = document.getElementById('authError');
    errDiv.textContent = error;
    errDiv.classList.remove('d-none');
  } else {
    hideAuthOverlay();
    document.getElementById('mainLayout').style.display = "";
    renderAll();
  }
};
function hideAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  overlay.classList.add('d-none');
  overlay.style.display = 'none';
}

// --- Confirm modal ---
function showConfirmModal(message, onYes, onNo) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmModalText').textContent = message || "Are you sure?";
  modal.classList.remove('d-none');
  // Remove previous handlers
  const yesBtn = document.getElementById('confirmModalYes');
  const noBtn = document.getElementById('confirmModalNo');
  yesBtn.onclick = () => {
    modal.classList.add('d-none');
    if (onYes) onYes();
  };
  noBtn.onclick = () => {
    modal.classList.add('d-none');
    if (onNo) onNo();
  };
}

// --- Info modal ---
function showInfoModal(message, onOk) {
  const modal = document.getElementById('infoModal');
  document.getElementById('infoModalText').textContent = message || "";
  modal.classList.remove('d-none');
  const okBtn = document.getElementById('infoModalOk');
  okBtn.onclick = () => {
    modal.classList.add('d-none');
    if (onOk) onOk();
  };
}

// --- Theme persistence
function setTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add('theme-' + theme);
  localStorage.setItem('pmx_theme', theme);
}
function loadTheme() {
  let theme = localStorage.getItem('pmx_theme');
  if (!theme) {
    // Detect system theme if not set
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(theme);
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('pmx_theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// Settings modal logic
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();

  document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('settingsModal').classList.remove('d-none');
  };
  document.getElementById('settingsCloseBtn').onclick = () => {
    document.getElementById('settingsModal').classList.add('d-none');
  };
  document.getElementById('themeLight').onclick = () => {
    setTheme('light');
  };
  document.getElementById('themeDark').onclick = () => {
    setTheme('dark');
  };
});

// --- Startup ---
window.onload = function() {
  let logged = localStorage.getItem(LOGGED_IN_KEY);
  if (logged && getUsers()[logged]) {
    CURRENT_USER = logged;
    document.getElementById('authOverlay').style.display = "none";
    document.getElementById('mainLayout').style.display = "";
    renderAll();
  } else {
    showAuth(true);
  }
};
window.onbeforeunload = function() {
  CURRENT_USER = null;
  localStorage.removeItem(LOGGED_IN_KEY);
};

function exportPasswords() {
  if (!CURRENT_USER) return;
  const folders = getFolders();
  const exportData = {
    folders,
    passwords: {}
  };
  folders.forEach(f => {
    exportData.passwords[f.id] = getPasswords(f.id);
  });
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `passwords-export-${CURRENT_USER}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importPasswords(json) {
  if (!CURRENT_USER) return;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data.folders || !data.passwords) throw new Error("Invalid file");
    // Merge folders (skip system folders)
    let folders = getFolders().filter(f => f.system);
    let customFolders = data.folders.filter(f => !f.system);
    folders = folders.concat(customFolders);
    saveFolders(folders);
    // Import passwords for each folder
    for (const [folderId, pwds] of Object.entries(data.passwords)) {
      savePasswords(folderId, pwds);
    }
    renderAll();
    showInfoModal("Passwords imported successfully!");
  } catch (e) {
    showInfoModal("Import failed: " + (e.message || e));
  }
}

// Show recovery overlay
document.getElementById('forgotPwLink').onclick = function(e) {
  e.preventDefault();
  document.getElementById('authOverlay').classList.add('d-none');
  document.getElementById('recoveryOverlay').classList.remove('d-none');
  document.getElementById('recoveryForm').reset();
  document.getElementById('recoveryError').classList.add('d-none');
};

document.getElementById('backToLogin').onclick = function(e) {
  e.preventDefault();
  document.getElementById('recoveryOverlay').classList.add('d-none');
  document.getElementById('authOverlay').classList.remove('d-none');
};

document.getElementById('recoveryForm').onsubmit = function(e) {
  e.preventDefault();
  const username = document.getElementById('recoveryUsername').value.trim();
  const code = document.getElementById('recoveryCode').value.trim();
  const newPw = document.getElementById('newPassword').value;
  let users = getUsers();
  let errDiv = document.getElementById('recoveryError');
  errDiv.classList.add('d-none');
  if (!users[username]) {
    errDiv.textContent = "Username not found.";
    errDiv.classList.remove('d-none');
    return;
  }
  if (users[username].recoveryHash !== hashPassword(code)) {
    errDiv.textContent = "Invalid recovery code.";
    errDiv.classList.remove('d-none');
    return;
  }
  // Set new password
  users[username].passwordHash = hashPassword(newPw);
  saveUsers(users);
  showInfoModal("Password reset successful! You can now log in.", () => {
    document.getElementById('recoveryOverlay').classList.add('d-none');
    document.getElementById('authOverlay').classList.remove('d-none');
  });
};