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
    { id: "cards", name: "Payment Cards", icon: "bi-credit-card-fill", system: true }, // New folder for cards
    { id: "watchtower", name: "Watchtower", icon: "bi-graph-up-arrow", system: true },
    { id: "deleted", name: "Recently Deleted", icon: "bi-trash", system: true }
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
    
    // Different display for cards vs passwords
    let icon, title, subtitle;
    
    if (pw.isCard) {
      // This is a payment card
      icon = pw.cardBrand === 'visa' ? 'bi-credit-card-fill' : 
             pw.cardBrand === 'amex' ? 'bi-credit-card' : 
             'bi-credit-card-2-front-fill';
      
      title = decrypt(pw.cardholderName);
      
      // Format card number for display (masked except last 4)
      const cardNum = decrypt(pw.cardNumber);
      const lastFour = cardNum.replace(/\s/g, '').slice(-4);
      subtitle = `${pw.cardType === 'credit' ? 'Credit' : 'Debit'} •••• ${lastFour}`;
    } else {
      // Regular password
      icon = pickIcon(idx);
      title = decrypt(pw.title);
      subtitle = decrypt(pw.username);
    }
    
    let fav = pw.favorite ? "" : "inactive";
    li.innerHTML = `<i class="pw-icon bi ${icon}"></i>
      <div class="flex-grow-1">
        <div class="item-title">${title}</div>
        <div class="item-sub">${subtitle}</div>
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
      toggleFavorite(pw, pw.folderId || selectedFolder);
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

// Modify the renderDetails function to add card support
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
  
  if (addEditMode === "addCard") {
    renderCardForm();
    return;
  }
  
  if (addEditMode === "edit") {
    const item = findPasswordById(selectedPasswordId);
    if (item && item.isCard) {
      renderCardForm(selectedPasswordId);
    } else {
      renderAddEditForm(selectedPasswordId);
    }
    return;
  }
  
  if (!selectedPasswordId) {
    // Empty state message - customize based on context
    if (selectedFolder === "cards") {
      pane.innerHTML = `<div class="text-center text-muted mt-5">
        <i class="bi bi-credit-card-fill fs-1 mb-2"></i>
        <p>Select a card or add a new one.</p>
      </div>`;
    } else {
      pane.innerHTML = `<div class="text-center text-muted mt-5">
        <i class="bi bi-arrow-left-right fs-1 mb-2"></i>
        <p>Select a password or create a new one.</p>
      </div>`;
    }
    return;
  }
  
  // Show details for selected password or card
  let item = findPasswordById(selectedPasswordId);
  if (!item) {
    pane.innerHTML = `<div class="text-muted">Item not found.</div>`;
    return;
  }
  
  // Check if this is a card or regular password
  if (item.isCard) {
    renderCardDetails(item);
  } else {
    // Original password details view
    let icon = pickIcon(0);
    pane.innerHTML = `
      <div class="mb-4 text-center">
        <i class="pw-icon bi ${icon}"></i>
        <div class="fs-4 mt-2 fw-bold">${decrypt(item.title)}</div>
        <div class="small text-muted">${decrypt(item.username)}</div>
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
        <textarea class="form-control" rows="2" readonly>${decrypt(item.notes||"")}</textarea>
      </div>
      <div class="pw-actions d-flex">
        <button class="btn btn-outline-info" id="editPwBtn"><i class="bi bi-pencil"></i> Edit</button>
        <button class="btn btn-outline-danger" id="deletePwBtn"><i class="bi bi-trash"></i> Delete</button>
      </div>
      <div class="text-muted small mt-3">
        Created: ${item.created || "-"}
        <br>Modified: ${item.updated || "-"}
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
      pwInput.value = shown ? decrypt(item.password) : "********";
      showBtn.innerHTML = shown ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    };
    document.getElementById('copyPwBtn').onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(decrypt(item.password));
    };
    document.getElementById('editPwBtn').onclick = (e) => {
      e.preventDefault();
      addEditMode = "edit";
      renderDetails();
    };
    document.getElementById('deletePwBtn').onclick = (e) => {
      e.preventDefault();
      showConfirmModal("Do you want to remove this element?", () => {
        deletePassword(item, item.folderId || selectedFolder);
        selectedPasswordId = null;
        renderAll();
      });
    };
  }
}

// Add a new function to render card details
function renderCardDetails(card) {
  const pane = document.getElementById('detailPane');
  const cardholderName = decrypt(card.cardholderName);
  const cardNumber = decrypt(card.cardNumber);
  const expiryDate = decrypt(card.expiryDate);
  const cvv = decrypt(card.cvv || "");
  const cardType = card.cardType || "credit";
  const cardBrand = card.cardBrand || "mastercard";
  const cardColor = card.cardColor || "#000000";
  
  const isDarkColor = isColorDark(cardColor);
  const textColor = isDarkColor ? '#ffffff' : '#000000';
  
  pane.innerHTML = `
    <div class="mb-4">
      <div class="card-preview-container">
        <div class="credit-card" style="
          background: ${cardColor}; 
          width: 100%; 
          max-width: 360px; 
          height: 220px; 
          margin: 0 auto 2rem auto;
          border-radius: 16px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.2);
          position: relative; 
          overflow: hidden;">
          
          <!-- Card background pattern -->
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                      background-image: radial-gradient(circle at 80% 20%, 
                      rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.2) 100%);
                      opacity: 0.6;"></div>
                      
          <!-- Subtle grain texture overlay -->
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                      background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj4KICA8ZmlsdGVyIGlkPSJub2lzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjIwMCUiIGhlaWdodD0iMjAwJSI+CiAgICA8ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIgc2VlZD0iMiIgcmVzdWx0PSJ0dXJidWxlbmNlIj48L2ZlVHVyYnVsZW5jZT4KICAgIDxmZUNvbG9yTWF0cml4IHR5cGU9InNhdHVyYXRlIiB2YWx1ZXM9IjAiIGluPSJ0dXJidWxlbmNlIiByZXN1bHQ9ImdyYWluIj48L2ZlQ29sb3JNYXRyaXg+CiAgICA8ZmVCbGVuZCBtb2RlPSJvdmVybGF5IiBpbj0iZ3JhaW4iIHJlc3VsdD0iZ3JhaW4iIHNyYzI9ImdyYWluIj48L2ZlQmxlbmQ+CiAgICA8ZmVCbGVuZCBtb2RlPSJvdmVybGF5IiBpbj0iZ3JhaW4iIHJlc3VsdD0iZ3JhaW4iPjwvZmVCbGVuZD4KICA8L2ZpbHRlcj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMC4wOCI+PC9yZWN0Pgo8L3N2Zz4=');
                      opacity: 0.4;"></div>
          
          <!-- Card content -->
          <div style="position: relative; padding: 24px; height: 100%; 
                      display: flex; flex-direction: column; justify-content: space-between;
                      color: ${textColor};">
            <!-- Top section -->
            <div class="d-flex justify-content-between align-items-start">
              <div style="font-size: 1.1rem; font-weight: 600; letter-spacing: 0.5px;">
                ${cardType === 'debit' ? 'Debit Card' : 'Credit Card'}
              </div>
              
              <!-- Small brand logo in top corner -->
              <div>
                ${renderCardLogo(cardBrand, textColor, 'small')}
              </div>
            </div>
            
            <!-- Chip section -->
            <div class="d-flex align-items-center mt-2 mb-3">
              <!-- EMV Chip -->
              <div style="
                width: 42px;
                height: 32px; 
                background: linear-gradient(135deg, #D4AF37 0%, #F4E5A7 50%, #D4AF37 100%); 
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                <div style="
                  width: 75%; 
                  height: 73%; 
                  background: linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%);
                  border-radius: 2px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  padding: 2px 0;">
                  <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                  <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                  <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                </div>
              </div>
              
              <!-- NFC icon -->
              <div style="margin-left: 10px; transform: rotate(90deg); opacity: 0.7;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12" 
                    stroke="${textColor}" stroke-width="2" stroke-linecap="round"/>
                  <path d="M16 8C16 9.65685 14.6569 11 13 11C11.3431 11 10 9.65685 10 8C10 6.34315 11.3431 5 13 5" 
                    stroke="${textColor}" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
            
            <!-- Card number -->
            <div style="position: relative;">
              <div id="cardNumberDisplay" style="
                font-family: 'Courier New', monospace; 
                font-size: 1.5rem;
                letter-spacing: 0.2rem;
                font-weight: 500;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                ${formatCardNumberForDisplay(cardNumber)}
              </div>
              <button id="toggleCardNumber" class="btn btn-sm position-absolute" 
                     style="top: -10px; right: -10px; padding: 0.15rem 0.4rem; 
                     background: rgba(255,255,255,0.2); border: none;">
                <i class="bi bi-eye" style="color: ${textColor}; opacity: 0.8;"></i>
              </button>
            </div>
            
            <!-- Bottom section -->
            <div class="d-flex justify-content-between align-items-end mt-3">
              <!-- Cardholder info -->
              <div>
                <div style="font-size: 0.65rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                  CARD HOLDER
                </div>
                <div style="font-size: 1rem; font-weight: 500; letter-spacing: 0.05rem;">
                  ${cardholderName}
                </div>
              </div>
              
              <!-- Expiry date -->
              <div>
                <div style="font-size: 0.65rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                  EXPIRES
                </div>
                <div style="font-size: 1rem; font-weight: 500;">
                  ${expiryDate}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Large brand logo in bottom right -->
          <div style="position: absolute; bottom: 20px; right: 20px;">
            ${renderCardLogo(cardBrand, textColor, 'large')}
          </div>
        </div>
      </div>
      
      <!-- Card details -->
      <div class="row mt-4 mb-3">
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label">CVV/CVC</label>
            <div class="input-group">
              <input type="password" class="form-control" id="detailCVV" value="***" readonly>
              <button class="btn btn-outline-secondary" id="showHideCVV" title="Show/Hide">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary" id="copyCVV" title="Copy">
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label">Notes</label>
        <textarea class="form-control" rows="2" readonly>${decrypt(card.notes||"")}</textarea>
      </div>
    </div>
    
    <div class="pw-actions d-flex">
      <button class="btn btn-outline-info" id="editCardBtn"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn btn-outline-danger" id="deleteCardBtn"><i class="bi bi-trash"></i> Delete</button>
    </div>
    <div class="text-muted small mt-3">
      Created: ${card.created || "-"}
      <br>Modified: ${card.updated || "-"}
    </div>
  `;

  // Toggle card number visibility
  const toggleBtn = document.getElementById('toggleCardNumber');
  const cardNumberElement = document.getElementById('cardNumberDisplay');
  let numberShown = false;
  
  toggleBtn.onclick = (e) => {
    numberShown = !numberShown;
    if (numberShown) {
      let formattedNum = formatCardNumberWithSpaces(cardNumber);
      cardNumberElement.innerText = formattedNum || '0000 0000 0000 0000';
      toggleBtn.innerHTML = `<i class="bi bi-eye-slash" style="color: ${textColor}; opacity: 0.8;"></i>`;
    } else {
      cardNumberElement.innerText = formatCardNumberForDisplay(cardNumber);
      toggleBtn.innerHTML = `<i class="bi bi-eye" style="color: ${textColor}; opacity: 0.8;"></i>`;
    }
  };
  
  // CVV show/hide
  const cvvBtn = document.getElementById('showHideCVV');
  const cvvInput = document.getElementById('detailCVV');
  let cvvShown = false;
  
  cvvBtn.onclick = (e) => {
    cvvShown = !cvvShown;
    cvvInput.type = cvvShown ? "text" : "password";
    cvvInput.value = cvvShown ? cvv : "***";
    cvvBtn.innerHTML = cvvShown ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  };
  
  // Copy CVV
  document.getElementById('copyCVV').onclick = (e) => {
    navigator.clipboard.writeText(cvv);
  };
  
  // Edit and Delete buttons
  document.getElementById('editCardBtn').onclick = (e) => {
    addEditMode = "edit";
    renderDetails();
  };
  
  document.getElementById('deleteCardBtn').onclick = (e) => {
    showConfirmModal("Do you want to delete this card?", () => {
      deletePassword(card, card.folderId || selectedFolder);
      selectedPasswordId = null;
      renderAll();
    });
  };
}

// Helper function to determine if a color is dark or light
function isColorDark(hexColor) {
  // Convert hex to RGB
  hexColor = hexColor.replace('#', '');
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5; // Dark colors have luminance < 0.5
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
  
  // Customize the Add button based on current folder
  const addButton = document.getElementById('addPasswordBtn');
  if (selectedFolder === "cards") {
    addButton.innerHTML = '<i class="bi bi-plus-lg"></i> New Card';
  } else {
    addButton.innerHTML = '<i class="bi bi-plus-lg"></i> New Item';
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

// Update the addPasswordBtn event handler to fix any issues
document.getElementById('addPasswordBtn').onclick = () => {
  // If we're in the cards folder, default to adding a card
  if (selectedFolder === "cards") {
    addEditMode = "addCard";
  } else {
    addEditMode = "add";
  }
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
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('pmx_theme', theme);
  
  // Update button states
  if (theme === 'light') {
    document.getElementById('themeLight').classList.remove('btn-outline-primary');
    document.getElementById('themeLight').classList.add('btn-primary');
    document.getElementById('themeDark').classList.remove('btn-dark');
    document.getElementById('themeDark').classList.add('btn-outline-dark');
  } else {
    document.getElementById('themeLight').classList.remove('btn-primary');
    document.getElementById('themeLight').classList.add('btn-outline-primary');
    document.getElementById('themeDark').classList.remove('btn-outline-dark');
    document.getElementById('themeDark').classList.add('btn-dark');
  }
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
      <div class="mb-5">
        <h4 class="mb-3"><i class="bi bi-graph-up-arrow me-2"></i> Watchtower</h4>
        <div class="mb-2 fw-medium">Overall Password Strength</div>
        <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border-color);">${bar}</div>
        <div class="mt-3">
          <span class="badge bg-success me-1">Strong: ${stats[5] + stats[4]}</span>
          <span class="badge bg-warning text-dark me-1">Medium: ${stats[3]}</span>
          <span class="badge bg-danger">Weak: ${stats[2] + stats[1] + stats[0]}</span>
        </div>
      </div>
      <div class="row g-4">
        <div class="col-12 col-md-4">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${weak}</div>
            <div class="text-secondary">Weak Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${reused}</div>
            <div class="text-secondary">Reused Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${total}</div>
            <div class="text-secondary">Total Passwords</div>
          </div>
        </div>
      </div>
      <div class="mt-5 text-secondary d-flex align-items-center">
        <i class="bi bi-shield-check me-2"></i> 
        <span>Passwords are analyzed locally and never leave your device.</span>
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
          <p class="text-secondary mb-0">Items will be permanently deleted after 30 days</p>
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
      <div class="text-center text-secondary mt-5 py-5">
        <i class="bi bi-trash fs-1 mb-3 opacity-50"></i>
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
          <div class="me-4">
            <i class="pw-icon ${item.icon || 'bi-key'}" style="font-size: 2.5rem;"></i>
          </div>
          <div class="flex-grow-1">
            <h5 class="mb-0">${decrypt(item.title)}</h5>
            <p class="text-secondary small mb-1">${decrypt(item.username)}</p>
            <div class="text-secondary smaller">
              Deleted: ${formattedDate} <span class="badge bg-light text-secondary">${timeAgo}</span>
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
  footer.className = 'mt-4 small text-secondary';
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

// Add this function after renderAddEditForm function
function renderCardForm(editId) {
  const pane = document.getElementById('detailPane');
  let editing = !!editId;
  let card = null;
  
  if (editing) {
    card = findPasswordById(editId);
    if (!card) return;
  } else {
    card = {};
  }
  
  // Default values
  const cardholderName = editing ? decrypt(card.cardholderName || "") : "";
  const cardNumber = editing ? decrypt(card.cardNumber || "") : "";
  const expiryDate = editing ? decrypt(card.expiryDate || "") : "";
  const cvv = editing ? decrypt(card.cvv || "") : "";
  const cardType = card.cardType || "credit";
  const cardBrand = card.cardBrand || "mastercard";
  const cardColor = card.cardColor || "#000000";
  
  // Calculate text color based on background
  const isDarkColor = isColorDark(cardColor);
  const textColor = isDarkColor ? '#ffffff' : '#000000';
  
  pane.innerHTML = `
    <form id="cardForm" autocomplete="off">
      <div class="mb-4 mt-2">
        <!-- Improved card preview -->
        <div class="card-preview-container mb-4">
          <div class="credit-card" id="cardPreview" style="
            background: ${cardColor}; 
            width: 100%; 
            max-width: 360px; 
            height: 220px; 
            margin: 0 auto 1.5rem auto;
            border-radius: 16px;
            box-shadow: 0 12px 24px rgba(0,0,0,0.2);
            position: relative; 
            overflow: hidden;">
            
            <!-- Card background pattern -->
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                        background-image: radial-gradient(circle at 80% 20%, 
                        rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.2) 100%);
                        opacity: 0.6;"></div>
                        
            <!-- Subtle grain texture overlay -->
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj4KICA8ZmlsdGVyIGlkPSJub2lzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjIwMCUiIGhlaWdodD0iMjAwJSI+CiAgICA8ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIgc2VlZD0iMiIgcmVzdWx0PSJ0dXJidWxlbmNlIj48L2ZlVHVyYnVsZW5jZT4KICAgIDxmZUNvbG9yTWF0cml4IHR5cGU9InNhdHVyYXRlIiB2YWx1ZXM9IjAiIGluPSJ0dXJidWxlbmNlIiByZXN1bHQ9ImdyYWluIj48L2ZlQ29sb3JNYXRyaXg+CiAgICA8ZmVCbGVuZCBtb2RlPSJvdmVybGF5IiBpbj0iZ3JhaW4iIHJlc3VsdD0iZ3JhaW4iIHNyYzI9ImdyYWluIj48L2ZlQmxlbmQ+CiAgICA8ZmVCbGVuZCBtb2RlPSJvdmVybGF5IiBpbj0iZ3JhaW4iIHJlc3VsdD0iZ3JhaW4iPjwvZmVCbGVuZD4KICA8L2ZpbHRlcj4KICA8cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMC4wOCI+PC9yZWN0Pgo8L3N2Zz4=');
                        opacity: 0.4;"></div>
            
            <!-- Card content -->
            <div style="position: relative; padding: 24px; height: 100%; 
                        display: flex; flex-direction: column; justify-content: space-between;
                        color: ${textColor};">
              <!-- Top section -->
              <div class="d-flex justify-content-between align-items-start">
                <div id="previewCardType" style="font-size: 1.1rem; font-weight: 600; letter-spacing: 0.5px;">
                  ${cardType === 'debit' ? 'Debit Card' : 'Credit Card'}
                </div>
                
                <!-- Small brand logo in top corner -->
                <div id="previewSmallLogo">
                  ${renderCardLogo(cardBrand, textColor, 'small')}
                </div>
              </div>
              
              <!-- Chip section -->
              <div class="d-flex align-items-center mt-2 mb-3">
                <!-- EMV Chip -->
                <div style="
                  width: 42px;
                  height: 32px; 
                  background: linear-gradient(135deg, #D4AF37 0%, #F4E5A7 50%, #D4AF37 100%); 
                  border-radius: 5px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                  <div style="
                    width: 75%; 
                    height: 73%; 
                    background: linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%);
                    border-radius: 2px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 2px 0;">
                    <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                    <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                    <div style="height: 1.5px; background: rgba(0,0,0,0.3);"></div>
                  </div>
                </div>
                
                <!-- NFC icon -->
                <div style="margin-left: 10px; transform: rotate(90deg); opacity: 0.7;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12" 
                      stroke="${textColor}" stroke-width="2" stroke-linecap="round"/>
                    <path d="M16 8C16 9.65685 14.6569 11 13 11C11.3431 11 10 9.65685 10 8C10 6.34315 11.3431 5 13 5" 
                      stroke="${textColor}" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
              </div>
              
              <!-- Card number -->
              <div>
                <div id="previewCardNumber" style="
                  font-family: 'Courier New', monospace; 
                  font-size: 1.5rem;
                  letter-spacing: 0.2rem;
                  font-weight: 500;
                  text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                  ${formatCardNumberForDisplay(cardNumber || '0000 0000 0000 0000')}
                </div>
              </div>
              
              <!-- Bottom section -->
              <div class="d-flex justify-content-between align-items-end mt-3">
                <!-- Cardholder info -->
                <div>
                  <div style="font-size: 0.65rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                    CARD HOLDER
                  </div>
                  <div id="previewCardholderName" style="font-size: 1rem; font-weight: 500; letter-spacing: 0.05rem;">
                    ${cardholderName || 'YOUR NAME'}
                  </div>
                </div>
                
                <!-- Expiry date -->
                <div>
                  <div style="font-size: 0.65rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                    EXPIRES
                  </div>
                  <div id="previewExpiryDate" style="font-size: 1rem; font-weight: 500;">
                    ${expiryDate || 'MM/YY'}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Large brand logo in bottom right -->
            <div id="previewLargeLogo" style="position: absolute; bottom: 20px; right: 20px;">
              ${renderCardLogo(cardBrand, textColor, 'large')}
            </div>
          </div>
        </div>
        
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Card Type</label>
            <select class="form-select" name="cardType" id="cardTypeInput" required>
              <option value="credit" ${cardType === 'credit' ? 'selected' : ''}>Credit Card</option>
              <option value="debit" ${cardType === 'debit' ? 'selected' : ''}>Debit Card</option>
            </select>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Card Brand</label>
            <select class="form-select" name="cardBrand" id="cardBrandInput" required>
              <option value="mastercard" ${cardBrand === 'mastercard' ? 'selected' : ''}>Mastercard</option>
              <option value="visa" ${cardBrand === 'visa' ? 'selected' : ''}>Visa</option>
              <option value="amex" ${cardBrand === 'amex' ? 'selected' : ''}>American Express</option>
              <option value="other" ${cardBrand === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
        
        <div class="mb-3">
          <label class="form-label">Card Color</label>
          <input type="color" class="form-control form-control-color" name="cardColor" id="cardColorInput" 
                 value="${cardColor}" style="width: 100%; max-width: 100px;">
        </div>
        
        <div class="mb-3">
          <label class="form-label">Cardholder Name</label>
          <input type="text" class="form-control" name="cardholderName" id="cardholderNameInput" 
                 value="${cardholderName}" required placeholder="Name on card">
        </div>
        
        <div class="mb-3">
          <label class="form-label">Card Number</label>
          <input type="text" class="form-control" name="cardNumber" id="cardNumberInput" 
                 value="${cardNumber}" required placeholder="1234 5678 9012 3456" maxlength="19">
        </div>
        
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Expiry Date</label>
            <input type="text" class="form-control" name="expiryDate" id="expiryDateInput" 
                  value="${expiryDate}" required placeholder="MM/YY" maxlength="5">
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">CVV/CVC</label>
            <input type="password" class="form-control" name="cvv" 
                  value="${cvv}" required placeholder="123" maxlength="4">
          </div>
        </div>
        
        <div class="mb-3">
          <label class="form-label">Notes (optional)</label>
          <textarea class="form-control" name="notes" rows="2">${editing ? decrypt(card.notes || '') : ''}</textarea>
        </div>
      </div>
      
      <div class="d-flex">
        <button class="btn btn-success me-2" type="submit">${editing ? "Save" : "Add"}</button>
        <button class="btn btn-outline-secondary" type="button" id="cancelCardBtn">Cancel</button>
      </div>
    </form>
  `;
  
  // Add event listeners for live preview
  document.getElementById('cardholderNameInput').addEventListener('input', function() {
    document.getElementById('previewCardholderName').innerText = this.value || 'YOUR NAME';
  });
  
  document.getElementById('cardNumberInput').addEventListener('input', function() {
    let value = this.value.replace(/\D/g, '');
    let formattedValue = '';
    
    for (let i = 0; i < value.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedValue += ' ';
      }
      formattedValue += value[i];
    }
    
    this.value = formattedValue;
    document.getElementById('previewCardNumber').innerText = 
      formatCardNumberForDisplay(formattedValue || '0000 0000 0000 0000');
  });
  
  document.getElementById('expiryDateInput').addEventListener('input', function() {
    let value = this.value.replace(/\D/g, '');
    let formattedValue = '';
    
    if (value.length > 0) {
      formattedValue = value.substring(0, 2);
      if (value.length > 2) {
        formattedValue += '/' + value.substring(2, 4);
      }
    }
    
    this.value = formattedValue;
    document.getElementById('previewExpiryDate').innerText = formattedValue || 'MM/YY';
  });
  
  document.getElementById('cardTypeInput').addEventListener('change', function() {
    document.getElementById('previewCardType').innerText = 
      this.value === 'debit' ? 'Debit Card' : 'Credit Card';
  });
  
  document.getElementById('cardColorInput').addEventListener('input', updateCardPreview);
  document.getElementById('cardBrandInput').addEventListener('change', updateCardPreview);
  
  function updateCardPreview() {
    const cardColor = document.getElementById('cardColorInput').value;
    const cardBrand = document.getElementById('cardBrandInput').value;
    const isDarkColor = isColorDark(cardColor);
    const textColor = isDarkColor ? '#ffffff' : '#000000';
    
    // Update card background
    document.getElementById('cardPreview').style.background = cardColor;
    
    // Update text color for all text elements
    const textElements = document.querySelectorAll('#cardPreview [style*="color:"]');
    textElements.forEach(el => {
      el.style.color = textColor;
    });
    
    // Update SVG elements
    document.getElementById('previewSmallLogo').innerHTML = renderCardLogo(cardBrand, textColor, 'small');
    document.getElementById('previewLargeLogo').innerHTML = renderCardLogo(cardBrand, textColor, 'large');
    
    // Update NFC icon
    const nfcPath = document.querySelector('#cardPreview svg path');
    if (nfcPath) nfcPath.setAttribute('stroke', textColor);
  }
  
  document.getElementById('cancelCardBtn').onclick = () => {
    addEditMode = null;
    renderDetails();
  };
  
  // Keep the form submission handler unchanged
  document.getElementById('cardForm').onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    if (!data.cardholderName || !data.cardNumber || !data.expiryDate || !data.cvv) return;
    
    let now = new Date().toLocaleString();
    const folderId = "cards"; // Always store in the cards system folder
    
    const cardData = {
      id: editing ? editId : Math.random().toString(36).slice(2),
      cardholderName: encrypt(data.cardholderName),
      cardNumber: encrypt(data.cardNumber),
      expiryDate: encrypt(data.expiryDate),
      cvv: encrypt(data.cvv),
      notes: encrypt(data.notes || ""),
      cardType: data.cardType,
      cardBrand: data.cardBrand,
      cardColor: data.cardColor,
      created: editing ? card.created : now,
      updated: now,
      favorite: editing ? card.favorite || false : false,
      isCard: true, // Flag to identify it as a card
      folderId: folderId
    };
    
    if (editing) {
      let items = getPasswords(folderId);
      let idx = items.findIndex(x => x.id === editId);
      if (idx >= 0) {
        items[idx] = cardData;
      } else {
        items.push(cardData);
      }
      savePasswords(folderId, items);
    } else {
      let items = getPasswords(folderId);
      items.push(cardData);
      savePasswords(folderId, items);
    }
    
    addEditMode = null;
    selectedPasswordId = cardData.id;
    
    // If not already in the cards folder, switch to it
    if (selectedFolder !== "cards") {
      selectedFolder = "cards";
    }
    renderAll();
  };
}

// Add this function that was missing
function renderAddEditForm(editId) {
  const pane = document.getElementById('detailPane');
  let editing = !!editId;
  let password = null;
  
  if (editing) {
    password = findPasswordById(editId);
    if (!password) return;
  } else {
    password = {};
  }
  
  // Create a list of all available folders for the dropdown
  const folders = getFolders().filter(f => !f.system);
  const folderOptions = folders.map(f => 
    `<option value="${f.id}" ${editing && password.folderId === f.id ? 'selected' : ''}>${f.name}</option>`
  ).join('');
  
  // Add an "unassigned" option that will show in All Items
  const unassignedSelected = editing && (!password.folderId || password.folderId === "unassigned");
  const unassignedOption = `<option value="unassigned" ${unassignedSelected ? 'selected' : ''}>All Items (No Folder)</option>`;
  
  pane.innerHTML = `
    <form id="passwordForm" autocomplete="off">
      <div class="mb-3">
        <label class="form-label">Title</label>
        <input type="text" class="form-control" name="title" value="${editing ? decrypt(password.title || "") : ""}" required placeholder="Website or App Name">
      </div>
      <div class="mb-3">
        <label class="form-label">Username/Email</label>
        <input type="text" class="form-control" name="username" value="${editing ? decrypt(password.username || "") : ""}" placeholder="Username or Email">
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <div class="input-group">
          <input type="password" class="form-control" name="password" id="passwordField" value="${editing ? decrypt(password.password || "") : ""}" required>
          <button class="btn btn-outline-secondary" type="button" id="showPasswordBtn"><i class="bi bi-eye"></i></button>
          <button class="btn btn-outline-secondary" type="button" id="generatePasswordBtn"><i class="bi bi-magic"></i> Generate</button>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Folder</label>
        <select class="form-select" name="folder">
          ${unassignedOption}
          ${folderOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Notes</label>
        <textarea class="form-control" name="notes" rows="3">${editing ? decrypt(password.notes || "") : ""}</textarea>
      </div>
      <div class="d-flex">
        <button class="btn btn-success me-2" type="submit">${editing ? "Save" : "Add"}</button>
        <button class="btn btn-outline-secondary" type="button" id="cancelBtn">Cancel</button>
      </div>
    </form>
  `;

  // Show/Hide Password button
  document.getElementById('showPasswordBtn').onclick = () => {
    const field = document.getElementById('passwordField');
    if (field.type === "password") {
      field.type = "text";
      document.getElementById('showPasswordBtn').innerHTML = '<i class="bi bi-eye-slash"></i>';
    } else {
      field.type = "password";
      document.getElementById('showPasswordBtn').innerHTML = '<i class="bi bi-eye"></i>';
    }
  };
  
  // Generate Password button
  document.getElementById('generatePasswordBtn').onclick = () => {
    const field = document.getElementById('passwordField');
    
    // Generate a strong password with letters, numbers and symbols
    const length = 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    field.type = "text";
    field.value = password;
    document.getElementById('showPasswordBtn').innerHTML = '<i class="bi bi-eye-slash"></i>';
    
    // Flash the field to indicate it changed
    field.classList.add('bg-light');
    setTimeout(() => field.classList.remove('bg-light'), 200);
  };

  // Cancel button
  document.getElementById('cancelBtn').onclick = () => {
    addEditMode = null;
    renderDetails();
  };

  // Form submission
  document.getElementById('passwordForm').onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    if (!data.title || !data.password) return;
    
    let now = new Date().toLocaleString();
    const folderId = data.folder;
    
    // Remove folder from data before creating the password object
    delete data.folder;
    
    const passwordData = {
      id: editing ? editId : Math.random().toString(36).slice(2),
      title: encrypt(data.title),
      username: encrypt(data.username || ""),
      password: encrypt(data.password),
      notes: encrypt(data.notes || ""),
      created: editing ? password.created : now,
      updated: now,
      favorite: editing ? password.favorite || false : false
    };
    
    if (editing) {
      let originalFolderId = password.folderId || "unassigned";
      
      // If folder hasn't changed, update in place
      if (originalFolderId === folderId) {
        let items = getPasswords(folderId);
        let idx = items.findIndex(x => x.id === editId);
        if (idx >= 0) {
          items[idx] = passwordData;
        } else {
          items.push(passwordData);
        }
        savePasswords(folderId, items);
      } else {
        // Remove from original folder
        let originalItems = getPasswords(originalFolderId);
        originalItems = originalItems.filter(x => x.id !== editId);
        savePasswords(originalFolderId, originalItems);
        
        // Add to new folder
        let targetItems = getPasswords(folderId);
        targetItems.push(passwordData);
        savePasswords(folderId, targetItems);
      }
    } else {
      let items = getPasswords(folderId);
      items.push(passwordData);
      savePasswords(folderId, items);
    }
    
    addEditMode = null;
    selectedPasswordId = passwordData.id;
    
    // If folder has changed and is not a system folder, switch to that folder view
    if (folderId !== "unassigned" && !getFolders().find(f => f.id === folderId && f.system)) {
      selectedFolder = folderId;
    }
    
    renderAll();
  };
}

// Format card number nicely with spaces
function formatCardNumberWithSpaces(cardNumber) {
  if (!cardNumber) return '0000 0000 0000 0000';
  
  const cleaned = cardNumber.replace(/\D/g, '');
  let formatted = '';
  
  for (let i = 0; i < cleaned.length; i++) {
    if (i > 0 && i % 4 === 0) {
      formatted += ' ';
    }
    formatted += cleaned[i];
  }
  
  return formatted;
}

// Better card number masking
function formatCardNumberForDisplay(number) {
  if (typeof number !== 'string') return '•••• •••• •••• ••••';
  
  // Clean the number first
  const cleaned = number.replace(/\D/g, '');
  
  // For display, mask all but last 4 digits
  if (cleaned.length > 4) {
    const lastFour = cleaned.slice(-4);
    return `•••• •••• •••• ${lastFour}`;
  } else if (cleaned.length > 0) {
    return '•••• •••• •••• ' + cleaned.padStart(4, '•');
  } else {
    return '•••• •••• •••• ••••';
  }
}

// Render appropriate card logo based on brand
function renderCardLogo(cardBrand, textColor, size) {
  // Define sizes based on small or large
  const scale = size === 'small' ? 0.7 : 1;
  
  switch(cardBrand) {
    case 'visa':
      return `
        <svg width="${60 * scale}" height="${20 * scale}" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.9 0.4H19.1L15.9 12.6L14.3 1.8C14.1 0.9 13.5 0.4 12.7 0.4H5.3L5.2 0.8C6.5 1.1 7.7 1.4 8.7 1.8C9.3 2.1 9.4 2.3 9.6 3L12.3 19.6H17.4L22.7 0.4H23.9Z" fill="${textColor}"/>
          <path d="M44.5 19.6H49.2L46 0.4H42.1C41.1 0.4 40.4 0.9 40 1.9L33.4 19.6H38.5L39.3 17.1H44.2L44.5 19.6ZM40.8 13.4L42.8 6.9L43.9 13.4H40.8Z" fill="${textColor}"/>
          <path d="M33.1 4.5L33.8 0.8C32.3 0.3 30.7 0 29 0C26.2 0 22.3 1.3 22.3 5.2C22.3 8.2 25.2 9.7 27.3 10.6C29.5 11.5 30.2 12.1 30.2 12.9C30.2 14.2 28.5 14.8 27 14.8C24.8 14.8 23.7 14.5 22 13.8L21.3 17.6C23 18.3 24.8 18.6 26.5 18.6C29.9 18.7 33.6 17.3 33.6 13.1C33.6 9.3 29.2 8.4 29.2 6.5C29.2 5.5 30.2 4.9 32.1 4.9C33.2 4.9 34.5 5.3 35.5 5.7L33.1 4.5Z" fill="${textColor}"/>
          <path d="M57.1 0.4L53 13.5L52.6 11.7C51.8 9.3 49.4 6.7 46.6 5.3L50.4 19.6H55.5L62 0.4H57.1Z" fill="${textColor}"/>
        </svg>`;
    
    case 'amex':
      return `
        <svg width="${60 * scale}" height="${40 * scale}" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="50" height="30" rx="4" fill="#006FCF"/>
          <path d="M15 25H10V15H15L18 21V15H23V25H18L15 19V25Z" fill="#FFFFFF"/>
          <path d="M25 25V15H35V18H28V19H35V22H28V23H35V25H25Z" fill="#FFFFFF"/>
          <path d="M40 15H36V25H39V22H40C43 22 45 21 45 18.5C45 16 43 15 40 15ZM40 19H39V17H40C40.5 17 41 17 41 18C41 19 40.5 19 40 19Z" fill="#FFFFFF"/>
        </svg>`;
      
    case 'mastercard':
      return `
        <div style="display: flex; align-items: center;">
          <div style="width: ${30 * scale}px; height: ${30 * scale}px; border-radius: 50%; background-color: #EB001B; opacity: 0.9;"></div>
          <div style="width: ${30 * scale}px; height: ${30 * scale}px; border-radius: 50%; background-color: #F79E1B; opacity: 0.9; margin-left: ${-15 * scale}px;"></div>
        </div>`;
      
    default: // Generic card
      return `
        <svg width="${36 * scale}" height="${24 * scale}" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="32" height="18" rx="3" stroke="${textColor}" stroke-width="1.5"/>
          <path d="M2 10H34" stroke="${textColor}" stroke-width="1.5"/>
          <path d="M8 18H10" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M14 18H16" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
  }
}