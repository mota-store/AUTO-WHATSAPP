# AUTO-WHATSAPP - Plataforma de Automação de WhatsApp

Uma plataforma web completa para automação de WhatsApp com chatbot baseado em fluxo de menus interativos.

## 🎯 Funcionalidades

- ✅ Cadastro e login de usuários com autenticação segura
- ✅ Conexão do WhatsApp via QR Code (Baileys)
- ✅ Dashboard para gerenciar instâncias do WhatsApp
- ✅ Editor visual de fluxo de menu interativo
- ✅ Motor de chatbot para processamento automático de mensagens
- ✅ Salvamento de fluxos no banco de dados
- ✅ Página de preview do fluxo
- ✅ Interface elegante e sofisticada

## 🛠️ Tech Stack

### Backend
- **Node.js** com Express
- **TypeScript** para type safety
- **MySQL** com Drizzle ORM
- **JWT** para autenticação
- **Baileys** para WhatsApp Web

### Frontend
- **React 19** com TypeScript
- **Vite** para build rápido
- **Tailwind CSS** para styling
- **React Router** para navegação
- **Sonner** para notificações

## 📋 Pré-requisitos

- Node.js 18+
- MySQL 8.0+
- npm ou pnpm

## 🚀 Setup Local

### 1. Clonar o repositório

```bash
git clone https://github.com/mota-store/AUTO-WHATSAPP.git
cd AUTO-WHATSAPP
```

### 2. Instalar dependências

```bash
npm install
# ou
pnpm install
```

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Edite `.env` com suas configurações:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/auto_whatsapp
JWT_SECRET=sua_chave_secreta_aqui
CORS_ORIGIN=http://localhost:5173
```

### 4. Criar banco de dados

```bash
# Criar banco de dados MySQL
mysql -u root -p -e "CREATE DATABASE auto_whatsapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 5. Executar migrações

```bash
npm run db:push
```

### 6. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000` e o frontend em `http://localhost:5173`.

## 📦 Build para Produção

```bash
npm run build
```

Isso gera os arquivos em `dist/`.

## 🚀 Deploy no Render

### 1. Conectar repositório

1. Acesse [Render.com](https://render.com)
2. Crie um novo Web Service
3. Conecte seu repositório GitHub
4. Configure:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`

### 2. Configurar variáveis de ambiente

No painel do Render, adicione as variáveis de ambiente:

```env
NODE_ENV=production
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=sua_chave_secreta_segura
CORS_ORIGIN=https://seu-dominio.onrender.com
```

### 3. Deploy

O Render fará deploy automaticamente quando você fazer push para o branch `main`.

## 📁 Estrutura do Projeto

```
auto-whatsapp/
├── src/
│   ├── client/          # Frontend React
│   │   ├── pages/       # Páginas (Login, Dashboard, etc)
│   │   ├── components/  # Componentes reutilizáveis
│   │   └── index.html   # HTML principal
│   └── server/          # Backend Node.js
│       ├── types.ts     # Tipos TypeScript
│       ├── utils.ts     # Utilitários (JWT, bcrypt, etc)
│       └── db.ts        # Queries do banco de dados
├── drizzle/
│   ├── schema.ts        # Schema do banco de dados
│   └── migrations/      # Migrações SQL
├── server.ts            # Servidor Express principal
├── package.json         # Dependências
├── tsconfig.json        # Configuração TypeScript
├── vite.config.ts       # Configuração Vite
└── tailwind.config.ts   # Configuração Tailwind
```

## 🔐 Segurança

- Senhas são hasheadas com bcrypt
- Autenticação via JWT com expiração de 7 dias
- CORS configurado para produção
- Variáveis sensíveis em `.env` (não commitadas)

## 📝 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login

### Dashboard
- `GET /api/dashboard` - Obter dados do dashboard

### Fluxos de Menu
- `POST /api/flows` - Criar novo fluxo
- `GET /api/flows/:flowId` - Obter fluxo específico
- `PUT /api/flows/:flowId` - Atualizar fluxo
- `DELETE /api/flows/:flowId` - Deletar fluxo

### WhatsApp
- `POST /api/whatsapp/:instanceId/disconnect` - Desconectar WhatsApp

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, faça um fork do projeto e crie um pull request.

## 📄 Licença

MIT

## 📞 Suporte

Para suporte, abra uma issue no repositório do GitHub.

---

**Desenvolvido com ❤️ para automação de WhatsApp**
