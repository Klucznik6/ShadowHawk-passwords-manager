// --- User/Folders/Passwords, localStorage, encryption, UI logic ---

// Window Controls for Custom Title Bar
function initializeWindowControls() {
  const closeBtn = document.getElementById('closeBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      // Since we can't directly minimize from renderer, we'll hide the window
      if (window.electronAPI) {
        window.electronAPI.minimize();
      } else {
        // Fallback - just hide the app content
        document.body.style.display = 'none';
      }
    });
  }
}

// Initialize window controls when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeWindowControls();
});

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
  // Generate 5 segments of 4 characters each (20 total chars, excluding dashes)
  const segments = [];
  for (let i = 0; i < 5; i++) {
    segments.push(Math.random().toString(36).slice(2, 6));
  }
  return segments.join('-');
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
  if (!cipher) return '';
  
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, getEncryptionKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || ''; // Return empty string if decryption gives empty result
  } catch(e) {
    return ''; // Return empty string instead of error
  }
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
// Update the getPasswords function to filter cards from "all" view
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
    
    // Filter out any cards - cards should only be in the cards section
    out = out.filter(item => !item.isCard);
    
  } else if (folderId === "favorites") {
    // Include favorites from all folders and unassigned
    for (const fId of [...allFolders, "unassigned"]) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, fId)) || "[]");
      out.push(...items.filter(it => it.favorite).map(it => ({...it, folderId: fId})));
    }
    
    // Include favorites from cards folder too
    let cardItems = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, "cards")) || "[]");
    out.push(...cardItems.filter(it => it.favorite).map(it => ({...it, folderId: "cards"})));
    
  } else {
    // For any other folder, just get its items
    out = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, folderId)) || "[]");
  }
  
  // Filter by search term if provided
  if (searchTerm?.trim()) {
    const q = searchTerm.trim().toLowerCase();
    out = out.filter(pw =>
      decrypt(pw.title||"").toLowerCase().includes(q) ||
      decrypt(pw.username||"").toLowerCase().includes(q) ||
      // For cards, also search cardholder name
      (pw.isCard && decrypt(pw.cardholderName||"").toLowerCase().includes(q))
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
function getFaviconUrl(url) {
  try {
    // Try to extract the domain from a URL
    let domain = url;
    if (url.includes('://')) {
      domain = url.split('://')[1];
    }
    if (domain.includes('/')) {
      domain = domain.split('/')[0];
    }
    
    // Use Google's favicon service
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (e) {
    return null;
  }
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

// Add this function to extract website name from URL
function extractWebsiteNameFromURL(url) {
  try {
    // Remove protocol
    let domain = url;
    if (domain.includes('://')) {
      domain = domain.split('://')[1];
    }
    
    // Remove path
    if (domain.includes('/')) {
      domain = domain.split('/')[0];
    }
    
    // Remove www. prefix if present
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    // Remove subdomains (keep only main domain and TLD)
    const parts = domain.split('.');
    if (parts.length > 2) {
      // For domains like login.example.com, get example.com
      domain = parts.slice(-2).join('.');
    }
    
    // Capitalize first letter
    if (domain && domain.length > 0) {
      domain = domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    
    return domain;
  } catch (e) {
    return url; // Return original if parsing fails
  }
}

// Updated renderPasswordsList function
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
    let iconElement, title, subtitle, websiteUrl = '';
    
    if (pw.isCard) {
      // This is a payment card
      let iconClass = pw.cardBrand === 'visa' ? 'bi-credit-card-fill' : 
                     pw.cardBrand === 'amex' ? 'bi-credit-card' : 
                     'bi-credit-card-2-front-fill';
      
      title = decrypt(pw.cardholderName);
      
      // Format card number for display (masked except last 4)
      const cardNum = decrypt(pw.cardNumber);
      const lastFour = cardNum.replace(/\s/g, '').slice(-4);
      subtitle = `${pw.cardType === 'credit' ? 'Credit' : 'Debit'} •••• ${lastFour}`;
      
      // For cards, use regular icon rendering
      let fav = pw.favorite ? "" : "inactive";
      iconElement = `<i class="pw-icon bi ${iconClass}"></i>`;
      
      li.innerHTML = `${iconElement}
        <div class="flex-grow-1">
          <div class="item-title">${title}</div>
          <div class="item-sub">${subtitle}</div>
        </div>
        <i class="pw-fav bi bi-star-fill ${fav}" title="Favorite"></i>`;
    } else {
      // Regular password - attempt to use website favicon or letter icon
      let fullTitle = decrypt(pw.title || "");
      subtitle = decrypt(pw.username || "");
      
      // Extract domain name from URL if it looks like one
      let isWebsite = false;
      
      if (fullTitle.includes('http') || 
          fullTitle.includes('.com') || 
          fullTitle.includes('.org') || 
          fullTitle.includes('.net') || 
          fullTitle.includes('.io')) {
        // Store the full URL for favicon but show only the domain name
        websiteUrl = fullTitle;
        title = extractWebsiteNameFromURL(fullTitle);
        isWebsite = true;
      } else {
        // Not a URL, use the title as-is
        title = fullTitle;
      }
      
      // Create the icon element
      if (isWebsite && websiteUrl) {
        // Use favicon for websites
        const faviconUrl = getFaviconUrl(websiteUrl);
        iconElement = `<div class="pw-favicon me-2">
          <img src="${faviconUrl}" onerror="this.onerror=null; this.src=''; this.classList.add('bi', 'bi-globe');" 
              style="width: 22px; height: 22px; object-fit: contain;">
        </div>`;
      } else {
        // Use colored letter icon for non-websites
        const firstLetter = title.charAt(0).toUpperCase();
        const colorIndex = title.length % 10; // Get a consistent color based on title length
        const colors = [
          '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
          '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c' // More vibrant colors
        ];
        const bgColor = colors[colorIndex];
        
        iconElement = `<div class="pw-favicon me-2">
          <div class="pw-icon-box" style="
            width: 22px;
            height: 22px;
            background-color: ${bgColor};
            border-radius: 6px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
          ">${firstLetter}</div>
        </div>`;
      }
      
      // Build list item with correct icon
      let fav = pw.favorite ? "" : "inactive";
      li.innerHTML = `
        ${iconElement}
        <div class="flex-grow-1">
          <div class="item-title">${title}</div>
          <div class="item-sub">${subtitle}</div>
        </div>
        <i class="pw-fav bi bi-star-fill ${fav}" title="Favorite"></i>`;
    }
    
    li.onclick = (e) => {
      if (e.target.classList.contains('pw-fav')) return;
      
      // Toggle selection - if clicking the same item again, deselect it
      if (selectedPasswordId === pw.id) {
        selectedPasswordId = null;
      } else {
        selectedPasswordId = pw.id;
      }
      
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
// Updated renderDetails function to hide URL and show favicon
// Updated renderDetails function to show consistent graphics for non-URL passwords
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
    let fullTitle = decrypt(item.title || "");
    let displayTitle = fullTitle;
    let isWebsite = false;
    let faviconUrl = null;
    
    // Check if title is a URL and get clean display name and favicon
    if (fullTitle.includes('http') || 
        fullTitle.includes('.com') || 
        fullTitle.includes('.org') || 
        fullTitle.includes('.net') || 
        fullTitle.includes('.io')) {
      
      // For display, show just the domain name
      displayTitle = extractWebsiteNameFromURL(fullTitle);
      
      // Get favicon URL
      faviconUrl = getFaviconUrl(fullTitle);
      isWebsite = true;
    }
    
    // Check if notes exist and are not empty
    const notesContent = decrypt(item.notes || "");
    const notesSection = notesContent ? `
      <div class="mb-2">
        <label class="form-label mt-2">Notes</label>
        <textarea class="form-control" rows="2" readonly>${notesContent}</textarea>
      </div>
    ` : '';
    
    // Choose the appropriate icon display
    let iconDisplay;
    if (isWebsite && faviconUrl) {
      // For websites with favicons, use the favicon
      iconDisplay = `<img src="${faviconUrl}" class="pw-icon-img" onerror="this.onerror=null; this.src=''; this.classList.add('bi', 'bi-globe');" style="width: 48px; height: 48px; object-fit: contain;">`;
    } else {
      // For non-website passwords, use a colored icon box with first letter
      const firstLetter = displayTitle.charAt(0).toUpperCase();
      const colorIndex = displayTitle.length % 10; // Get a consistent color based on title length
      const colors = [
        '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c' // More vibrant colors
      ];
      const bgColor = colors[colorIndex];
      
      iconDisplay = `
        <div class="pw-icon-box" style="
          width: 60px;
          height: 60px;
          background-color: ${bgColor};
          border-radius: 12px;
          color: white;
          font-size: 28px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin: 0 auto;
        ">${firstLetter}</div>
      `;
    }
    
    pane.innerHTML = `
      <div class="mb-4 text-center">
        ${iconDisplay}
        <div class="fs-4 mt-2 fw-bold">${displayTitle}</div>
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
      
      <!-- Notes section conditionally rendered -->
      ${notesSection}
      
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
// Add this helper function for rendering card brand logos properly
// Replace the renderCardBrandLogo function with this improved version
// Update the renderCardBrandLogo function with the HTML/CSS approach
function renderCardBrandLogo(cardBrand, isDark) {
  switch(cardBrand) {
    case 'visa':
      // VISA logo using HTML/CSS
      return `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
          <div style="
            font-family: Arial, sans-serif;
            font-size: 18px;
            font-style: italic;
            font-weight: 800;
            color: ${isDark ? 'white' : '#1434CB'};
            letter-spacing: -1px;
            transform: skew(-15deg);
            position: relative;
          ">VISA</div>
        </div>`;
        
    case 'amex':
      // American Express logo using HTML/CSS
      return `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          background: ${isDark ? 'white' : '#1F72CD'}; 
          border-radius: 4px; 
          padding: 1px 8px; 
          height: 26px;
        ">
          <div style="
            color: ${isDark ? '#1F72CD' : 'white'};
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: -0.5px;
          ">AMEX</div>
        </div>`;
        
    case 'mastercard':
      // Mastercard logo using overlapping circles
      return `
        <div style="display: flex; align-items: center; height: 100%;">
          <div style="width: 30px; height: 30px; border-radius: 50%; background-color: #EB001B; opacity: 0.9;"></div>
          <div style="width: 30px; height: 30px; border-radius: 50%; background-color: #F79E1B; opacity: 0.9; margin-left: -15px;"></div>
        </div>`;
        
    case 'other':
    default:
      // Generic card network logo
      return `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid ${isDark ? 'white' : 'black'};
          border-radius: 4px; 
          padding: 1px 8px; 
          height: 24px;
        ">
          <div style="
            color: ${isDark ? 'white' : 'black'};
            font-family: Arial, sans-serif;
            font-size: 12px;
            font-weight: bold;
          ">NEP</div>
        </div>`;
  }
}

// Replace the renderCardDetails function with this improved version
// Updated renderCardDetails function to hide website URL except in edit mode
// Updated renderCardDetails function to completely hide the website URL in detail view
// Updated renderCardDetails function to completely hide the website URL in detail view
function renderCardDetails(card) {
  const pane = document.getElementById('detailPane');
  const cardholderName = decrypt(card.cardholderName);
  const cardNumber = decrypt(card.cardNumber);
  const expiryDate = decrypt(card.expiryDate);
  const cvv = decrypt(card.cvv || "");
  const cardType = card.cardType || "credit";
  const cardBrand = card.cardBrand || "mastercard";
  const cardColor = card.cardColor || "#000000";
  
  // Check if there are any notes and only include the notes section if there are
  const notesContent = decrypt(card.notes || "");
  const notesSection = notesContent ? `
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea class="form-control" rows="2" readonly>${notesContent}</textarea>
    </div>
  ` : '';
  
  // Calculate appropriate text color based on background
  const isDarkColor = isColorDark(cardColor);
  const textColor = isDarkColor ? '#ffffff' : '#000000';
  
  // Note: We don't show the website URL at all in the details view
  
  pane.innerHTML = `
    <div class="mb-4">
      <div class="card-preview-container">
        <div class="credit-card" style="
          background: ${cardColor}; 
          width: 100%; 
          max-width: 420px; 
          height: 240px; 
          margin: 0 auto 2rem auto;
          border-radius: 16px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.15);
          position: relative; 
          overflow: hidden;
          padding: 0;">
          
          <!-- Card content container -->
          <div style="position: relative; padding: 24px; height: 100%; width: 100%;
                      display: flex; flex-direction: column; justify-content: space-between;
                      color: ${textColor}; z-index: 2;">
            <!-- Top section -->
            <div class="d-flex justify-content-between align-items-start">
              <div style="font-size: 1.3rem; font-weight: 600; letter-spacing: 0.5px;">
                ${cardType === 'debit' ? 'Debit Card' : 'Credit Card'}
              </div>
              
              <!-- Card network logo in top right -->
              <div style="height: 32px;">
                ${renderCardBrandLogo(cardBrand, isDarkColor)}
              </div>
            </div>
            
            <!-- Chip section -->
            <div class="d-flex align-items-center mt-1 mb-1">
              <!-- EMV Chip -->
              <div style="
                width: 45px;
                height: 35px; 
                background: linear-gradient(135deg, #D4AF37 0%, #F4E5A7 50%, #D4AF37 100%); 
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                <div style="
                  width: 80%; 
                  height: 80%; 
                  background: linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%);
                  border-radius: 2px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  padding: 2px 0;">
                  <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                  <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                  <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                </div>
              </div>
              
              <!-- NFC icon -->
              <div style="margin-left: 15px; opacity: 0.8;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 16C6.6 13 6.6 9 9 6" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6 18.5C2.5 14.5 2.5 8.5 6 4.5" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 13.5C10.8 12 10.8 10 12 8.5" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
              </div>
            </div>
            
            <!-- Card number - with extra width and font adjustments for single line -->
            <div style="position: relative; margin: 15px 0;">
              <div id="cardNumberDisplay" style="
                font-family: 'Courier New', monospace; 
                font-size: 1.7rem;
                letter-spacing: 1px;
                font-weight: 500;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                white-space: nowrap;
                overflow: hidden;">
                ${formatCardNumberForDisplay(cardNumber)}
              </div>
              <button id="toggleCardNumber" class="btn btn-sm position-absolute" 
                     style="top: -10px; right: -10px; padding: 0.15rem 0.4rem; 
                     background: rgba(255,255,255,0.2); border: none; z-index: 10;">
                <i class="bi bi-eye" style="color: ${textColor}; opacity: 0.8;"></i>
              </button>
            </div>
            
            <!-- Bottom section -->
            <div class="d-flex justify-content-between align-items-end">
              <!-- Cardholder info -->
              <div>
                <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                  CARD HOLDER
                </div>
                <div style="font-size: 1.1rem; font-weight: 500; letter-spacing: 0.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                  ${cardholderName || 'CARD HOLDER'}
                </div>
              </div>
              
              <!-- Expiry date -->
              <div>
                <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                  EXPIRES
                </div>
                <div style="font-size: 1.1rem; font-weight: 500;">
                  ${expiryDate || 'MM/YY'}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Card background graphics -->
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none;">
            <!-- Gradient overlay -->
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                       background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%);"></div>
            
            <!-- Subtle pattern -->
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                       opacity: 0.03; 
                       background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+');"></div>
            
            <!-- Shine effect -->
            <div style="position: absolute; top: -50%; left: -50%; right: -50%; bottom: -50%; 
                       background: radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); 
                       transform: rotate(-45deg);"></div>
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
      
      <!-- Notes section - conditionally included -->
      ${notesSection}
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
    renderAll(); // Use renderAll instead of renderDetails to trigger full-width layout for cards
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
// Updated findPasswordById function to properly handle favorites
function findPasswordById(id) {
  // Check current folder first
  if (selectedFolder !== "all" && selectedFolder !== "favorites" && selectedFolder !== "watchtower") {
    const folderItems = getPasswords(selectedFolder);
    const found = folderItems.find(p => p.id === id);
    if (found) {
      return { ...found, folderId: selectedFolder };
    }
  }
  
  // Special handling for favorites
  if (selectedFolder === "favorites") {
    // Get all favorites from all folders including cards
    const favoritesItems = getPasswords("favorites");
    const found = favoritesItems.find(p => p.id === id);
    if (found) {
      // Keep the original folder ID in the returned item
      return found;
    }
  }
  
  // Check the cards folder explicitly
  const cardItems = getPasswords("cards");
  const foundCard = cardItems.find(p => p.id === id);
  if (foundCard) {
    return { ...foundCard, folderId: "cards" };
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

// Update the restoreDeletedPassword function to handle cards properly
function restoreDeletedPassword(id) {
  const deletedItems = getDeletedPasswords();
  const itemIndex = deletedItems.findIndex(p => p.id === id);
  
  if (itemIndex >= 0) {
    const item = deletedItems[itemIndex];
    
    // Determine target folder for restoration
    let targetFolderId;
    let restorationMessage;
    
    // If it's a card, always restore to the cards folder
    if (item.isCard) {
      targetFolderId = "cards"; // Always restore cards to the cards folder
      restorationMessage = 'Payment Cards';
    } else {
      // For regular passwords, try to restore to original folder if it exists
      const folders = getFolders().filter(f => !f.system);
      targetFolderId = item.originalFolderId;
      restorationMessage = 'original folder';
      
      // Check if the original folder still exists (and wasn't "unassigned")
      if (targetFolderId === "unassigned") {
        // Item was in "All Items" view, keep it in "unassigned"
        restorationMessage = 'All Items';
      } else {
        // For regular folders, check if they still exist
        const folderExists = folders.some(f => f.id === targetFolderId);
        if (!folderExists) {
          // Original folder doesn't exist anymore, put in "unassigned" instead
          targetFolderId = "unassigned";
          restorationMessage = 'All Items (original folder no longer exists)';
        }
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

// Update the renderAll function to handle the card form layout
function renderAll() {
  cleanupOldDeletedItems();
  renderFolders();
  renderPasswordsList();
  
  // Full-width logic for special views (Watchtower, Recently Deleted, and Card Form)
  const appList = document.querySelector('.app-list');
  const appDetail = document.querySelector('.app-detail');
  const listTopBar = document.getElementById('listTopBar');
  const detailTopBar = document.getElementById('detailTopBar');
  const detailPane = document.getElementById('detailPane');
  
  // Apply full-width layout for Watchtower, Recently Deleted, and adding cards
  const isFullWidth = selectedFolder === "watchtower" || 
                     selectedFolder === "deleted" || 
                     (addEditMode === "addCard" || (addEditMode === "edit" && findPasswordById(selectedPasswordId)?.isCard));
  
  if (isFullWidth) {
    // Hide list and show detail pane in full width
    appList.style.display = "none";
    appDetail.classList.add('watchtower-full');
    
    // Hide top bars
    if (listTopBar) listTopBar.style.display = "none";
    if (detailTopBar) detailTopBar.style.display = "none";
    
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
    
    // CSS to fix layout issues
    style.innerHTML = `
      .app-main-row { margin-top: 0 !important; }
      .container-fluid { padding-top: 0 !important; }
      #mainLayout { padding: 0 !important; }
      .app-detail { margin-top: 0 !important; }
      #detailTopBar { height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important; }
    `;
    
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
// Update the addPasswordBtn event handler
document.getElementById('addPasswordBtn').onclick = () => {
  if (selectedFolder === "cards") {
    // Use watchtower-like layout for cards
    addEditMode = "addCard";
    
    // Apply full-width layout like Watchtower
    const appList = document.querySelector('.app-list');
    const appDetail = document.querySelector('.app-detail');
    const listTopBar = document.getElementById('listTopBar');
    const detailTopBar = document.getElementById('detailTopBar');
    
    // Hide list and show detail pane in full width
    appList.style.display = "none";
    appDetail.classList.add('watchtower-full');
    
    // Hide top bars
    if (listTopBar) listTopBar.style.display = "none";
    if (detailTopBar) detailTopBar.style.display = "none";
    
    // Remove top padding from detail pane
    const detailPane = document.getElementById('detailPane');
    if (detailPane) {
      detailPane.classList.add('no-top-padding');
      detailPane.style.marginTop = "0";
      detailPane.style.paddingTop = "0";
    }
  } else {
    // Regular password form for other folders
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

// Password visibility toggle functionality
function setupPasswordToggle() {
  // Toggle for login/register password
  const toggleAuthPassword = document.getElementById('toggleAuthPassword');
  const authPasswordInput = document.getElementById('authPassword');
  const authPasswordIcon = document.getElementById('authPasswordIcon');

  if (toggleAuthPassword && authPasswordInput && authPasswordIcon) {
    toggleAuthPassword.addEventListener('click', function() {
      if (authPasswordInput.type === 'password') {
        authPasswordInput.type = 'text';
        authPasswordIcon.className = 'bi bi-eye-slash';
      } else {
        authPasswordInput.type = 'password';
        authPasswordIcon.className = 'bi bi-eye';
      }
    });
  }

  // Toggle for recovery new password
  const toggleNewPassword = document.getElementById('toggleNewPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const newPasswordIcon = document.getElementById('newPasswordIcon');

  if (toggleNewPassword && newPasswordInput && newPasswordIcon) {
    toggleNewPassword.addEventListener('click', function() {
      if (newPasswordInput.type === 'password') {
        newPasswordInput.type = 'text';
        newPasswordIcon.className = 'bi bi-eye-slash';
      } else {
        newPasswordInput.type = 'password';
        newPasswordIcon.className = 'bi bi-eye';
      }
    });
  }
}

// Settings modal logic
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();

  // Password visibility toggle functionality
  setupPasswordToggle();

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
    passwords: {},
    cards: [] // New array to store payment cards
  };
  
  // Export passwords from all real folders
  folders.filter(f => !f.system).forEach(f => {
    exportData.passwords[f.id] = getPasswords(f.id);
  });
  
  // Export unassigned passwords as well
  exportData.passwords["unassigned"] = getPasswords("unassigned");
  
  // Export cards from the cards system folder
  const cardItems = getPasswords("cards");
  exportData.cards = cardItems; // Add cards to export data
  
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
    
    // Import cards if present in the export data
    if (data.cards && Array.isArray(data.cards)) {
      // Get existing cards
      const existingCards = getPasswords("cards");
      
      // Add the imported cards, ensuring they have the isCard flag
      const importedCards = data.cards.map(card => ({...card, isCard: true, folderId: "cards"}));
      
      // Merge with existing cards
      const mergedCards = [...existingCards, ...importedCards];
      
      // Save to cards folder
      savePasswords("cards", mergedCards);
    }
    
    renderAll();
    showInfoModal("Passwords and cards imported successfully!");
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

// Fix for rendering deleted cards in the Recently Deleted view

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
    
    // Check if it's a payment card or a regular password
    const isCard = item.isCard;
    
    // Extract title and determine if it's a URL
    let fullTitle = isCard ? decrypt(item.cardholderName || "") : decrypt(item.title || "");
    let displayTitle = fullTitle;
    let faviconUrl = null;
    
    // Check if title is a URL and get clean display name and favicon
    if (!isCard && (fullTitle.includes('http') || 
        fullTitle.includes('.com') || 
        fullTitle.includes('.org') || 
        fullTitle.includes('.net') || 
        fullTitle.includes('.io'))) {
      
      // For display, show just the domain name
      displayTitle = extractWebsiteNameFromURL(fullTitle);
      
      // Get favicon URL
      faviconUrl = getFaviconUrl(fullTitle);
    }
    
    const subtitle = isCard ? 
      (decrypt(item.cardNumber || "").slice(-4) ? `•••• ${decrypt(item.cardNumber || "").slice(-4)}` : "Card") : 
      decrypt(item.username || "");
    
    // Prepare icon HTML
    let iconHTML;
    
    if (isCard) {
      // Use card type icon
      const iconClass = item.cardBrand === 'visa' ? 'bi-credit-card-fill' : 
                        item.cardBrand === 'amex' ? 'bi-credit-card' : 
                        'bi-credit-card-2-front-fill';
      iconHTML = `<i class="pw-icon ${iconClass}" style="font-size: 2.5rem;"></i>`;
    } else if (faviconUrl) {
      // Use website favicon
      iconHTML = `<img src="${faviconUrl}" class="pw-icon-img" onerror="this.onerror=null; this.src=''; this.classList.add('bi', 'bi-globe');" style="width: 40px; height: 40px; object-fit: contain;">`;
    } else {
      // Use colored letter icon for non-websites
      const firstLetter = displayTitle.charAt(0).toUpperCase();
      const colorIndex = displayTitle.length % 10; // Get a consistent color based on title length
      const colors = [
        '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c' // More vibrant colors
      ];
      const bgColor = colors[colorIndex];
      
      iconHTML = `
        <div class="pw-icon-box" style="
          width: 40px;
          height: 40px;
          background-color: ${bgColor};
          border-radius: 8px;
          color: white;
          font-size: 20px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 5px rgba(0,0,0,0.1);
        ">${firstLetter}</div>`;
    }
    
    card.innerHTML = `
      <div class="card-body">
        <div class="d-flex align-items-center">
          <div class="me-4">
            ${iconHTML}
          </div>
          <div class="flex-grow-1">
            <h5 class="mb-0">${displayTitle}</h5>
            <p class="text-secondary small mb-1">${subtitle}</p>
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
      restoreDeletedPassword(btn.getAttribute('data-id'));
    };
  });
  
  document.querySelectorAll('.delete-permanently-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      permanentlyDeletePassword(btn.getAttribute('data-id'));
    };
  });
  
  document.getElementById('emptyTrashBtn').onclick = (e) => {
    e.preventDefault();
    showConfirmModal("Permanently delete all items in trash?", () => {
      saveDeletedPasswords([]);
      renderDeletedItems(pane);
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

// Also update the renderCardForm function with the improved card design
// Update the renderCardForm function to fix cardholder name and expiry date display
// Update the renderCardForm function to use a Watchtower-like layout
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
  
  // Calculate appropriate text color based on background
  const isDarkColor = isColorDark(cardColor);
  const textColor = isDarkColor ? '#ffffff' : '#000000';
  
  // Create a Watchtower-like layout
  pane.innerHTML = `
    <div class="watchtower-container mx-auto" style="max-width:900px;">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1"><i class="bi bi-credit-card-fill me-2"></i> ${editing ? 'Edit' : 'New'} Payment Card</h4>
          <p class="text-secondary mb-0">Create a secure payment card record</p>
        </div>
      </div>
      
      <form id="cardForm" autocomplete="off">
        <div class="row g-4">
          <!-- Card preview column -->
          <div class="col-12 col-lg-6 mb-4">
            <div class="card shadow-sm p-3">
              <h5 class="mb-3">Card Preview</h5>
              <!-- Improved card preview -->
              <div class="card-preview-container">
                <div class="credit-card" id="cardPreview" style="
                  background: ${cardColor}; 
                  width: 100%; 
                  max-width: 380px; 
                  height: 220px; 
                  margin: 0 auto;
                  border-radius: 16px;
                  box-shadow: 0 12px 24px rgba(0,0,0,0.15);
                  position: relative; 
                  overflow: hidden;
                  padding: 0;">
                  
                  <!-- Card content container -->
                  <div style="position: relative; padding: 20px; height: 100%; width: 100%;
                            display: flex; flex-direction: column; justify-content: space-between;
                            color: ${textColor}; z-index: 2;">
                    <!-- Top section -->
                    <div class="d-flex justify-content-between align-items-start">
                      <div id="previewCardType" style="font-size: 1.2rem; font-weight: 600; letter-spacing: 0.5px;">
                        ${cardType === 'debit' ? 'Debit Card' : 'Credit Card'}
                      </div>
                      
                      <!-- Card network logo in top right -->
                      <div id="previewCardNetworkLogo" style="height: 32px;">
                        ${renderCardBrandLogo(cardBrand, isDarkColor)}
                      </div>
                    </div>
                    
                    <!-- Chip section -->
                    <div class="d-flex align-items-center mt-1 mb-1">
                      <!-- EMV Chip -->
                      <div style="
                        width: 45px;
                        height: 35px; 
                        background: linear-gradient(135deg, #D4AF37 0%, #F4E5A7 50%, #D4AF37 100%); 
                        border-radius: 5px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        <div style="
                          width: 80%; 
                          height: 80%; 
                          background: linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%);
                          border-radius: 2px;
                          display: flex;
                          flex-direction: column;
                          justify-content: space-between;
                          padding: 2px 0;">
                          <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                          <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                          <div style="height: 2px; background: rgba(0,0,0,0.3);"></div>
                        </div>
                      </div>
                      
                      <!-- NFC icon -->
                      <div style="display: flex; align-items: center; justify-content: center; margin-left: 15px; opacity: 0.8; height: 24px; width: 30px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 16C6.6 13 6.6 9 9 6" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M6 18.5C2.5 14.5 2.5 8.5 6 4.5" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M12 13.5C10.8 12 10.8 10 12 8.5" stroke="${textColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    
                    <!-- Card number -->
                    <div style="position: relative; margin: 15px 0;">
                      <div id="previewCardNumber" style="
                        font-family: 'Courier New', monospace; 
                        font-size: 1.5rem;
                        letter-spacing: 1px;
                        font-weight: 500;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                        white-space: nowrap;
                        overflow: hidden;">
                        ${formatCardNumberForDisplay(cardNumber || '0000 0000 0000 0000')}
                      </div>
                    </div>
                    
                    <!-- Bottom section -->
                    <div class="d-flex justify-content-between align-items-end">
                      <!-- Cardholder info -->
                      <div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                          CARD HOLDER
                        </div>
                        <div id="previewCardholderName" style="font-size: 1.1rem; font-weight: 500; letter-spacing: 0.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                          ${cardholderName || 'CARD HOLDER'}
                        </div>
                      </div>
                      
                      <!-- Expiry date -->
                      <div>
                        <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.7; margin-bottom: 5px; letter-spacing: 0.05rem;">
                          EXPIRES
                        </div>
                        <div id="previewExpiryDate" style="font-size: 1.1rem; font-weight: 500;">
                          ${expiryDate || 'MM/YY'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Card background graphics -->
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none;">
                    <!-- Gradient overlay -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                               background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%);"></div>
                    
                    <!-- Subtle pattern -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                               opacity: 0.03; 
                               background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPC9zdmc+');"></div>
                    
                    <!-- Shine effect -->
                    <div style="position: absolute; top: -50%; left: -50%; right: -50%; bottom: -50%; 
                               background: radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); 
                               transform: rotate(-45deg);"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Card form column -->
          <div class="col-12 col-lg-6">
            <div class="card shadow-sm p-3">
              <h5 class="mb-3">Card Details</h5>
              
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
                  <input type="password" class="form-control" name="cvv" id="cvvInput"
                        value="${cvv}" required placeholder="123" maxlength="4">
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Website URL (optional)</label>
                <input type="text" class="form-control" name="website" id="websiteInput" 
                       value="${editing ? decrypt(card.website || '') : ''}" placeholder="https://example.com">
                <div class="form-text">Link to the card issuer's website</div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Notes</label>
                <textarea class="form-control" name="notes" rows="2">${editing ? decrypt(card.notes || '') : ''}</textarea>
              </div>
            </div>
          </div>
        </div>
        
        <div class="mt-4 text-center">
          <button class="btn btn-success me-2" type="submit">${editing ? "Save Changes" : "Add Card"}</button>
          <button class="btn btn-outline-secondary" type="button" id="cancelCardBtn">Cancel</button>
        </div>
        
        <div class="mt-4 text-secondary small">
          <i class="bi bi-info-circle"></i> Card information is securely encrypted and stored only on your device.
        </div>
      </form>
    </div>
  `;
  
  // Add event listeners for live preview
  document.getElementById('cardholderNameInput').addEventListener('input', function() {
    document.getElementById('previewCardholderName').innerText = this.value || 'CARD HOLDER';
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
    
    // Update card background
    document.getElementById('cardPreview').style.background = cardColor;
    
    // Update text color for all text elements
    const textColor = isDarkColor ? '#ffffff' : '#000000';
    const textElements = document.querySelectorAll('#cardPreview [style*="color:"]');
    textElements.forEach(el => {
      el.style.color = textColor;
    });
    
    // Update SVG elements
    document.getElementById('previewCardNetworkLogo').innerHTML = renderCardBrandLogo(cardBrand, isDarkColor);
    
    // Update NFC icon
    const nfcPaths = document.querySelectorAll('#cardPreview svg path');
    nfcPaths.forEach(path => {
      if (path.getAttribute('stroke')) {
        path.setAttribute('stroke', textColor);
      }
    });
  }
  
  document.getElementById('cancelCardBtn').onclick = () => {
  // Reset the form state
  addEditMode = null;
  
  // Return to Payment Cards section if not already there
  if (selectedFolder !== "cards") {
    selectedFolder = "cards";
  }
  
  // Reset any selected card
  selectedPasswordId = null;
  
  // Restore normal layout and render all components
  renderAll();
};
  
  // Form submission handler with fixes for proper card data saving
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
      website: encrypt(data.website || ""), // Make sure this line is included
      notes: encrypt(data.notes || ""),
      cardType: data.cardType,
      cardBrand: data.cardBrand,
      cardColor: data.cardColor,
      created: editing ? card.created : now,
      updated: now,
      favorite: editing ? card.favorite || false : false,
      isCard: true, 
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
// Update the formatCardNumberForDisplay function to better match the screenshot
function formatCardNumberForDisplay(number) {
  if (typeof number !== 'string') return '• • • •   • • • •   • • • •   • • • •';
  
  // Clean the number first
  const cleaned = number.replace(/\D/g, '');
  
  // For display, mask all but last 4 digits
  if (cleaned.length > 4) {
    const lastFour = cleaned.slice(-4);
    return `• • • •   • • • •   • • • •   ${lastFour}`;
  } else if (cleaned.length > 0) {
    return '• • • •   • • • •   • • • •   ' + cleaned.padStart(4, '•');
  } else {
    return '• • • •   • • • •   • • • •   • • • •';
  }
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
// Update the renderCardLogo function to use the same HTML/CSS approach
function renderCardLogo(cardBrand, textColor, size) {
  // Define sizes based on small or large
  const scale = size === 'small' ? 0.7 : 1;
  const isDark = textColor === '#ffffff' || textColor === 'white';
  
  switch(cardBrand) {
    case 'visa':
      return `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
          <div style="
            font-family: Arial, sans-serif;
            font-size: ${18 * scale}px;
            font-style: italic;
            font-weight: 800;
            color: ${isDark ? 'white' : '#1434CB'};
            letter-spacing: -1px;
            transform: skew(-15deg);
            position: relative;
          ">VISA</div>
        </div>`;
      
    case 'amex':
      return `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          background: ${isDark ? 'white' : '#1F72CD'}; 
          border-radius: ${4 * scale}px; 
          padding: ${1 * scale}px ${8 * scale}px; 
          height: ${26 * scale}px;
        ">
          <div style="
            color: ${isDark ? '#1F72CD' : 'white'};
            font-family: Arial, sans-serif;
            font-size: ${14 * scale}px;
            font-weight: bold;
            letter-spacing: -0.5px;
          ">AMEX</div>
        </div>`;
        
    case 'mastercard':
      return `
        <div style="display: flex; align-items: center; height: 100%;">
          <div style="width: ${30 * scale}px; height: ${30 * scale}px; border-radius: 50%; background-color: #EB001B; opacity: 0.9;"></div>
          <div style="width: ${30 * scale}px; height: ${30 * scale}px; border-radius: 50%; background-color: #F79E1B; opacity: 0.9; margin-left: ${-15 * scale}px;"></div>
        </div>`;
      
    default: // Generic card
      return `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: ${2 * scale}px solid ${textColor};
          border-radius: ${4 * scale}px; 
          padding: ${1 * scale}px ${8 * scale}px; 
          height: ${24 * scale}px;
        ">
          <div style="
            color: ${textColor};
            font-family: Arial, sans-serif;
            font-size: ${12 * scale}px;
            font-weight: bold;
          ">NEP</div>
        </div>`;
  }
}