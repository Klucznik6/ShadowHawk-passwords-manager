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
    { id: "infocenter", name: "Info Center", icon: "bi-graph-up-arrow", system: true },
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
  if (!CURRENT_USER) {
    console.log("getPasswords: No current user");
    return [];
  }
  
  console.log(`getPasswords: user=${CURRENT_USER}, folder=${folderId}, search="${searchTerm}"`);
  
  let folders = getFolders();
  let allFolders = folders.filter(f => !f.system || f.id === "favorites" || f.id === "all").map(f => f.id);
  let out = [];
  
  if (folderId === "all") {
    // Include all regular folders
    for (const f of folders.filter(f=>!f.system)) {
      let items = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, f.id)) || "[]");
      console.log(`getPasswords: folder ${f.id} has ${items.length} items`);
      out.push(...items.map(it => ({...it, folderId: f.id})));
    }
    
    // Also include unassigned items
    let unassignedItems = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, "unassigned")) || "[]");
    console.log(`getPasswords: unassigned has ${unassignedItems.length} items`);
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
    
    // Create icon with custom color if available
    const iconColor = f.color ? `style="color: ${f.color};"` : '';
    li.innerHTML = `<i class="bi ${f.icon}" ${iconColor}></i> <span>${f.name}</span>`;
    
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
      
      // Check if card is expiring soon
      const isExpiring = isCardExpiringSoon(pw);
      const expiringClass = isExpiring ? 'card-expiring-soon' : '';
      const expiringIcon = isExpiring ? '<i class="bi bi-exclamation-triangle-fill text-danger ms-2" title="Expires within 1 month"></i>' : '';
      
      // For cards, use regular icon rendering
      let fav = pw.favorite ? "" : "inactive";
      iconElement = `<i class="pw-icon bi ${iconClass}"></i>`;
      
      li.className += ` ${expiringClass}`;
      li.innerHTML = `${iconElement}
        <div class="flex-grow-1">
          <div class="item-title">${title}${expiringIcon}</div>
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
      if (pw.customIconUrl) {
        // Use custom icon URL with transparent background
        iconElement = `<div class="pw-favicon me-2">
          <div class="pw-icon-box" style="
            width: 22px;
            height: 22px;
            background-color: transparent;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          ">
            <img src="${pw.customIconUrl}" style="width: 18px; height: 18px; object-fit: contain;" 
                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <i class="bi bi-image" style="color: #6c757d; font-size: 12px; display: none;"></i>
          </div>
        </div>`;
      } else if (pw.icon && pw.color) {
        // Use custom icon and color
        iconElement = `<div class="pw-favicon me-2">
          <div class="pw-icon-box" style="
            width: 22px;
            height: 22px;
            background-color: ${pw.color};
            border-radius: 6px;
            color: white;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
          "><i class="bi ${pw.icon}"></i></div>
        </div>`;
      } else if (isWebsite && websiteUrl) {
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
  
  if (selectedFolder === "infocenter") {
    renderInfoCenter(pane);
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
    if (item.customIconUrl) {
      // Use custom icon URL with transparent background
      iconDisplay = `
        <div class="pw-icon-box" style="
          width: 60px;
          height: 60px;
          background-color: transparent;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        ">
          <img src="${item.customIconUrl}" style="width: 48px; height: 48px; object-fit: contain;" 
               onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <i class="bi bi-image" style="color: #6c757d; font-size: 24px; display: none;"></i>
        </div>
      `;
    } else if (item.icon && item.color) {
      // Use custom built-in icon with chosen color
      iconDisplay = `
        <div class="pw-icon-box" style="
          width: 60px;
          height: 60px;
          background-color: ${item.color};
          border-radius: 12px;
          color: white;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin: 0 auto;
        "><i class="bi ${item.icon}"></i></div>
      `;
    } else if (isWebsite && faviconUrl) {
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
  if (selectedFolder !== "all" && selectedFolder !== "favorites" && selectedFolder !== "infocenter") {
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
  console.log("renderAll() called for user:", CURRENT_USER);
  document.getElementById('currentUser').textContent = CURRENT_USER ? `@${CURRENT_USER}` : "";
  document.getElementById('searchInput').value = "";
  
  cleanupOldDeletedItems();
  renderFolders();
  renderPasswordsList();
  
  // Full-width logic for special views (Info Center, Recently Deleted, and Card Form)
  const appList = document.querySelector('.app-list');
  const appDetail = document.querySelector('.app-detail');
  const listTopBar = document.getElementById('listTopBar');
  const detailTopBar = document.getElementById('detailTopBar');
  const detailPane = document.getElementById('detailPane');
  
  // Apply full-width layout for Info Center, Recently Deleted, and adding cards
  const isFullWidth = selectedFolder === "infocenter" || 
                     selectedFolder === "deleted" || 
                     (addEditMode === "addCard" || (addEditMode === "edit" && findPasswordById(selectedPasswordId)?.isCard));
  
  if (isFullWidth) {
    // Hide list and show detail pane in full width
    appList.style.display = "none";
    appDetail.classList.add('infocenter-full');
    
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
    appDetail.classList.remove('infocenter-full');
    
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
}

// --- Event handlers ---
document.getElementById('addFolderBtn').onclick = () => {
  document.getElementById('folderModal').classList.remove('d-none');
  document.getElementById('folderName').focus();
};

// Update the addPasswordBtn event handler to fix any issues
// Update the addPasswordBtn event handler
document.getElementById('addPasswordBtn').onclick = () => {
  if (selectedFolder === "cards") {
    // Use infocenter-like layout for cards
    addEditMode = "addCard";
    
    // Apply full-width layout like Info Center
    const appList = document.querySelector('.app-list');
    const appDetail = document.querySelector('.app-detail');
    const listTopBar = document.getElementById('listTopBar');
    const detailTopBar = document.getElementById('detailTopBar');
    
    // Hide list and show detail pane in full width
    appList.style.display = "none";
    appDetail.classList.add('infocenter-full');
    
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

// Folder Modal Event Handlers
document.getElementById('folderCancelBtn').onclick = () => {
  document.getElementById('folderModal').classList.add('d-none');
  resetFolderForm();
};

document.getElementById('folderForm').onsubmit = (e) => {
  e.preventDefault();
  createFolderFromModal();
};

// Folder name input event
document.getElementById('folderName').oninput = (e) => {
  updateFolderPreview();
};

// Folder color selection
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('folder-color-option')) {
    // Remove selection from all options
    document.querySelectorAll('.folder-color-option').forEach(option => {
      option.classList.remove('selected');
      option.style.border = '2px solid transparent';
    });
    
    // Add selection to clicked option
    e.target.classList.add('selected');
    e.target.style.border = '2px solid #0066CC';
    
    // Update preview
    updateFolderPreview();
  }
});

function resetFolderForm() {
  document.getElementById('folderName').value = '';
  document.querySelectorAll('.folder-color-option').forEach(option => {
    option.classList.remove('selected');
    option.style.border = '2px solid transparent';
  });
  // Select default green color
  const defaultColor = document.querySelector('[data-color="#38A169"]');
  if (defaultColor) {
    defaultColor.classList.add('selected');
    defaultColor.style.border = '2px solid #0066CC';
  }
  updateFolderPreview();
}

function updateFolderPreview() {
  const name = document.getElementById('folderName').value.trim() || 'My New Folder';
  const selectedColor = document.querySelector('.folder-color-option.selected');
  const color = selectedColor ? selectedColor.dataset.color : '#38A169';
  
  document.getElementById('folderPreviewName').textContent = name;
  document.getElementById('folderPreview').style.color = color;
}

function createFolderFromModal() {
  const name = document.getElementById('folderName').value.trim();
  if (!name) {
    alert('Please enter a folder name.');
    return;
  }
  
  const selectedColor = document.querySelector('.folder-color-option.selected');
  const color = selectedColor ? selectedColor.dataset.color : '#38A169';
  
  let folders = getFolders();
  let id = Math.random().toString(36).slice(2);
  
  folders.push({ 
    id, 
    name, 
    icon: "bi-folder-fill", 
    system: false,
    color: color
  });
  
  saveFolders(folders);
  selectedFolder = id;
  renderAll();
  
  // Close modal and reset form
  document.getElementById('folderModal').classList.add('d-none');
  resetFolderForm();
}

document.getElementById('exportPwdsBtn').onclick = () => {
  exportPasswordsWithCode();
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

// Export/Import code functionality
let pendingImportData = null;
let pendingExportData = null;

function showExportCodeModal(exportCode, encryptedData) {
  pendingExportData = encryptedData;
  const modal = document.getElementById('exportCodeModal');
  const codeDisplay = document.getElementById('exportCodeDisplay');
  
  codeDisplay.textContent = exportCode;
  modal.classList.remove('d-none');
}

function showImportCodePrompt() {
  const modal = document.getElementById('importCodeModal');
  const input = document.getElementById('importCodeInput');
  const error = document.getElementById('importCodeError');
  
  input.value = '';
  error.classList.add('d-none');
  modal.classList.remove('d-none');
  input.focus();
}

function hideExportCodeModal() {
  document.getElementById('exportCodeModal').classList.add('d-none');
  pendingExportData = null;
}

function hideImportCodeModal() {
  document.getElementById('importCodeModal').classList.add('d-none');
  document.getElementById('importCodeInput').value = '';
  document.getElementById('importCodeError').classList.add('d-none');
  pendingImportData = null;
}

// Export code modal handlers
document.getElementById('exportCodeCopy').onclick = () => {
  const codeText = document.getElementById('exportCodeDisplay').textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    showInfoModal('Export code copied to clipboard!');
  });
};

document.getElementById('exportCodeDownload').onclick = () => {
  if (pendingExportData) {
    downloadEncryptedFile(pendingExportData);
    hideExportCodeModal();
    showInfoModal('Passwords exported successfully with encryption!');
  }
};

document.getElementById('exportCodeCancel').onclick = () => {
  hideExportCodeModal();
};

// Import code modal handlers
document.getElementById('importCodeCancel').onclick = () => {
  hideImportCodeModal();
};

document.getElementById('importCodeConfirm').onclick = () => {
  const code = document.getElementById('importCodeInput').value.trim();
  const error = document.getElementById('importCodeError');
  
  if (!code) {
    error.textContent = 'Please enter the export code.';
    error.classList.remove('d-none');
    return;
  }
  
  // Try to import with the provided code
  importPasswordsWithCode(pendingImportData, code);
  hideImportCodeModal();
};

document.getElementById('importCodeInput').onkeypress = function(e) {
  if (e.key === 'Enter') {
    document.getElementById('importCodeConfirm').click();
  }
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

// Function to update the vaults shield icon based on theme
function updateVaultsShieldIcon(theme) {
  console.log('Updating vaults shield icon for theme:', theme);
  const vaultsShieldIcon = document.getElementById('vaultsShieldIcon');
  if (vaultsShieldIcon) {
    if (theme === 'dark') {
      vaultsShieldIcon.src = '../assets/darkIcon.png';
    } else {
      vaultsShieldIcon.src = '../assets/lightIcon.png';
    }
    console.log('Shield icon src updated to:', vaultsShieldIcon.src);
  } else {
    console.log('vaultsShieldIcon element not found');
  }
}

// --- Theme persistence
function setTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('pmx_theme', theme);
  
  // Update vaults shield icon based on theme
  updateVaultsShieldIcon(theme);
  
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

// Password generation settings
const PASSWORD_SETTINGS_KEY = 'shadowhawk_password_settings';

function getDefaultPasswordSettings() {
  return {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: false
  };
}

function loadPasswordSettings() {
  const saved = localStorage.getItem(PASSWORD_SETTINGS_KEY);
  const settings = saved ? JSON.parse(saved) : getDefaultPasswordSettings();
  
  // Apply settings to UI
  document.getElementById('passwordLength').value = settings.length;
  document.getElementById('passwordLengthValue').textContent = settings.length;
  document.getElementById('includeUppercase').checked = settings.includeUppercase;
  document.getElementById('includeLowercase').checked = settings.includeLowercase;
  document.getElementById('includeNumbers').checked = settings.includeNumbers;
  document.getElementById('includeSymbols').checked = settings.includeSymbols;
  document.getElementById('excludeAmbiguous').checked = settings.excludeAmbiguous;
}

function savePasswordSettings() {
  const settings = {
    length: parseInt(document.getElementById('passwordLength').value),
    includeUppercase: document.getElementById('includeUppercase').checked,
    includeLowercase: document.getElementById('includeLowercase').checked,
    includeNumbers: document.getElementById('includeNumbers').checked,
    includeSymbols: document.getElementById('includeSymbols').checked,
    excludeAmbiguous: document.getElementById('excludeAmbiguous').checked
  };
  
  localStorage.setItem(PASSWORD_SETTINGS_KEY, JSON.stringify(settings));
}

function getPasswordSettings() {
  const saved = localStorage.getItem(PASSWORD_SETTINGS_KEY);
  return saved ? JSON.parse(saved) : getDefaultPasswordSettings();
}

function generatePasswordWithSettings() {
  const settings = getPasswordSettings();
  
  // Ensure at least one character type is selected
  if (!settings.includeUppercase && !settings.includeLowercase && 
      !settings.includeNumbers && !settings.includeSymbols) {
    alert('At least one character type must be selected for password generation.');
    return '';
  }
  
  let chars = '';
  
  if (settings.includeUppercase) {
    chars += settings.excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (settings.includeLowercase) {
    chars += settings.excludeAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  if (settings.includeNumbers) {
    chars += settings.excludeAmbiguous ? '23456789' : '0123456789';
  }
  if (settings.includeSymbols) {
    chars += '!@#$%^&*()_+~`|}{[]\\:;?><,./-=';
  }
  
  let password = '';
  for (let i = 0; i < settings.length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

// Settings modal logic
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadPasswordSettings();

  // Password visibility toggle functionality
  setupPasswordToggle();

  // Initialize folder modal
  resetFolderForm();

  document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('settingsModal').classList.remove('d-none');
  };
  document.getElementById('settingsCloseBtn').onclick = () => {
    document.getElementById('settingsModal').classList.add('d-none');
    savePasswordSettings();
  };
  document.getElementById('themeLight').onclick = () => {
    setTheme('light');
  };
  document.getElementById('themeDark').onclick = () => {
    setTheme('dark');
  };
  
  // Password generation settings
  document.getElementById('passwordLength').oninput = (e) => {
    document.getElementById('passwordLengthValue').textContent = e.target.value;
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
function generateExportCode() {
  // Generate a random 6-segment code similar to recovery code but different format
  const segments = [];
  for (let i = 0; i < 6; i++) {
    segments.push(Math.random().toString(36).slice(2, 5).toUpperCase());
  }
  return segments.join('-');
}

function exportPasswordsWithCode() {
  if (!CURRENT_USER) return;
  
  // Generate random export code
  const exportCode = generateExportCode();
  
  const folders = getFolders();
  const exportData = {
    folders,
    passwords: {},
    cards: [],
    exportUser: CURRENT_USER, // Keep for reference but don't use in import
    exportTimestamp: new Date().toISOString()
  };
  
  // Export passwords from all real folders - get RAW data, not user-specific
  folders.filter(f => !f.system).forEach(f => {
    const rawPasswords = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, f.id)) || "[]");
    // Decrypt all data for export so it's user-independent
    const decryptedPasswords = rawPasswords.map(pw => ({
      ...pw,
      title: pw.title ? decrypt(pw.title) : "",
      username: pw.username ? decrypt(pw.username) : "",
      password: pw.password ? decrypt(pw.password) : "",
      site: pw.site ? decrypt(pw.site) : "",
      notes: pw.notes ? decrypt(pw.notes) : "",
      // For cards, also decrypt card data
      cardholderName: pw.cardholderName ? decrypt(pw.cardholderName) : "",
      cardNumber: pw.cardNumber ? decrypt(pw.cardNumber) : "",
      expiryDate: pw.expiryDate ? decrypt(pw.expiryDate) : "",
      cvv: pw.cvv ? decrypt(pw.cvv) : ""
    }));
    exportData.passwords[f.id] = decryptedPasswords;
  });
  
  // Export unassigned passwords as well - RAW data
  const rawUnassigned = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, "unassigned")) || "[]");
  const decryptedUnassigned = rawUnassigned.map(pw => ({
    ...pw,
    title: pw.title ? decrypt(pw.title) : "",
    username: pw.username ? decrypt(pw.username) : "",
    password: pw.password ? decrypt(pw.password) : "",
    site: pw.site ? decrypt(pw.site) : "",
    notes: pw.notes ? decrypt(pw.notes) : "",
    // For cards, also decrypt card data
    cardholderName: pw.cardholderName ? decrypt(pw.cardholderName) : "",
    cardNumber: pw.cardNumber ? decrypt(pw.cardNumber) : "",
    expiryDate: pw.expiryDate ? decrypt(pw.expiryDate) : "",
    cvv: pw.cvv ? decrypt(pw.cvv) : ""
  }));
  exportData.passwords["unassigned"] = decryptedUnassigned;
  
  // Export cards from the cards system folder - RAW data
  const rawCards = JSON.parse(localStorage.getItem(getPasswordsKey(CURRENT_USER, "cards")) || "[]");
  const decryptedCards = rawCards.map(card => ({
    ...card,
    cardholderName: card.cardholderName ? decrypt(card.cardholderName) : "",
    cardNumber: card.cardNumber ? decrypt(card.cardNumber) : "",
    expiryDate: card.expiryDate ? decrypt(card.expiryDate) : "",
    cvv: card.cvv ? decrypt(card.cvv) : "",
    notes: card.notes ? decrypt(card.notes) : ""
  }));
  exportData.cards = decryptedCards;
  
  // Encrypt the export data using the generated code
  const dataString = JSON.stringify(exportData);
  const encrypted = CryptoJS.AES.encrypt(dataString, exportCode).toString();
  
  // Create the final encrypted export
  const encryptedExport = {
    encrypted: true,
    data: encrypted,
    timestamp: new Date().toISOString(),
    user: CURRENT_USER
  };
  
  // Show the export code to user before downloading
  showExportCodeModal(exportCode, encryptedExport);
}

function downloadEncryptedFile(encryptedData) {
  const blob = new Blob([JSON.stringify(encryptedData, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `passwords-export-encrypted-${CURRENT_USER}.json`;
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
    const rawData = typeof json === "string" ? JSON.parse(json) : json;
    
    // Check if this is an encrypted export
    if (rawData.encrypted && rawData.data) {
      // This is an encrypted file, prompt for export code
      pendingImportData = json;
      showImportCodePrompt();
      return;
    }
    
    // Handle unencrypted import (legacy support)
    importPasswordsData(rawData);
  } catch (e) {
    showInfoModal("Import failed: " + (e.message || e));
  }
}

function importPasswordsWithCode(json, exportCode) {
  if (!CURRENT_USER) return;
  try {
    const rawData = typeof json === "string" ? JSON.parse(json) : json;
    
    if (!rawData.encrypted || !rawData.data) {
      // Not an encrypted file, try regular import
      importPasswordsData(rawData);
      return;
    }
    
    // Decrypt the data
    const decryptedBytes = CryptoJS.AES.decrypt(rawData.data, exportCode);
    const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error("Invalid export code or corrupted file");
    }
    
    const data = JSON.parse(decryptedString);
    importPasswordsData(data);
  } catch (e) {
    if (e.message.includes("Invalid export code")) {
      showInfoModal("Import failed: Invalid export code or corrupted file.");
    } else {
      showInfoModal("Import failed: " + (e.message || e));
    }
  }
}

function importPasswordsData(data) {
  if (!data.folders || !data.passwords) throw new Error("Invalid file format");
  
  // Get current user's existing folders
  let existingFolders = getFolders().filter(f => f.system);
  let customFolders = data.folders.filter(f => !f.system);
  
  // Create a mapping for folder ID changes (in case of conflicts)
  const folderIdMapping = {};
  
  // Add imported custom folders, handling potential ID conflicts
  customFolders.forEach(importedFolder => {
    const existingFolder = existingFolders.find(f => f.name === importedFolder.name && !f.system);
    if (existingFolder) {
      // Folder with same name exists, use existing ID
      folderIdMapping[importedFolder.id] = existingFolder.id;
    } else {
      // Create new folder, potentially with new ID if conflict exists
      let newId = importedFolder.id;
      while (existingFolders.some(f => f.id === newId)) {
        newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      }
      folderIdMapping[importedFolder.id] = newId;
      
      // Add folder with new ID
      existingFolders.push({
        ...importedFolder,
        id: newId
      });
    }
  });
  
  // Save updated folders
  saveFolders(existingFolders);
  
  // Import passwords for each folder with proper ID mapping
  let totalImportedPasswords = 0;
  for (const [originalFolderId, pwds] of Object.entries(data.passwords)) {
    let targetFolderId = originalFolderId;
    
    // Map folder ID if necessary
    if (folderIdMapping[originalFolderId]) {
      targetFolderId = folderIdMapping[originalFolderId];
    }
    
    // Skip system folders except "unassigned"
    if (originalFolderId !== "unassigned" && data.folders.some(f => f.id === originalFolderId && f.system)) {
      continue;
    }
    
    // Get existing passwords in target folder
    const existingPasswords = getPasswords(targetFolderId);
    
    // Add imported passwords with correct folder ID and RE-ENCRYPT for current user
    const importedPasswords = pwds.map(pw => ({
      ...pw,
      folderId: targetFolderId,
      id: pw.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
      // Re-encrypt all fields for the current user
      title: pw.title ? encrypt(pw.title) : "",
      username: pw.username ? encrypt(pw.username) : "",
      password: pw.password ? encrypt(pw.password) : "",
      site: pw.site ? encrypt(pw.site) : "",
      notes: pw.notes ? encrypt(pw.notes) : "",
      // For cards, also re-encrypt card data
      cardholderName: pw.cardholderName ? encrypt(pw.cardholderName) : "",
      cardNumber: pw.cardNumber ? encrypt(pw.cardNumber) : "",
      expiryDate: pw.expiryDate ? encrypt(pw.expiryDate) : "",
      cvv: pw.cvv ? encrypt(pw.cvv) : ""
    }));
    
    // Filter out duplicates based on site and username (compare decrypted values)
    const uniquePasswords = [];
    importedPasswords.forEach(importedPw => {
      const importedSite = importedPw.site ? decrypt(importedPw.site) : "";
      const importedUsername = importedPw.username ? decrypt(importedPw.username) : "";
      
      const isDuplicate = existingPasswords.some(existingPw => {
        const existingSite = existingPw.site ? decrypt(existingPw.site) : "";
        const existingUsername = existingPw.username ? decrypt(existingPw.username) : "";
        return existingSite === importedSite && existingUsername === importedUsername;
      });
      
      if (!isDuplicate) {
        uniquePasswords.push(importedPw);
        totalImportedPasswords++;
      }
    });
    
    // Merge and save
    const mergedPasswords = [...existingPasswords, ...uniquePasswords];
    savePasswords(targetFolderId, mergedPasswords);
  }
  
  // Import cards if present in the export data
  let totalImportedCards = 0;
  if (data.cards && Array.isArray(data.cards)) {
    // Get existing cards
    const existingCards = getPasswords("cards");
    
    // Add the imported cards, ensuring they have the isCard flag and RE-ENCRYPT for current user
    const importedCards = data.cards.map(card => ({
      ...card, 
      isCard: true, 
      folderId: "cards",
      id: card.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
      // Re-encrypt all card fields for the current user
      cardholderName: card.cardholderName ? encrypt(card.cardholderName) : "",
      cardNumber: card.cardNumber ? encrypt(card.cardNumber) : "",
      expiryDate: card.expiryDate ? encrypt(card.expiryDate) : "",
      cvv: card.cvv ? encrypt(card.cvv) : "",
      notes: card.notes ? encrypt(card.notes) : ""
    }));
    
    // Filter out duplicate cards based on cardNumber (last 4 digits) and cardholderName (compare decrypted values)
    const uniqueCards = [];
    importedCards.forEach(importedCard => {
      const importedCardNumber = importedCard.cardNumber ? decrypt(importedCard.cardNumber) : "";
      const importedCardholderName = importedCard.cardholderName ? decrypt(importedCard.cardholderName) : "";
      
      const isDuplicate = existingCards.some(existingCard => {
        const existingCardNumber = existingCard.cardNumber ? decrypt(existingCard.cardNumber) : "";
        const existingCardholderName = existingCard.cardholderName ? decrypt(existingCard.cardholderName) : "";
        
        return existingCardNumber && importedCardNumber &&
               existingCardNumber.slice(-4) === importedCardNumber.slice(-4) &&
               existingCardholderName === importedCardholderName;
      });
      
      if (!isDuplicate) {
        uniqueCards.push(importedCard);
        totalImportedCards++;
      }
    });
    
    // Merge with existing cards
    const mergedCards = [...existingCards, ...uniqueCards];
    
    // Save to cards folder
    savePasswords("cards", mergedCards);
  }
  
  console.log("Import completed successfully!");
  console.log(`Total imported: ${totalImportedPasswords} passwords, ${totalImportedCards} cards`);
  
  // Clear any current selection to ensure fresh state
  selectedPasswordId = null;
  addEditMode = null;
  
  // Set to "all" to show all imported items
  selectedFolder = "all";
  
  // Full UI refresh
  renderAll();
  
  // Show success message
  const totalItems = totalImportedPasswords + totalImportedCards;
  showInfoModal(`Import successful! Imported ${totalItems} items.`);
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

// Check if a credit card is expiring within one month
function isCardExpiringSoon(card) {
  if (!card.isCard || !card.expiryDate) return false;
  
  const expiryDateStr = decrypt(card.expiryDate);
  if (!expiryDateStr) return false;
  
  // Parse expiry date (MM/YY format)
  const [month, year] = expiryDateStr.split('/');
  if (!month || !year) return false;
  
  // Create expiry date (last day of the expiry month)
  const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1 + 1, 0); // Last day of expiry month
  
  // Get current date and one month from now
  const now = new Date();
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(now.getMonth() + 1);
  
  // Check if card expires within one month
  return expiryDate <= oneMonthFromNow && expiryDate >= now;
}

// Validate and format expiry date input (MM/YY)
function validateExpiryDate(input) {
  // Remove all non-digits first
  let value = input.replace(/\D/g, '');
  
  // Limit to 4 digits max (MMYY)
  if (value.length > 4) {
    value = value.substring(0, 4);
  }
  
  // Format with slash
  if (value.length >= 2) {
    let month = value.substring(0, 2);
    const year = value.substring(2);
    
    // Validate and correct month (01-12)
    const monthNum = parseInt(month, 10);
    if (month.length === 2) {
      if (monthNum < 1) {
        month = '01';
      } else if (monthNum > 12) {
        month = '12';
      } else if (monthNum < 10 && month.charAt(0) !== '0') {
        month = '0' + monthNum; // Ensure leading zero
      }
    }
    
    value = month + year;
    
    // Add slash between month and year
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
  }
  
  return value;
}

// Set up expiry date input validation
function setupExpiryDateValidation() {
  const expiryInput = document.getElementById('expiryDateInput');
  if (!expiryInput) return;
  
  // Format input on keyup
  expiryInput.addEventListener('input', function(e) {
    const cursorPosition = e.target.selectionStart;
    const oldValue = e.target.value;
    const newValue = validateExpiryDate(e.target.value);
    
    if (oldValue !== newValue) {
      e.target.value = newValue;
      
      // Adjust cursor position if slash was added
      if (newValue.length > oldValue.length && newValue.charAt(2) === '/') {
        e.target.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
      } else {
        e.target.setSelectionRange(cursorPosition, cursorPosition);
      }
    }
  });
  
  // Validate on blur (when user leaves the field)
  expiryInput.addEventListener('blur', function(e) {
    const value = e.target.value;
    const invalidFeedback = e.target.parentNode.querySelector('.invalid-feedback');
    
    if (value.length === 5) { // MM/YY format
      const [month, year] = value.split('/');
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits of current year
      const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
      
      // Additional validation
      if (monthNum < 1 || monthNum > 12) {
        e.target.setCustomValidity('Please enter a valid month (01-12)');
        e.target.classList.add('is-invalid');
        if (invalidFeedback) invalidFeedback.textContent = 'Please enter a valid month (01-12)';
      } else if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
        e.target.setCustomValidity('Card expiry date cannot be in the past');
        e.target.classList.add('is-invalid');
        if (invalidFeedback) invalidFeedback.textContent = 'Card expiry date cannot be in the past';
      } else {
        e.target.setCustomValidity('');
        e.target.classList.remove('is-invalid');
        if (invalidFeedback) invalidFeedback.textContent = 'Please enter a valid expiry date in MM/YY format';
      }
    } else if (value.length > 0) {
      e.target.setCustomValidity('Please enter expiry date in MM/YY format');
      e.target.classList.add('is-invalid');
      if (invalidFeedback) invalidFeedback.textContent = 'Please enter expiry date in MM/YY format';
    } else {
      e.target.setCustomValidity('');
      e.target.classList.remove('is-invalid');
      if (invalidFeedback) invalidFeedback.textContent = 'Please enter a valid expiry date in MM/YY format';
    }
  });
  
  // Prevent paste of invalid data
  expiryInput.addEventListener('paste', function(e) {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const validated = validateExpiryDate(paste);
    e.target.value = validated;
    e.target.dispatchEvent(new Event('input'));
  });
}

function renderInfoCenter(pane) {
  // Gather only passwords from "All Items"
  let allPwds = getPasswords("all");
  
  // Also gather cards to check for expiring ones
  let allCards = getPasswords("cards");

  // Analyze and categorize passwords
  let stats = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
  let reused = 0;
  let pwMap = new Map(); // Track password usage
  let weak = 0;
  
  // Arrays to store categorized passwords and cards
  let weakPasswords = [];
  let mediumPasswords = [];
  let reusedPasswords = [];
  let expiringCards = [];

  // Check for expiring cards
  allCards.forEach(card => {
    if (isCardExpiringSoon(card)) {
      expiringCards.push({
        ...card,
        decryptedCardholderName: decrypt(card.cardholderName || ""),
        decryptedCardNumber: decrypt(card.cardNumber || ""),
        decryptedExpiryDate: decrypt(card.expiryDate || "")
      });
    }
  });

  // First pass: analyze all passwords and track usage
  allPwds.forEach(pw => {
    let realPw = decrypt(pw.password);
    let strength = getPasswordStrength(realPw);
    stats[strength]++;
    
    // Track password usage
    if (!pwMap.has(realPw)) {
      pwMap.set(realPw, []);
    }
    pwMap.get(realPw).push({
      ...pw,
      strength: strength,
      decryptedTitle: decrypt(pw.title || ""),
      decryptedUsername: decrypt(pw.username || "")
    });
    
    // Categorize by strength
    if (strength <= 2) {
      weak++;
      weakPasswords.push({
        ...pw,
        strength: strength,
        decryptedTitle: decrypt(pw.title || ""),
        decryptedUsername: decrypt(pw.username || "")
      });
    } else if (strength === 3) {
      mediumPasswords.push({
        ...pw,
        strength: strength,
        decryptedTitle: decrypt(pw.title || ""),
        decryptedUsername: decrypt(pw.username || "")
      });
    }
  });

  // Second pass: identify reused passwords
  pwMap.forEach((passwords, password) => {
    if (passwords.length > 1) {
      reused += passwords.length;
      reusedPasswords.push(...passwords);
    }
  });

  let total = allPwds.length;
  let bar = '';
  for (let i = 5; i >= 0; i--) {
    if (stats[i]) {
      let color = i >= 4 ? 'bg-success' : i === 3 ? 'bg-warning' : 'bg-danger';
      bar += `<div class="${color}" style="display:inline-block;width:${(stats[i]/(total||1))*100}%;height:22px"></div>`;
    }
  }

  // Generate weak passwords list HTML
  let weakPasswordsHTML = '';
  if (weakPasswords.length > 0) {
    weakPasswordsHTML = `
      <div class="mt-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Weak Passwords (${weakPasswords.length})</h5>
          <button class="btn btn-sm btn-outline-danger" type="button" data-bs-toggle="collapse" data-bs-target="#weakPasswordsList">
            <i class="bi bi-eye"></i> Show
          </button>
        </div>
        <div class="collapse" id="weakPasswordsList">
          <div class="card">
            <div class="card-body p-3">
              ${weakPasswords.map(pw => `
                <div class="password-item d-flex justify-content-between align-items-center py-2 border-bottom" style="cursor: pointer;" onclick="selectPassword('${pw.id}', '${pw.folderId}')">
                  <div>
                    <div class="fw-medium">${pw.decryptedTitle || 'Untitled'}</div>
                    <div class="small text-muted">${pw.decryptedUsername || 'No username'}</div>
                  </div>
                  <div>
                    <span class="badge bg-danger">Strength: ${pw.strength}/5</span>
                  </div>
                </div>
              `).join('')}
              <div class="mt-3 text-center">
                <small class="text-muted">Click on any password to edit and strengthen it</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate medium passwords list HTML
  let mediumPasswordsHTML = '';
  if (mediumPasswords.length > 0) {
    mediumPasswordsHTML = `
      <div class="mt-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0 text-warning"><i class="bi bi-exclamation-circle me-2"></i>Medium Passwords (${mediumPasswords.length})</h5>
          <button class="btn btn-sm btn-outline-warning" type="button" data-bs-toggle="collapse" data-bs-target="#mediumPasswordsList">
            <i class="bi bi-eye"></i> Show
          </button>
        </div>
        <div class="collapse" id="mediumPasswordsList">
          <div class="card">
            <div class="card-body p-3">
              ${mediumPasswords.map(pw => `
                <div class="password-item d-flex justify-content-between align-items-center py-2 border-bottom" style="cursor: pointer;" onclick="selectPassword('${pw.id}', '${pw.folderId}')">
                  <div>
                    <div class="fw-medium">${pw.decryptedTitle || 'Untitled'}</div>
                    <div class="small text-muted">${pw.decryptedUsername || 'No username'}</div>
                  </div>
                  <div>
                    <span class="badge bg-warning text-dark">Strength: ${pw.strength}/5</span>
                  </div>
                </div>
              `).join('')}
              <div class="mt-3 text-center">
                <small class="text-muted">Consider strengthening these passwords for better security</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate reused passwords list HTML
  let reusedPasswordsHTML = '';
  if (reusedPasswords.length > 0) {
    reusedPasswordsHTML = `
      <div class="mt-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0 text-info"><i class="bi bi-files me-2"></i>Reused Passwords (${reusedPasswords.length})</h5>
          <button class="btn btn-sm btn-outline-info" type="button" data-bs-toggle="collapse" data-bs-target="#reusedPasswordsList">
            <i class="bi bi-eye"></i> Show
          </button>
        </div>
        <div class="collapse" id="reusedPasswordsList">
          <div class="card">
            <div class="card-body p-3">
              ${reusedPasswords.map(pw => `
                <div class="password-item d-flex justify-content-between align-items-center py-2 border-bottom" style="cursor: pointer;" onclick="selectPassword('${pw.id}', '${pw.folderId}')">
                  <div>
                    <div class="fw-medium">${pw.decryptedTitle || 'Untitled'}</div>
                    <div class="small text-muted">${pw.decryptedUsername || 'No username'}</div>
                  </div>
                  <div>
                    <span class="badge bg-info">Reused</span>
                  </div>
                </div>
              `).join('')}
              <div class="mt-3 text-center">
                <small class="text-muted">Each account should have a unique password</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate expiring cards list HTML
  let expiringCardsHTML = '';
  if (expiringCards.length > 0) {
    expiringCardsHTML = `
      <div class="mt-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0 text-danger"><i class="bi bi-credit-card-fill me-2"></i>Cards Expiring Soon (${expiringCards.length})</h5>
          <button class="btn btn-sm btn-outline-danger" type="button" data-bs-toggle="collapse" data-bs-target="#expiringCardsList">
            <i class="bi bi-eye"></i> Show
          </button>
        </div>
        <div class="collapse" id="expiringCardsList">
          <div class="card">
            <div class="card-body p-3">
              ${expiringCards.map(card => {
                const lastFour = card.decryptedCardNumber.replace(/\s/g, '').slice(-4);
                return `
                  <div class="password-item d-flex justify-content-between align-items-center py-2 border-bottom" style="cursor: pointer;" onclick="selectPassword('${card.id}', 'cards')">
                    <div>
                      <div class="fw-medium">${card.decryptedCardholderName || 'Unknown Cardholder'}</div>
                      <div class="small text-muted">${card.cardType === 'credit' ? 'Credit' : 'Debit'} •••• ${lastFour}</div>
                    </div>
                    <div>
                      <span class="badge bg-danger">Expires: ${card.decryptedExpiryDate}</span>
                    </div>
                  </div>
                `;
              }).join('')}
              <div class="mt-3 text-center">
                <small class="text-muted">Update these cards before they expire</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  pane.innerHTML = `
    <div class="infocenter-container mx-auto" style="max-width:900px;">
      <div class="mb-5">
        <h4 class="mb-3"><i class="bi bi-graph-up-arrow me-2"></i> Info Center</h4>
        <div class="mb-2 fw-medium">Overall Password Strength</div>
        <div style="border-radius:8px;overflow:hidden;border:1px solid var(--border-color);">${bar}</div>
        <div class="mt-3">
          <span class="badge bg-success me-1">Strong: ${stats[5] + stats[4]}</span>
          <span class="badge bg-warning text-dark me-1">Medium: ${stats[3]}</span>
          <span class="badge bg-danger">Weak: ${stats[2] + stats[1] + stats[0]}</span>
        </div>
      </div>
      <div class="row g-4">
        <div class="col-12 col-md-3">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${weak}</div>
            <div class="text-secondary">Weak Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${reused}</div>
            <div class="text-secondary">Reused Passwords</div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${expiringCards.length}</div>
            <div class="text-secondary">Expiring Cards</div>
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card p-4 text-center">
            <div class="fs-1 fw-bold mb-2">${total}</div>
            <div class="text-secondary">Total Passwords</div>
          </div>
        </div>
      </div>
      
      ${expiringCardsHTML}
      ${weakPasswordsHTML}
      ${mediumPasswordsHTML}
      ${reusedPasswordsHTML}
      
      <div class="mt-5 text-secondary d-flex align-items-center">
        <i class="bi bi-shield-check me-2"></i> 
        <span>Passwords are analyzed locally and never leave your device.</span>
      </div>
    </div>
  `;
}

// Function to select and navigate to a specific password for editing
function selectPassword(passwordId, folderId) {
  // Set the folder first
  selectedFolder = folderId;
  
  // Set the password selection
  selectedPasswordId = passwordId;
  
  // Switch to edit mode
  addEditMode = "edit";
  
  // Re-render the UI to show the selected folder and password
  renderAll();
}

// Fix for rendering deleted cards in the Recently Deleted view

function renderDeletedItems(pane) {
  const deletedItems = getDeletedPasswords();
  
  // Using the same container style as Info Center
  pane.innerHTML = `
    <div class="infocenter-container mx-auto" style="max-width:900px;">
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
  
  // Create cards with the same style as Info Center cards
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
    } else if (item.customIconUrl) {
      // Use custom icon URL with transparent background
      iconHTML = `
        <div class="pw-icon-box" style="
          width: 40px;
          height: 40px;
          background-color: transparent;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="${item.customIconUrl}" style="width: 32px; height: 32px; object-fit: contain;" 
               onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <i class="bi bi-image" style="color: #6c757d; font-size: 16px; display: none;"></i>
        </div>`;
    } else if (item.icon && item.color) {
      // Use custom built-in icon with chosen color
      iconHTML = `
        <div class="pw-icon-box" style="
          width: 40px;
          height: 40px;
          background-color: ${item.color};
          border-radius: 8px;
          color: white;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 5px rgba(0,0,0,0.1);
        "><i class="bi ${item.icon}"></i></div>`;
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
  
  // Add info footer like in Info Center
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
// Update the renderCardForm function to use a Info Center-like layout
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
  
  // Create a Info Center-like layout
  pane.innerHTML = `
    <div class="infocenter-container mx-auto" style="max-width:900px;">
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
                  <div class="invalid-feedback">
                    Please enter a valid expiry date in MM/YY format
                  </div>
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
    const validatedValue = validateExpiryDate(this.value);
    this.value = validatedValue;
    document.getElementById('previewExpiryDate').innerText = validatedValue || 'MM/YY';
  });
  
  // Set up complete expiry date validation
  setupExpiryDateValidation();
  
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
      
      <!-- Icon and Color Selection -->
      <div class="mb-3">
        <label class="form-label">Icon & Color</label>
        
        <!-- Icon Type Selection -->
        <div class="mb-2">
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="iconType" id="iconTypeBuiltIn" value="builtin" ${!editing || !password.customIconUrl ? 'checked' : ''}>
            <label class="form-check-label" for="iconTypeBuiltIn">
              Built-in Icons
            </label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="iconType" id="iconTypeCustom" value="custom" ${editing && password.customIconUrl ? 'checked' : ''}>
            <label class="form-check-label" for="iconTypeCustom">
              Custom URL
            </label>
          </div>
        </div>
        
        <div class="d-flex align-items-center gap-3">
          <!-- Built-in Icon Selection -->
          <div class="dropdown" id="builtInIconSection" style="display: ${!editing || !password.customIconUrl ? 'block' : 'none'};">
            <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center" type="button" id="iconDropdown">
              <i class="bi ${editing && password.icon ? password.icon : 'bi-globe'}" id="selectedIcon"></i>
              <span class="ms-2">Choose Icon</span>
            </button>
            <ul class="dropdown-menu" style="max-height: 200px; overflow-y: auto; display: none;">
              <li><a class="dropdown-item" href="#" data-icon="bi-globe"><i class="bi bi-globe me-2"></i>Website</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-envelope"><i class="bi bi-envelope me-2"></i>Email</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-shield-lock"><i class="bi bi-shield-lock me-2"></i>Security</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-bank"><i class="bi bi-bank me-2"></i>Banking</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-credit-card"><i class="bi bi-credit-card me-2"></i>Payment</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-person"><i class="bi bi-person me-2"></i>Personal</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-briefcase"><i class="bi bi-briefcase me-2"></i>Work</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-controller"><i class="bi bi-controller me-2"></i>Gaming</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-camera"><i class="bi bi-camera me-2"></i>Social</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-cloud"><i class="bi bi-cloud me-2"></i>Cloud</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-server"><i class="bi bi-server me-2"></i>Server</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-phone"><i class="bi bi-phone me-2"></i>Mobile</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-laptop"><i class="bi bi-laptop me-2"></i>Computer</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-wifi"><i class="bi bi-wifi me-2"></i>Network</a></li>
              <li><a class="dropdown-item" href="#" data-icon="bi-key"><i class="bi bi-key me-2"></i>Access</a></li>
            </ul>
          </div>
          
          <!-- Custom URL Input -->
          <div id="customIconSection" style="display: ${editing && password.customIconUrl ? 'block' : 'none'};">
            <div class="d-flex align-items-center gap-2 mb-2">
              <input type="url" class="form-control" id="customIconUrl" name="customIconUrl" 
                     value="${editing && password.customIconUrl ? password.customIconUrl : ''}" 
                     placeholder="https://example.com/logo.png">
              <div id="customIconPreview" style="width: 32px; height: 32px; border: 1px solid #dee2e6; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
                ${editing && password.customIconUrl ? `<img src="${password.customIconUrl}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <i class="bi bi-image" style="color: #6c757d; display: none;"></i>` : `<i class="bi bi-image" style="color: #6c757d;"></i>`}
              </div>
            </div>
            
            <!-- Popular Platform Icons -->
            <div class="mb-2">
              <small class="text-muted">Popular platforms:</small>
              <div class="d-flex flex-wrap gap-1 mt-1">
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" title="Google">Google</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/facebook/facebook-original.svg" title="Facebook">Facebook</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/twitter/twitter-original.svg" title="Twitter">Twitter</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" title="GitHub">GitHub</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/microsoft/microsoft-original.svg" title="Microsoft">Microsoft</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg" title="Apple">Apple</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg" title="LinkedIn">LinkedIn</button>
                <button type="button" class="btn btn-sm btn-outline-secondary platform-icon-btn" data-url="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg" title="Slack">Slack</button>
              </div>
            </div>
            
            <small class="form-text text-muted">Enter URL to custom icon/logo (PNG, JPG, SVG) or click a platform button above</small>
          </div>
          
          <!-- Color Picker -->
          <div class="d-flex align-items-center">
            <label for="colorPicker" class="form-label me-2 mb-0">Color:</label>
            <input type="color" class="form-control form-control-color" id="colorPicker" name="color" value="${editing && password.color ? password.color : '#0d6efd'}" title="Choose color">
          </div>
        </div>
        <input type="hidden" name="icon" id="iconInput" value="${editing && password.icon ? password.icon : 'bi-globe'}">
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
  
  // Title input - auto-detect website favicon
  const titleInput = document.querySelector('input[name="title"]');
  
  titleInput.oninput = (e) => {
    const title = e.target.value.trim();
    
    // Check if the title looks like a URL
    if (title && (title.includes('http') || title.includes('.com') || title.includes('.org') || 
                  title.includes('.net') || title.includes('.io') || title.includes('.co') ||
                  title.includes('.edu') || title.includes('.gov'))) {
      
      // Extract domain from URL
      let domain = title;
      try {
        if (!title.startsWith('http')) {
          domain = 'https://' + title;
        }
        const url = new URL(domain);
        domain = url.hostname.replace('www.', '');
        
        // Generate favicon URL
        const faviconUrl = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
        
        // Get the radio buttons and input
        const iconTypeCustom = document.getElementById('iconTypeCustom');
        const iconTypeBuiltIn = document.getElementById('iconTypeBuiltIn');
        const customIconUrlInput = document.getElementById('customIconUrl');
        
        // Switch to custom URL mode and set the favicon
        iconTypeCustom.checked = true;
        iconTypeBuiltIn.checked = false;
        
        // Trigger the radio button change event
        iconTypeCustom.dispatchEvent(new Event('change'));
        
        // Set the favicon URL
        customIconUrlInput.value = faviconUrl;
        
        // Update the preview
        customIconUrlInput.dispatchEvent(new Event('input'));
        
      } catch (e) {
        // If URL parsing fails, try a simpler approach
        const simpleDomain = title.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        if (simpleDomain.includes('.')) {
          const faviconUrl = 'https://www.google.com/s2/favicons?domain=' + simpleDomain + '&sz=64';
          
          const iconTypeCustom = document.getElementById('iconTypeCustom');
          const iconTypeBuiltIn = document.getElementById('iconTypeBuiltIn');
          const customIconUrlInput = document.getElementById('customIconUrl');
          
          iconTypeCustom.checked = true;
          iconTypeBuiltIn.checked = false;
          iconTypeCustom.dispatchEvent(new Event('change'));
          
          customIconUrlInput.value = faviconUrl;
          customIconUrlInput.dispatchEvent(new Event('input'));
        }
      }
    }
  };
  
  // Icon dropdown functionality - simple click-based approach
  const iconDropdown = document.getElementById('iconDropdown');
  const iconDropdownMenu = iconDropdown.nextElementSibling;
  
  iconDropdown.onclick = (e) => {
    e.preventDefault();
    iconDropdownMenu.style.display = iconDropdownMenu.style.display === 'block' ? 'none' : 'block';
  };
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!iconDropdown.contains(e.target) && !iconDropdownMenu.contains(e.target)) {
      iconDropdownMenu.style.display = 'none';
    }
  });
  
  const iconDropdownItems = document.querySelectorAll('#iconDropdown + .dropdown-menu .dropdown-item');
  iconDropdownItems.forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const iconClass = item.getAttribute('data-icon');
      const iconText = item.textContent.trim();
      
      // Update the selected icon display
      document.getElementById('selectedIcon').className = `bi ${iconClass}`;
      document.getElementById('iconInput').value = iconClass;
      
      // Update dropdown button text
      const dropdownButton = document.getElementById('iconDropdown');
      dropdownButton.innerHTML = `<i class="bi ${iconClass}" id="selectedIcon"></i><span class="ms-2">${iconText}</span>`;
      
      // Close dropdown
      iconDropdownMenu.style.display = 'none';
    };
  });
  
  // Color picker functionality
  document.getElementById('colorPicker').onchange = (e) => {
    // Update any preview elements if needed
    const selectedIcon = document.getElementById('selectedIcon');
    selectedIcon.style.color = e.target.value;
  };
  
  // Icon type radio button functionality
  const iconTypeBuiltIn = document.getElementById('iconTypeBuiltIn');
  const iconTypeCustom = document.getElementById('iconTypeCustom');
  const builtInIconSection = document.getElementById('builtInIconSection');
  const customIconSection = document.getElementById('customIconSection');
  const colorPicker = document.getElementById('colorPicker');
  
  iconTypeBuiltIn.onchange = () => {
    if (iconTypeBuiltIn.checked) {
      builtInIconSection.style.display = 'block';
      customIconSection.style.display = 'none';
      // Enable color picker for built-in icons
      colorPicker.disabled = false;
      colorPicker.parentElement.style.opacity = '1';
    }
  };
  
  iconTypeCustom.onchange = () => {
    if (iconTypeCustom.checked) {
      builtInIconSection.style.display = 'none';
      customIconSection.style.display = 'block';
      // Disable color picker for custom URLs
      colorPicker.disabled = true;
      colorPicker.parentElement.style.opacity = '0.5';
    }
  };
  
  // Set initial color picker state based on current selection
  if (iconTypeCustom.checked) {
    colorPicker.disabled = true;
    colorPicker.parentElement.style.opacity = '0.5';
  } else {
    colorPicker.disabled = false;
    colorPicker.parentElement.style.opacity = '1';
  }
  
  // Custom icon URL preview functionality
  const customIconUrlInput = document.getElementById('customIconUrl');
  const customIconPreview = document.getElementById('customIconPreview');
  
  customIconUrlInput.oninput = (e) => {
    const url = e.target.value.trim();
    if (url) {
      // Update preview
      customIconPreview.innerHTML = `
        <img src="${url}" style="width: 100%; height: 100%; object-fit: contain;" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <i class="bi bi-image" style="color: #6c757d; display: none;"></i>
      `;
    } else {
      // Reset to default
      customIconPreview.innerHTML = `<i class="bi bi-image" style="color: #6c757d;"></i>`;
    }
  };
  
  // Platform icon buttons functionality
  const platformIconBtns = document.querySelectorAll('.platform-icon-btn');
  platformIconBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const iconUrl = btn.getAttribute('data-url');
      customIconUrlInput.value = iconUrl;
      
      // Trigger the input event to update preview
      customIconUrlInput.dispatchEvent(new Event('input'));
    };
  });
  
  // Generate Password button
  document.getElementById('generatePasswordBtn').onclick = () => {
    const field = document.getElementById('passwordField');
    
    // Generate password using user settings
    const password = generatePasswordWithSettings();
    
    if (password) {
      field.type = "text";
      field.value = password;
      document.getElementById('showPasswordBtn').innerHTML = '<i class="bi bi-eye-slash"></i>';
      
      // Flash the field to indicate it changed
      field.classList.add('bg-light');
      setTimeout(() => field.classList.remove('bg-light'), 200);
    }
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
      icon: data.iconType === 'custom' ? null : (data.icon || 'bi-globe'),
      color: data.color || '#0d6efd',
      customIconUrl: data.iconType === 'custom' ? data.customIconUrl : null,
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