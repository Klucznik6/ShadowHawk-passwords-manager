// Language Manager for HawkPass
class LanguageManager {
  constructor() {
    this.currentLanguage = 'en';
    this.languages = {
      'en': LANG_EN,
      'pl': LANG_PL,
      'es': LANG_ES,
      'de': LANG_DE,
      'fr': LANG_FR,
      'pt': LANG_PT
    };
    
    // Load saved language preference or detect system language
    const savedLang = localStorage.getItem('hawkpass_language');
    if (savedLang && this.languages[savedLang]) {
      this.currentLanguage = savedLang;
      console.log(`🌍 HawkPass: Using saved language preference: ${savedLang}`);
    } else {
      // Auto-detect system language if no preference is saved
      const systemLang = navigator.language || navigator.languages?.[0] || 'en';
      this.currentLanguage = this.detectSystemLanguage();
      // Save the detected language as preference
      localStorage.setItem('hawkpass_language', this.currentLanguage);
      console.log(`🌍 HawkPass: System language detected: ${systemLang} → Using: ${this.currentLanguage}`);
    }
    
    // Initialize language
    this.loadLanguage();
  }
  
  // Detect system language and map to supported languages
  detectSystemLanguage() {
    // Get browser/system language
    const systemLang = navigator.language || navigator.languages?.[0] || 'en';
    
    // Extract language code (e.g., 'en-US' -> 'en', 'de-DE' -> 'de')
    const langCode = systemLang.toLowerCase().split('-')[0];
    
    // Map common language codes to our supported languages
    const languageMap = {
      'en': 'en', // English
      'pl': 'pl', // Polish
      'es': 'es', // Spanish
      'de': 'de', // German
      'fr': 'fr', // French
      'pt': 'pt', // Portuguese
      // Additional mappings for common variants
      'pt-br': 'pt', // Brazilian Portuguese
      'pt-pt': 'pt', // European Portuguese
      'es-es': 'es', // Spain Spanish
      'es-mx': 'es', // Mexican Spanish
      'de-de': 'de', // German (Germany)
      'de-at': 'de', // German (Austria)
      'fr-fr': 'fr', // French (France)
      'fr-ca': 'fr'  // French (Canada)
    };
    
    // Check if we support the detected language
    const mappedLang = languageMap[langCode] || languageMap[systemLang.toLowerCase()];
    
    // Return supported language or default to English
    return (mappedLang && this.languages[mappedLang]) ? mappedLang : 'en';
  }
  
  // Get system language information (for debugging/info)
  getSystemLanguageInfo() {
    return {
      detected: navigator.language || navigator.languages?.[0] || 'en',
      available: navigator.languages || [navigator.language || 'en'],
      mapped: this.detectSystemLanguage(),
      current: this.currentLanguage
    };
  }
  
  // Get current language object
  getCurrentLanguage() {
    return this.languages[this.currentLanguage] || this.languages['en'];
  }
  
  // Get translated text
  t(key) {
    const lang = this.getCurrentLanguage();
    return lang[key] || key;
  }
  
  // Set language
  setLanguage(langCode) {
    if (this.languages[langCode]) {
      this.currentLanguage = langCode;
      localStorage.setItem('hawkpass_language', langCode);
      this.loadLanguage();
      this.updateUI();
    }
  }
  
  // Get available languages
  getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' }
    ];
  }
  
  // Load language and apply to HTML elements
  loadLanguage() {
    // Update HTML lang attribute
    document.documentElement.lang = this.currentLanguage;
    
    // Update page title
    document.title = this.t('appTitle');
    
    // Update all elements with data-lang attributes
    this.updateElementsWithLangAttributes();
    
    // Update language dropdown if it exists
    if (typeof updateLanguageDropdown === 'function') {
      updateLanguageDropdown();
    }
  }
  
  // Update elements that have data-lang attributes
  updateElementsWithLangAttributes() {
    const elements = document.querySelectorAll('[data-lang]');
    elements.forEach(element => {
      const key = element.getAttribute('data-lang');
      const translation = this.t(key);
      
      if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'password' || element.type === 'email')) {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'submit') {
        element.value = translation;
      } else if (element.hasAttribute('title')) {
        element.title = translation;
      } else {
        element.textContent = translation;
      }
    });
  }
  
  // Update entire UI after language change
  updateUI() {
    // Update static elements
    this.updateElementsWithLangAttributes();
    
    // Update dynamic content that might be generated by JavaScript
    this.updateDynamicContent();
    
    // Trigger re-render of current view
    if (typeof updateCurrentView === 'function') {
      updateCurrentView();
    }
  }
  
  // Update dynamic content
  updateDynamicContent() {
    // Update folder names (only for system folders)
    this.updateSystemFolders();
    
    // Update any open modals
    this.updateModals();
    
    // Update buttons and common UI elements
    this.updateCommonElements();
  }
  
  // Update system folder names
  updateSystemFolders() {
    const foldersList = document.getElementById('foldersList');
    if (foldersList) {
      const folders = foldersList.querySelectorAll('li[data-folder-id]');
      folders.forEach(li => {
        const folderId = li.getAttribute('data-folder-id');
        const span = li.querySelector('span');
        if (span && this.isSystemFolder(folderId)) {
          span.textContent = this.getSystemFolderName(folderId);
        }
      });
    }
  }
  
  // Check if folder is a system folder
  isSystemFolder(folderId) {
    return ['all', 'favorites', 'cards', 'infocenter', 'deleted'].includes(folderId);
  }
  
  // Get system folder name
  getSystemFolderName(folderId) {
    const folderNames = {
      'all': this.t('allItems'),
      'favorites': this.t('favorites'),
      'cards': this.t('paymentCards'),
      'infocenter': this.t('infoCenter'),
      'deleted': this.t('recentlyDeleted')
    };
    return folderNames[folderId] || folderId;
  }
  
  // Update modals
  updateModals() {
    // Settings modal
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && !settingsModal.classList.contains('d-none')) {
      this.updateSettingsModal();
    }
    
    // Folder modal
    const folderModal = document.getElementById('folderModal');
    if (folderModal && !folderModal.classList.contains('d-none')) {
      this.updateFolderModal();
    }
  }
  
  // Update settings modal
  updateSettingsModal() {
    const elements = {
      'h5': this.t('settings'),
      '[data-lang="theme"]': this.t('theme'),
      '[data-lang="language"]': this.t('language'),
      '[data-lang="passwordGeneration"]': this.t('passwordGeneration'),
      '[data-lang="dataManagement"]': this.t('dataManagement')
    };
    
    Object.keys(elements).forEach(selector => {
      const element = document.querySelector(`#settingsModal ${selector}`);
      if (element) {
        element.textContent = elements[selector];
      }
    });
  }
  
  // Update folder modal
  updateFolderModal() {
    const elements = {
      'h5': this.t('createFolder'),
      '[data-lang="folderName"]': this.t('folderName'),
      '[data-lang="folderColor"]': this.t('folderColor'),
      '[data-lang="preview"]': this.t('preview')
    };
    
    Object.keys(elements).forEach(selector => {
      const element = document.querySelector(`#folderModal ${selector}`);
      if (element) {
        element.textContent = elements[selector];
      }
    });
  }
  
  // Update common elements
  updateCommonElements() {
    // Update current folder name
    const currentFolderName = document.getElementById('currentFolderName');
    if (currentFolderName && currentFolderName.getAttribute('data-folder-id')) {
      const folderId = currentFolderName.getAttribute('data-folder-id');
      if (this.isSystemFolder(folderId)) {
        currentFolderName.textContent = this.getSystemFolderName(folderId);
      }
    }
    
    // Update "My Vaults" text
    const vaultsText = document.querySelector('.fs-5.fw-semibold');
    if (vaultsText && vaultsText.textContent.includes('Vaults') || vaultsText.textContent.includes('Sejfy') || vaultsText.textContent.includes('Bóvedas')) {
      vaultsText.textContent = this.t('myVaults');
    }
  }
  
  // Format date/time according to language
  formatDateTime(date, format = 'relative') {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (format === 'relative') {
      if (diffDays === 0) return this.t('today');
      if (diffDays === 1) return this.t('yesterday');
      if (diffDays > 1) return `${diffDays} ${this.t('daysAgo')}`;
    }
    
    // Fallback to locale-specific formatting
    return date.toLocaleDateString(this.getLocaleCode());
  }
  
  // Get locale code for date formatting
  getLocaleCode() {
    const locales = {
      'en': 'en-US',
      'pl': 'pl-PL',
      'es': 'es-ES'
    };
    return locales[this.currentLanguage] || 'en-US';
  }
}

// Initialize language manager
const langManager = new LanguageManager();

// Make it globally available
window.langManager = langManager;

// Convenience function for translations
function t(key) {
  return langManager.t(key);
}

// Make translation function globally available
window.t = t;
