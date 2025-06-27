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
function getDeletedPasswordsKey(username) { 
  return `pmx_deleted_${username}`; 
}
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
    { id: "favorites", name: "Favorites", icon: "bi-star-fill", system: true },
    { id: "watchtower", name: "Watchtower", icon: "bi-graph-up-arrow", system: true },
    { id: "deleted", name: "Recently Deleted", icon: "bi-trash", system: true } // Add Recently Deleted folder
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
    // Include all regular folders
    for (const f of folders.filter(f=>!f.system)) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, f.id)) || "[]");
      out.push(...items.map(it => ({...it, folderId: f.id})));
    }
    
    // Also include unassigned items
    let unassignedItems = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, "unassigned")) || "[]");
    out.push(...unassignedItems.map(it => ({...it, folderId: "unassigned"})));
    
  } else if (folderId === "favorites") {
    // Include favorites from all folders and unassigned
    for (const fId of [...allFolders, "unassigned"]) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, fId)) || "[]");
      out.push(...items.filter(it => it.favorite).map(it => ({...it, folderId: fId})));
    }
  } else {
    out = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, folderId)) || "[]");
  }
  
  // Rest of your function stays the same
  if (searchTerm?.trim()) {
    const q = searchTerm.trim().toLowerCase();
    out = out.filter(pw =>
      decrypt(pw.title||"").toLowerCase().includes(q) ||
      decrypt(pw.username||"").toLowerCase().includes(q)
    );
  }
  return out;
}
function getDeletedPasswords() {
  if (!CURRENT_USER) return [];
  const key = getDeletedPasswordsKey(CURRENT_USER);
  const items = JSON.parse(localStorage.getItem(key) || "[]");
  // Sort by deleteDate descending (newest first)
  return items.sort((a, b) => b.deleteDate - a.deleteDate);
}
function savePasswords(folderId, items) {
  if (!CURRENT_USER) return;
  localStorage.setItem(getPasswordsKey(CURRENT_USER, folderId), JSON.stringify(items));
}
function saveDeletedPasswords(items) {
  if (!CURRENT_USER) return;
  localStorage.setItem(getDeletedPasswordsKey(CURRENT_USER), JSON.stringify(items));
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
  
  if (selectedFolder === "watchtower") {
    renderWatchtower(pane);
    return;
  }
  
  if (selectedFolder === "deleted") {
    renderDeletedItems(pane);
    return;
  }
  
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
  let pw = null;
  let originalFolderId = null;
  
  if (editing) {
    // Find the actual password and its real folder ID
    pw = findPasswordById(editId);
    if (!pw) return; // Not found
    originalFolderId = pw.folderId;
    
    // If the item is in the "unassigned" folder, show it as "all" for better UX
    if (originalFolderId === "unassigned") {
      originalFolderId = "all";
    }
  } else {
    pw = {};
  }
  
  let icon = pw.icon || pickIcon(0);

  // Get folders for the dropdown (exclude system folders)
  const folders = getFolders().filter(f => !f.system);

  // Always show "All Items" option in the folder dropdown
  const allItemsOption = `<option value="all">All Items</option>`;

  // Determine the selected folder in the dropdown:
  let selectedFolderId;
  
  if (editing) {
    // When editing: Use the item's original folder (now handling "unassigned" as "all")
    selectedFolderId = originalFolderId;
  } else {
    // When adding NEW item:
    // Always default to the current selected folder
    selectedFolderId = (selectedFolder === "watchtower" || selectedFolder === "deleted") 
      ? "all"  // For these system folders, default to All Items
      : selectedFolder;
  }

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
    let now = new Date().toLocaleString();
    
    // Convert "all" folder selection to "unassigned" for storage
    if (folderId === "all") {
      folderId = "unassigned";
    }
    
    if (editing) {
      // Get the real original folder ID (convert "all" display value back to "unassigned")
      const realOriginalFolderId = originalFolderId === "all" ? "unassigned" : originalFolderId;
      
      // If original folder differs from selected folder, move the item
      if (realOriginalFolderId !== folderId) {
        // Remove from original folder
        let originalItems = getPasswords(realOriginalFolderId);
        let originalIdx = originalItems.findIndex(x => x.id === editId);
        if (originalIdx >= 0) {
          originalItems.splice(originalIdx, 1);
          savePasswords(realOriginalFolderId, originalItems);
        }
        
        // Add to new folder
        let newItems = getPasswords(folderId);
        newItems.push({
          id: editId,
          title: encrypt(data.title),
          username: encrypt(data.username),
          password: encrypt(data.password),
          notes: encrypt(data.notes || ""),
          created: pw.created,
          updated: now,
          favorite: pw.favorite || false,
          icon: chosenIcon,
          folderId: folderId
        });
        savePasswords(folderId, newItems);
      } else {
        // Just update in the original folder
        let items = getPasswords(realOriginalFolderId);
        let idx = items.findIndex(x => x.id === editId);
        if (idx >= 0) {
          items[idx].title = encrypt(data.title);
          items[idx].username = encrypt(data.username);
          items[idx].password = encrypt(data.password);
          items[idx].notes = encrypt(data.notes || "");
          items[idx].updated = now;
          items[idx].icon = chosenIcon;
          savePasswords(realOriginalFolderId, items);
        }
      }
      
      addEditMode = null;
      selectedPasswordId = editId;
      renderAll();
    } else {
      // Add new password logic
      let newId = Math.random().toString(36).slice(2);
      
      // Create item in the selected folder (which could be "unassigned" for "All Items")
      let items = getPasswords(folderId);
      items.push({
        id: newId,
        title: encrypt(data.title),
        username: encrypt(data.username),
        password: encrypt(data.password),
        notes: encrypt(data.notes || ""),
        created: now,
        updated: now,
        favorite: false,
        icon: chosenIcon,
        folderId: folderId
      });
      savePasswords(folderId, items);
      addEditMode = null;
      selectedPasswordId = newId;
      renderAll();
    }
  };
}

function findPasswordById(id) {
  // Check current folder first
  if (selectedFolder !== "all" && selectedFolder !== "favorites" && selectedFolder !== "watchtower") {
    const folderItems = getPasswords(selectedFolder);
    const found = folderItems.find(p => p.id === id);
    if (found) {
      return { ...found, folderId: selectedFolder };
    }
  }
  
  // Then check all regular folders
  const folders = getFolders().filter(f => !f.system);
  for (const folder of folders) {
    const items = getPasswords(folder.id);
    const found = items.find(p => p.id === id);
    if (found) {
      return { ...found, folderId: folder.id };
    }
  }
  
  // Finally check the special "unassigned" folder for "All Items"
  const unassignedItems = getPasswords("unassigned");
  const foundUnassigned = unassignedItems.find(p => p.id === id);
  if (foundUnassigned) {
    return { ...foundUnassigned, folderId: "unassigned" };
  }
  
  return null;
}

function deletePassword(pw, folderId) {
  // Remove from original folder
  let items = getPasswords(folderId);
  let idx = items.findIndex(x => x.id === pw.id);
  if (idx >= 0) {
    const deletedItem = items[idx];
    
    // Add additional metadata for restore
    deletedItem.originalFolderId = folderId;
    deletedItem.deleteDate = Date.now();
    
    // Move to deleted items
    const deletedItems = getDeletedPasswords();
    deletedItems.push(deletedItem);
    saveDeletedPasswords(deletedItems);
    
    // Remove from original folder
    items.splice(idx, 1);
    savePasswords(folderId, items);
  }
}

function restoreDeletedPassword(id) {
  const deletedItems = getDeletedPasswords();
  const itemIndex = deletedItems.findIndex(p => p.id === id);
  
  if (itemIndex >= 0) {
    const item = deletedItems[itemIndex];
    
    // Find folder to restore to (or use "unassigned" if it was from "All Items")
    const folders = getFolders().filter(f => !f.system);
    let targetFolderId = item.originalFolderId;
    let restorationMessage = 'original folder';
    
    // Check if the original folder still exists (and wasn't "unassigned")
    if (targetFolderId === "unassigned") {
      // Item was in "All Items" view, keep it in "unassigned"
      restorationMessage = 'All Items';
    } else {
      // For regular folders, check if they still exist
      const folderExists = folders.some(f => f.id === targetFolderId);
      if (!folderExists) {
        // Original folder doesn't exist anymore, put in "unassigned" instead of first folder
        targetFolderId = "unassigned";
        restorationMessage = 'All Items (original folder no longer exists)';
      }
    }
    
    // Add to target folder
    const folderItems = getPasswords(targetFolderId);
    
    // Remove deleteDate and originalFolderId properties
    const { deleteDate, originalFolderId, ...restoredItem } = item;
    restoredItem.folderId = targetFolderId;
    
    folderItems.push(restoredItem);
    savePasswords(targetFolderId, folderItems);
    
    // Remove from deleted items
    deletedItems.splice(itemIndex, 1);
    saveDeletedPasswords(deletedItems);
    
    showInfoModal(`Item restored to ${restorationMessage}.`);
    renderAll();
  }
}

function permanentlyDeletePassword(id) {
  showConfirmModal("Permanently delete this item?", () => {
    const deletedItems = getDeletedPasswords();
    const updatedItems = deletedItems.filter(p => p.id !== id);
    saveDeletedPasswords(updatedItems);
    renderAll();
  });
}

function cleanupOldDeletedItems() {
  if (!CURRENT_USER) return;
  
  const deletedItems = getDeletedPasswords();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const updatedItems = deletedItems.filter(item => item.deleteDate > thirtyDaysAgo);
  
  // If items were removed, save the updated list
  if (updatedItems.length !== deletedItems.length) {
    saveDeletedPasswords(updatedItems);
  }
}

// Update the renderAll function to run cleanup
function renderAll() {
  cleanupOldDeletedItems(); // Call this at the beginning
  renderFolders();
  renderPasswordsList();
  
  // Full-width logic for special views (Watchtower and Recently Deleted)
  const appList = document.querySelector('.app-list');
  const appDetail = document.querySelector('.app-detail');
  const listTopBar = document.getElementById('listTopBar');
  const detailTopBar = document.getElementById('detailTopBar');
  const detailPane = document.getElementById('detailPane');
  
  // Apply full-width layout for both Watchtower and Recently Deleted
  if (selectedFolder === "watchtower" || selectedFolder === "deleted") {
    // Hide list and show detail pane in full width
    appList.style.display = "none";
    appDetail.classList.add('watchtower-full');
    
    // Hide top bars
    if (listTopBar) listTopBar.style.display = "none";
    if (detailTopBar) {
      // Just hide it rather than trying to modify its structure
      detailTopBar.style.display = "none";
    }
    
    // Remove top padding
    if (detailPane) {
      detailPane.classList.add('no-top-padding');
      detailPane.style.marginTop = "0";
      detailPane.style.paddingTop = "0";
    }
    
    // Add CSS to the head to completely hide the strip
    let style = document.getElementById('special-view-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'special-view-style';
      document.head.appendChild(style);
    }
    
    // This CSS targets the specific elements causing the strip
    style.innerHTML = `
      .app-main-row { margin-top: 0 !important; }
      .container-fluid { padding-top: 0 !important; }
      #mainLayout { padding: 0 !important; }
      .app-detail { margin-top: 0 !important; }
      #detailTopBar { height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important; }
    `;
    
    // Wait a bit then render details to make sure layout is applied
    setTimeout(renderDetails, 0);
  } else {
    // Reset everything for normal views
    appList.style.display = "";
    appDetail.classList.remove('watchtower-full');
    
    if (listTopBar) listTopBar.style.display = "";
    if (detailTopBar) detailTopBar.style.display = "";
    
    if (detailPane) {
      detailPane.classList.remove('no-top-padding');
      detailPane.style.marginTop = "";
      detailPane.style.paddingTop = "";
    }
    
    // Remove special CSS
    let style = document.getElementById('special-view-style');
    if (style) {
      style.innerHTML = '';
    }
    
    // Update the UI
    renderDetails();
  }
  
  // Always update folder name and user info
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
  isLogin = true; // <-- ADD THIS LINE
  showAuth(true); // <-- ENSURE LOGIN MODE
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
  
  // Export passwords from all real folders
  folders.filter(f => !f.system).forEach(f => {
    exportData.passwords[f.id] = getPasswords(f.id);
  });
  
  // Export unassigned passwords as well
  exportData.passwords["unassigned"] = getPasswords("unassigned");
  
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
      // Add folderId to each item for proper tracking
      const updatedPwds = pwds.map(pw => ({...pw, folderId}));
      
      // Skip system folders except "unassigned"
      if (folderId !== "unassigned" && folders.some(f => f.id === folderId && f.system)) {
        continue;
      }
      
      savePasswords(folderId, updatedPwds);
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
}

// Simple password strength estimator
function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}

function renderWatchtower(pane) {
  // Gather only passwords from "All Items"
  let allPwds = getPasswords("all");

  // Analyze
  let stats = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
  let reused = 0;
  let pwSet = new Set();
  let weak = 0;

  allPwds.forEach(pw => {
    let realPw = decrypt(pw.password);
    let strength = getPasswordStrength(realPw);
    stats[strength]++;
    if (strength <= 2) weak++;
    if (pwSet.has(realPw)) reused++;
    pwSet.add(realPw);
  });

  let total = allPwds.length;
  let bar = '';
  for (let i = 5; i >= 0; i--) {
    if (stats[i]) {
      let color = i >= 4 ? 'bg-success' : i === 3 ? 'bg-warning' : 'bg-danger';
      bar += `<div class="${color}" style="display:inline-block;width:${(stats[i]/(total||1))*100}%;height:22px"></div>`;
    }
  }

  pane.innerHTML = `
    <div class="watchtower-container mx-auto" style="max-width:900px;">
      <div class="mb-4">
        <h4 class="mb-3"><i class="bi bi-graph-up-arrow"></i> Watchtower</h4>
        <div class="mb-2">Overall Password Strength</div>
        <div style="border-radius:6px;overflow:hidden;border:1px solid #ddd;">${bar}</div>
        <div class="mt-2 small">
          <span class="badge bg-success">Strong: ${stats[5] + stats[4]}</span>
          <span class="badge bg-warning text-dark">Medium: ${stats[3]}</span>
          <span class="badge bg-danger">Weak: ${stats[2] + stats[1] + stats[0]}</span>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <div class="card p-3">
            <div class="fs-2">${weak}</div>
            <div>Weak Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card p-3">
            <div class="fs-2">${reused}</div>
            <div>Reused Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card p-3">
            <div class="fs-2">${total}</div>
            <div>Total Passwords</div>
          </div>
        </div>
      </div>
      <div class="mt-4 small text-muted">
        <i class="bi bi-info-circle"></i> Passwords are analyzed locally and never leave your device.
      </div>
    </div>
  `;
}

function renderDeletedItems(pane) {
  const deletedItems = getDeletedPasswords();
  
  // Using the same container style as Watchtower
  pane.innerHTML = `
    <div class="watchtower-container mx-auto" style="max-width:900px;">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1"><i class="bi bi-trash me-2"></i> Recently Deleted</h4>
          <p class="text-muted mb-0">Items will be permanently deleted after 30 days</p>
        </div>
        <button class="btn btn-outline-danger" id="emptyTrashBtn">
          <i class="bi bi-trash"></i> Empty Trash
        </button>
      </div>
      
      <div id="deletedItemsContainer">
        <!-- Items will be inserted here -->
      </div>
    </div>
  `;
  
  const container = document.getElementById('deletedItemsContainer');
  
  if (deletedItems.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted mt-5 py-5">
        <i class="bi bi-trash fs-1 mb-3"></i>
        <p>No deleted items to display.</p>
        <p class="small">Deleted items will be stored here for 30 days.</p>
      </div>
    `;
    return;
  }
  
  // Create cards with the same style as Watchtower cards
  deletedItems.forEach(item => {
    const deleteDate = new Date(item.deleteDate);
    const formattedDate = deleteDate.toLocaleDateString();
    const timeAgo = getTimeAgo(item.deleteDate);
    
    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-3';
    card.setAttribute('data-id', item.id);
    
    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex align-items-center">
          <div class="me-3">
            <i class="pw-icon ${item.icon || 'bi-key'}" style="font-size: 2.5rem;"></i>
          </div>
          <div class="flex-grow-1">
            <h5 class="mb-0">${decrypt(item.title)}</h5>
            <p class="text-muted small mb-1">${decrypt(item.username)}</p>
            <div class="text-muted smaller">
              Deleted: ${formattedDate} (${timeAgo})
            </div>
          </div>
          <div class="ms-3">
            <div class="d-flex">
              <button class="btn btn-sm btn-outline-primary restore-btn me-2" data-id="${item.id}">
                <i class="bi bi-arrow-counterclockwise"></i> Restore
              </button>
              <button class="btn btn-sm btn-outline-danger delete-permanently-btn" data-id="${item.id}">
                <i class="bi bi-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
  
  // Add info footer like in Watchtower
  const footer = document.createElement('div');
  footer.className = 'mt-4 small text-muted';
  footer.innerHTML = `<i class="bi bi-info-circle"></i> Deleted items are stored locally and will be permanently removed after 30 days.`;
  container.appendChild(footer);
  
  // Add event handlers
  document.querySelectorAll('.restore-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      restoreDeletedPassword(btn.dataset.id);
    };
  });
  
  document.querySelectorAll('.delete-permanently-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      permanentlyDeletePassword(btn.dataset.id);
    };
  });
  
  document.getElementById('emptyTrashBtn').onclick = (e) => {
    e.preventDefault();
    showConfirmModal("Permanently delete all items in trash?", () => {
      saveDeletedPasswords([]);
      renderAll();
    });
  };
}

// Helper function to format time ago in a user-friendly way
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}