// English Language Pack for HawkPass
const LANG_EN = {
  // Application title
  appTitle: "ShadowHawk Password Manager",
  
  // Window controls
  minimize: "Minimize",
  close: "Close",
  
  // Authentication
  login: "Login",
  register: "Register",
  username: "Username",
  password: "Password",
  newPassword: "New Password",
  confirmPassword: "Confirm Password",
  loginBtn: "Login",
  registerBtn: "Register",
  logout: "Logout",
  
  // Auth messages
  usernameExists: "Username already exists",
  usernameNotFound: "Username not found",
  incorrectPassword: "Incorrect password",
  dontHaveAccount: "Don't have an account?",
  haveAccount: "Already have an account?",
  
  // Password Recovery
  forgotPassword: "Forgot password?",
  passwordRecovery: "Password Recovery",
  recoveryCode: "Recovery Code",
  resetPassword: "Reset Password",
  backToLogin: "Back to login",
  recoveryCodeGenerated: "Your recovery code (write it down and keep it safe):",
  recoveryCodeNote: "\n\nYou will need this to reset your password if you forget it.",
  
  // Main Interface
  myVaults: "My Vaults",
  loggedInAs: "Logged in as:",
  settings: "Settings",
  
  // Folders
  allItems: "All Items",
  favorites: "Favorites",
  paymentCards: "Payment Cards",
  infoCenter: "Info Center",
  recentlyDeleted: "Recently Deleted",
  newFolder: "New Folder",
  createFolder: "Create New Folder",
  folderName: "Folder Name",
  folderColor: "Folder Color",
  preview: "Preview",
  createBtn: "Create Folder",
  cancel: "Cancel",
  
  // Password List
  search: "Search...",
  noPasswords: "No passwords.",
  newItem: "New Item",
  newCard: "New Card",
  
  // Item Details
  selectPassword: "Select a password or create a new one.",
  itemNotFound: "Item not found.",
  
  // Form Fields
  title: "Title",
  website: "Website",
  email: "Email",
  notes: "Notes",
  save: "Save",
  edit: "Edit",
  delete: "Delete",
  copy: "Copy",
  showHide: "Show/Hide Password",
  generate: "Generate",
  
  // Card Fields
  cardNumber: "Card Number",
  cardholderName: "Cardholder Name",
  expiryDate: "Expiry Date",
  cvv: "CVV",
  cardType: "Card Type",
  
  // Settings
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  language: "Language",
  passwordGeneration: "Password Generation",
  length: "Length",
  uppercase: "Uppercase (A-Z)",
  lowercase: "Lowercase (a-z)",
  numbers: "Numbers (0-9)",
  symbols: "Symbols (!@#$...)",
  excludeAmbiguous: "Exclude ambiguous characters (0, O, l, I)",
  dataManagement: "Data Management",
  export: "Export",
  import: "Import",
  
  // Export/Import
  exportCodeGenerated: "Export Code Generated",
  importantSave: "Important: Save this code! You'll need it to import your passwords.",
  yourExportCode: "Your Export Code:",
  copyCode: "Copy Code",
  downloadFile: "Download File",
  enterExportCode: "Enter Export Code",
  exportCodePlaceholder: "XXX-XXX-XXX-XXX-XXX-XXX",
  exportCodeHelp: "Enter the code that was provided when the file was exported.",
  
  // Confirmations
  confirmDelete: "Do you want to remove this element?",
  yes: "Yes",
  no: "No",
  ok: "OK",
  
  // Messages
  copied: "Copied to clipboard!",
  passwordGenerated: "Password generated!",
  itemSaved: "Item saved!",
  itemDeleted: "Item deleted!",
  folderCreated: "Folder created!",
  folderDeleted: "Folder deleted!",
  
  // Info Center
  totalItems: "Total Items",
  weakPasswords: "Weak Passwords",
  duplicatePasswords: "Duplicate Passwords",
  lastBackup: "Last Backup",
  securityScore: "Security Score",
  
  // Recently Deleted
  deletedItemsNote: "Deleted items are stored locally and will be permanently removed after 30 days.",
  restore: "Restore",
  permanentDelete: "Delete Permanently",
  
  // Validation
  required: "This field is required",
  invalidEmail: "Please enter a valid email address",
  passwordTooShort: "Password must be at least 8 characters",
  passwordsNoMatch: "Passwords do not match",
  
  // Tooltips
  addToFavorites: "Add to Favorites",
  removeFromFavorites: "Remove from Favorites",
  copyUsername: "Copy Username",
  copyPassword: "Copy Password",
  copyEmail: "Copy Email",
  editItem: "Edit Item",
  deleteItem: "Delete Item",
  
  // Password Strength
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
  
  // Time formats
  never: "Never",
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: "days ago",
  
  // File operations
  selectFile: "Select File",
  fileSelected: "File Selected",
  noFileSelected: "No file selected",
  
  // Error messages
  errorOccurred: "An error occurred",
  invalidFile: "Invalid file format",
  corruptedData: "Data appears to be corrupted",
  networkError: "Network error occurred",
  
  // Success messages
  operationSuccessful: "Operation completed successfully",
  dataImported: "Data imported successfully",
  dataExported: "Data exported successfully",
  
  // Common words
  and: "and",
  or: "or",
  of: "of",
  in: "in",
  on: "on",
  at: "at",
  to: "to",
  from: "from",
  with: "with",
  by: "by"
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LANG_EN;
}
