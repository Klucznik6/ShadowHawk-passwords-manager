// Spanish Language Pack for HawkPass
const LANG_ES = {
  // Application title
  appTitle: "ShadowHawk Gestor de Contraseñas",
  
  // Window controls
  minimize: "Minimizar",
  close: "Cerrar",
  
  // Authentication
  login: "Iniciar sesión",
  register: "Registrarse",
  username: "Nombre de usuario",
  password: "Contraseña",
  newPassword: "Nueva contraseña",
  confirmPassword: "Confirmar contraseña",
  loginBtn: "Iniciar sesión",
  registerBtn: "Registrarse",
  logout: "Cerrar sesión",
  
  // Auth messages
  usernameExists: "El nombre de usuario ya existe",
  usernameNotFound: "Usuario no encontrado",
  incorrectPassword: "Contraseña incorrecta",
  dontHaveAccount: "¿No tienes una cuenta?",
  haveAccount: "¿Ya tienes una cuenta?",
  
  // Password Recovery
  forgotPassword: "¿Olvidaste tu contraseña?",
  passwordRecovery: "Recuperación de contraseña",
  recoveryCode: "Código de recuperación",
  resetPassword: "Restablecer contraseña",
  backToLogin: "Volver al inicio de sesión",
  recoveryCodeGenerated: "Tu código de recuperación (escríbelo y guárdalo en un lugar seguro):",
  recoveryCodeNote: "\n\nNecesitarás esto para restablecer tu contraseña si la olvidas.",
  
  // Main Interface
  myVaults: "Mis Bóvedas",
  loggedInAs: "Conectado como:",
  settings: "Configuración",
  
  // Folders
  allItems: "Todos los elementos",
  favorites: "Favoritos",
  paymentCards: "Tarjetas de pago",
  infoCenter: "Centro de información",
  recentlyDeleted: "Eliminados recientemente",
  newFolder: "Nueva carpeta",
  createFolder: "Crear nueva carpeta",
  folderName: "Nombre de carpeta",
  folderColor: "Color de carpeta",
  preview: "Vista previa",
  createBtn: "Crear carpeta",
  cancel: "Cancelar",
  
  // Password List
  search: "Buscar...",
  noPasswords: "Sin contraseñas.",
  newItem: "Nuevo elemento",
  newCard: "Nueva tarjeta",
  
  // Item Details
  selectPassword: "Selecciona una contraseña o crea una nueva.",
  itemNotFound: "Elemento no encontrado.",
  
  // Form Fields
  title: "Título",
  website: "Sitio web",
  email: "Correo electrónico",
  notes: "Notas",
  save: "Guardar",
  edit: "Editar",
  delete: "Eliminar",
  copy: "Copiar",
  showHide: "Mostrar/Ocultar contraseña",
  generate: "Generar",
  
  // Card Fields
  cardNumber: "Número de tarjeta",
  cardholderName: "Nombre del titular",
  expiryDate: "Fecha de vencimiento",
  cvv: "CVV",
  cardType: "Tipo de tarjeta",
  
  // Settings
  theme: "Tema",
  light: "Claro",
  dark: "Oscuro",
  language: "Idioma",
  passwordGeneration: "Generación de contraseñas",
  length: "Longitud",
  uppercase: "Mayúsculas (A-Z)",
  lowercase: "Minúsculas (a-z)",
  numbers: "Números (0-9)",
  symbols: "Símbolos (!@#$...)",
  excludeAmbiguous: "Excluir caracteres ambiguos (0, O, l, I)",
  dataManagement: "Gestión de datos",
  export: "Exportar",
  import: "Importar",
  
  // Export/Import
  exportCodeGenerated: "Código de exportación generado",
  importantSave: "Importante: ¡Guarda este código! Lo necesitarás para importar tus contraseñas.",
  yourExportCode: "Tu código de exportación:",
  copyCode: "Copiar código",
  downloadFile: "Descargar archivo",
  enterExportCode: "Ingresa el código de exportación",
  exportCodePlaceholder: "XXX-XXX-XXX-XXX-XXX-XXX",
  exportCodeHelp: "Ingresa el código que se proporcionó cuando se exportó el archivo.",
  
  // Confirmations
  confirmDelete: "¿Quieres eliminar este elemento?",
  yes: "Sí",
  no: "No",
  ok: "OK",
  
  // Messages
  copied: "¡Copiado al portapapeles!",
  passwordGenerated: "¡Contraseña generada!",
  itemSaved: "¡Elemento guardado!",
  itemDeleted: "¡Elemento eliminado!",
  folderCreated: "¡Carpeta creada!",
  folderDeleted: "¡Carpeta eliminada!",
  
  // Info Center
  totalItems: "Total de elementos",
  weakPasswords: "Contraseñas débiles",
  duplicatePasswords: "Contraseñas duplicadas",
  lastBackup: "Última copia de seguridad",
  securityScore: "Puntuación de seguridad",
  
  // Recently Deleted
  deletedItemsNote: "Los elementos eliminados se almacenan localmente y se eliminarán permanentemente después de 30 días.",
  restore: "Restaurar",
  permanentDelete: "Eliminar permanentemente",
  
  // Validation
  required: "Este campo es obligatorio",
  invalidEmail: "Por favor, ingresa una dirección de correo válida",
  passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
  passwordsNoMatch: "Las contraseñas no coinciden",
  
  // Tooltips
  addToFavorites: "Agregar a favoritos",
  removeFromFavorites: "Eliminar de favoritos",
  copyUsername: "Copiar nombre de usuario",
  copyPassword: "Copiar contraseña",
  copyEmail: "Copiar correo electrónico",
  editItem: "Editar elemento",
  deleteItem: "Eliminar elemento",
  
  // Password Strength
  weak: "Débil",
  fair: "Regular",
  good: "Buena",
  strong: "Fuerte",
  
  // Time formats
  never: "Nunca",
  today: "Hoy",
  yesterday: "Ayer",
  daysAgo: "días atrás",
  
  // File operations
  selectFile: "Seleccionar archivo",
  fileSelected: "Archivo seleccionado",
  noFileSelected: "Ningún archivo seleccionado",
  
  // Error messages
  errorOccurred: "Ocurrió un error",
  invalidFile: "Formato de archivo inválido",
  corruptedData: "Los datos parecen estar corruptos",
  networkError: "Ocurrió un error de red",
  
  // Success messages
  operationSuccessful: "Operación completada exitosamente",
  dataImported: "Datos importados exitosamente",
  dataExported: "Datos exportados exitosamente",
  
  // Common words
  and: "y",
  or: "o",
  of: "de",
  in: "en",
  on: "en",
  at: "en",
  to: "a",
  from: "de",
  with: "con",
  by: "por"
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LANG_ES;
}
