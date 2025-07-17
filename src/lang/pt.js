// Portuguese Language Pack for HawkPass
const LANG_PT = {
  // Application title
  appTitle: "ShadowHawk Gerenciador de senhas",
  
  // Window controls
  minimize: "Minimizar",
  close: "Fechar",
  
  // Authentication
  login: "Entrar",
  register: "Registrar",
  username: "Nome de usuário",
  password: "Senha",
  newPassword: "Nova senha",
  confirmPassword: "Confirmar senha",
  loginBtn: "Entrar",
  registerBtn: "Registrar",
  logout: "Sair",
  
  // Auth messages
  usernameExists: "Nome de usuário já existe",
  usernameNotFound: "Usuário não encontrado",
  incorrectPassword: "Senha incorreta",
  dontHaveAccount: "Não tem uma conta?",
  haveAccount: "Já tem uma conta?",
  
  // Password Recovery
  forgotPassword: "Esqueceu a senha?",
  passwordRecovery: "Recuperação de senha",
  recoveryCode: "Código de recuperação",
  resetPassword: "Redefinir senha",
  backToLogin: "Voltar ao login",
  recoveryCodeGenerated: "Seu código de recuperação (anote e mantenha seguro):",
  recoveryCodeNote: "\n\nVocê precisará dele para redefinir sua senha se esquecer.",
  
  // Main Interface
  myVaults: "Meus cofres",
  loggedInAs: "Logado como:",
  settings: "Configurações",
  
  // Folders
  allItems: "Todos os itens",
  favorites: "Favoritos",
  paymentCards: "Cartões de pagamento",
  infoCenter: "Centro de informações",
  recentlyDeleted: "Excluídos recentemente",
  newFolder: "Nova pasta",
  createFolder: "Criar nova pasta",
  folderName: "Nome da pasta",
  folderColor: "Cor da pasta",
  preview: "Visualização",
  createBtn: "Criar pasta",
  cancel: "Cancelar",
  
  // Password List
  search: "Pesquisar...",
  noPasswords: "Nenhuma senha.",
  newItem: "Novo item",
  newCard: "Novo cartão",
  
  // Item Details
  selectPassword: "Selecione uma senha ou crie uma nova.",
  itemNotFound: "Item não encontrado.",
  
  // Form Fields
  title: "Título",
  website: "Site",
  email: "E-mail",
  notes: "Anotações",
  save: "Salvar",
  edit: "Editar",
  delete: "Excluir",
  copy: "Copiar",
  showHide: "Mostrar/Ocultar senha",
  generate: "Gerar",
  
  // Card Fields
  cardNumber: "Número do cartão",
  cardholderName: "Nome do portador",
  expiryDate: "Data de validade",
  cvv: "CVV",
  cardType: "Tipo de cartão",
  
  // Settings
  theme: "Tema",
  light: "Claro",
  dark: "Escuro",
  language: "Idioma",
  passwordGeneration: "Geração de senhas",
  length: "Comprimento",
  uppercase: "Maiúsculas (A-Z)",
  lowercase: "Minúsculas (a-z)",
  numbers: "Números (0-9)",
  symbols: "Símbolos (!@#$...)",
  excludeAmbiguous: "Excluir caracteres ambíguos (0, O, l, I)",
  dataManagement: "Gerenciamento de dados",
  export: "Exportar",
  import: "Importar",
  
  // Export/Import
  exportCodeGenerated: "Código de exportação gerado",
  importantSave: "Importante: Salve este código! Você precisará dele para importar suas senhas.",
  yourExportCode: "Seu código de exportação:",
  copyCode: "Copiar código",
  downloadFile: "Baixar arquivo",
  enterExportCode: "Digite o código de exportação",
  exportCodePlaceholder: "XXX-XXX-XXX-XXX-XXX-XXX",
  exportCodeHelp: "Digite o código que foi fornecido ao exportar o arquivo.",
  
  // Confirmations
  confirmDelete: "Deseja excluir este item?",
  yes: "Sim",
  no: "Não",
  ok: "OK",
  
  // Messages
  copied: "Copiado para a área de transferência!",
  passwordGenerated: "Senha gerada!",
  itemSaved: "Item salvo!",
  itemDeleted: "Item excluído!",
  folderCreated: "Pasta criada!",
  folderDeleted: "Pasta excluída!",
  
  // Info Center
  totalItems: "Total de itens",
  weakPasswords: "Senhas fracas",
  duplicatePasswords: "Senhas duplicadas",
  lastBackup: "Último backup",
  securityScore: "Pontuação de segurança",
  
  // Recently Deleted
  deletedItemsNote: "Itens excluídos são armazenados localmente e serão permanentemente removidos após 30 dias.",
  restore: "Restaurar",
  permanentDelete: "Excluir permanentemente",
  
  // Validation
  required: "Este campo é obrigatório",
  invalidEmail: "Por favor, insira um endereço de e-mail válido",
  passwordTooShort: "A senha deve ter pelo menos 8 caracteres",
  passwordsNoMatch: "As senhas não coincidem",
  
  // Tooltips
  addToFavorites: "Adicionar aos favoritos",
  removeFromFavorites: "Remover dos favoritos",
  copyUsername: "Copiar nome de usuário",
  copyPassword: "Copiar senha",
  copyEmail: "Copiar e-mail",
  editItem: "Editar item",
  deleteItem: "Excluir item",
  
  // Password Strength
  weak: "Fraca",
  fair: "Razoável",
  good: "Boa",
  strong: "Forte",
  
  // Time formats
  never: "Nunca",
  today: "Hoje",
  yesterday: "Ontem",
  daysAgo: "dias atrás",
  
  // File operations
  selectFile: "Selecionar arquivo",
  fileSelected: "Arquivo selecionado",
  noFileSelected: "Nenhum arquivo selecionado",
  
  // Error messages
  errorOccurred: "Ocorreu um erro",
  invalidFile: "Formato de arquivo inválido",
  corruptedData: "Os dados parecem corrompidos",
  networkError: "Erro de rede ocorrido",
  
  // Success messages
  operationSuccessful: "Operação concluída com sucesso",
  dataImported: "Dados importados com sucesso",
  dataExported: "Dados exportados com sucesso",
  
  // Common words
  and: "e",
  or: "ou",
  of: "de",
  in: "em",
  on: "em",
  at: "em",
  to: "para",
  from: "de",
  with: "com",
  by: "por"
};

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LANG_PT;
}
