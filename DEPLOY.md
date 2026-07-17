# 🚀 Guia de Deploy no Render

Este documento fornece instruções passo a passo para fazer deploy da plataforma AUTO-WHATSAPP no Render.

## Pré-requisitos

- Conta no [Render.com](https://render.com)
- Repositório GitHub conectado
- Banco de dados MySQL (você pode usar um serviço como AWS RDS, PlanetScale, ou similar)

## Passo 1: Preparar o Banco de Dados

### Opção A: Usar PlanetScale (Recomendado)

1. Acesse [PlanetScale.com](https://planetscale.com)
2. Crie uma conta gratuita
3. Crie um novo banco de dados chamado `auto_whatsapp`
4. Copie a connection string (formato: `mysql://user:password@host/database`)

### Opção B: Usar AWS RDS

1. Acesse [AWS RDS](https://aws.amazon.com/rds/)
2. Crie uma instância MySQL
3. Copie a connection string

## Passo 2: Configurar no Render

### 1. Criar um novo Web Service

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em "New +"
3. Selecione "Web Service"
4. Conecte seu repositório GitHub `mota-store/AUTO-WHATSAPP`

### 2. Configurar Build e Deploy

Na página de configuração, preencha:

- **Name**: `auto-whatsapp` (ou seu nome preferido)
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: `Starter` (gratuito)

### 3. Adicionar Variáveis de Ambiente

Clique em "Advanced" e adicione as seguintes variáveis:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://seu_user:sua_senha@seu_host:3306/auto_whatsapp
JWT_SECRET=gere_uma_chave_segura_aqui_com_pelo_menos_32_caracteres
CORS_ORIGIN=https://seu-app.onrender.com
```

**Como gerar uma chave JWT segura:**

```bash
# No terminal, execute:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy

Clique em "Create Web Service" e o Render iniciará o deploy automaticamente.

## Passo 3: Executar Migrações do Banco de Dados

Após o deploy inicial, você precisa executar as migrações do banco de dados.

### Opção A: Via Render Shell

1. No dashboard do Render, acesse seu Web Service
2. Clique em "Shell"
3. Execute:

```bash
npm run db:push
```

### Opção B: Via Drizzle Studio

1. Execute localmente:

```bash
npx drizzle-kit studio
```

2. Conecte com sua `DATABASE_URL`
3. Execute as migrações

## Passo 4: Verificar o Deploy

1. Acesse `https://seu-app.onrender.com`
2. Você deve ver a página de login
3. Crie uma conta de teste
4. Faça login e teste as funcionalidades

## Troubleshooting

### Erro: "Connection refused"

- Verifique se a `DATABASE_URL` está correta
- Certifique-se de que o banco de dados está acessível
- Verifique se o firewall permite conexões do Render

### Erro: "Build failed"

- Verifique os logs do build no Render
- Certifique-se de que todas as dependências estão no `package.json`
- Execute `npm install` localmente e teste

### Erro: "Application failed to start"

- Verifique os logs do aplicativo
- Certifique-se de que a `DATABASE_URL` está configurada
- Verifique se o `PORT` está configurado corretamente

## Monitoramento

### Logs

No dashboard do Render, você pode visualizar:
- **Logs de Build**: Clique em "Logs"
- **Logs de Runtime**: Clique em "Logs" após o deploy

### Métricas

O Render fornece métricas de:
- CPU
- Memória
- Requisições
- Tempo de resposta

## Atualizações

Para fazer deploy de novas versões:

1. Faça suas alterações localmente
2. Commit e push para `main`:

```bash
git add .
git commit -m "Sua mensagem de commit"
git push origin main
```

3. O Render fará deploy automaticamente

## Variáveis de Ambiente Importantes

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente (development/production) | `production` |
| `PORT` | Porta do servidor | `3000` |
| `DATABASE_URL` | Connection string do MySQL | `mysql://...` |
| `JWT_SECRET` | Chave para assinar tokens JWT | `abc123...` |
| `CORS_ORIGIN` | URL permitida para CORS | `https://seu-app.onrender.com` |

## Segurança

- ✅ Nunca commit `.env` no repositório
- ✅ Use variáveis de ambiente para dados sensíveis
- ✅ Mude `JWT_SECRET` em produção
- ✅ Use HTTPS (Render fornece automaticamente)
- ✅ Configure firewall do banco de dados

## Próximos Passos

1. Configurar domínio personalizado (opcional)
2. Ativar auto-deploy em push
3. Configurar backups do banco de dados
4. Monitorar performance e logs

## Suporte

Para problemas com Render:
- [Documentação Render](https://render.com/docs)
- [Suporte Render](https://support.render.com)

Para problemas com a aplicação:
- Verifique os logs
- Abra uma issue no GitHub
- Consulte o README.md

---

**Sucesso no seu deploy! 🎉**
