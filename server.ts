import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createToken, verifyPassword, hashPassword, verifyToken, extractToken } from './src/server/utils'
import * as db from './src/server/db'
import { AuthPayload, CreateFlowRequest, UpdateFlowRequest } from './src/server/types'
import { MenuFlowData, MenuNode, MenuOption } from './drizzle/schema'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import { fileURLToPath } from 'url'
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { Boom } from '@hapi/boom'
import type { ConnectionState, WAConnectionState } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'

const execAsync = promisify(exec)
const sessions = new Map<number, any>()
const pairingCodeRequests = new Map<number, { number: string, attempts: number, timer: any }>()
const lastConnectionAttempt = new Map<number, number>()
const messageStates = new Map<string, { flowId: number, menuId: string, userId: number, instanceId: number }>()
const app = express()
const PORT = process.env.PORT || 8080

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 [MOTA-FLOW] Iniciando servidor...')

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)
  if (!token) return res.status(401).json({ message: 'Token não fornecido' })
  const payload = await verifyToken(token)
  if (!payload) return res.status(401).json({ message: 'Token inválido' })
  ;(req as any).user = payload
  next()
}

// Routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) return res.status(400).json({ message: 'Campos obrigatórios faltando' })
    const existingUser = await db.getUserByEmail(email)
    if (existingUser) return res.status(400).json({ message: 'Email já cadastrado' })
    const passwordHash = await hashPassword(password)
    await db.createUser(email, passwordHash, name)
    const newUser = await db.getUserByEmail(email)
    if (!newUser) throw new Error('Erro ao criar usuário')
    const token = await createToken(newUser.id, newUser.email)
    res.json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } })
  } catch (error: any) {
    console.error('[REGISTER ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao criar usuário', detail: error?.message })
  }
})

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const user = await db.getUserByEmail(email)
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }
    const token = await createToken(user.id, user.email)
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (error: any) {
    console.error('[LOGIN ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao fazer login', detail: error?.message })
  }
})

app.post('/api/auth/update-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as AuthPayload
    const { currentPassword, newPassword } = req.body
    const user = await db.getUserById(userPayload.userId)
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: 'Senha atual incorreta' })
    }
    const newPasswordHash = await hashPassword(newPassword)
    await db.updateUserPassword(user.id, newPasswordHash)
    res.json({ message: 'Senha atualizada' })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao atualizar' })
  }
})

app.post('/api/auth/update-avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as AuthPayload
    const { avatar } = req.body
    await db.updateUserAvatar(userPayload.userId, avatar)
    res.json({ message: 'Foto de perfil atualizada' })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao atualizar foto' })
  }
})

app.get('/api/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as AuthPayload
    const user = await db.getUserById(userPayload.userId)
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' })
    res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao buscar perfil' })
  }
})

app.get('/api/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const instance = await db.getWhatsappInstance(user.userId)
    const flows = await db.getUserMenuFlows(user.userId)
    res.json({ instance, flows })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro no dashboard' })
  }
})

// Forgot Password - Solicitar reset
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email obrigatório' })

    const user = await db.getUserByEmail(email)
    if (!user) {
      // Não revelar se o email existe ou não
      return res.json({ message: 'Se o email existir, você receberá um link de redefinição' })
    }

    // Gerar token de reset
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hora

    await db.updateResetToken(user.id, resetToken, resetTokenExpiry)

    // Retornar resposta imediatamente para o frontend
    res.json({ message: 'Se o email existir, você receberá um link de redefinição' })

    // Enviar e-mail em background (fire-and-forget)
    const resetUrl = `${process.env.APP_URL || 'https://auto-whatsapp-production-73d9.up.railway.app'}/reset-password/${resetToken}`
    const userEmail = email
    const targetEmail = userEmail

    setImmediate(async () => {
      try {
        console.log('[EMAIL] Iniciando envio para', targetEmail)
        const transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.BREVO_SMTP_USER || '',
            pass: process.env.BREVO_SMTP_PASSWORD || '',
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })

        await transporter.sendMail({
          from: `MOTA-FLOW <${process.env.BREVO_SMTP_USER || 'b26c7b001@smtp-brevo.com'}>`,
          to: targetEmail,
          subject: 'Redefinição de Senha - MOTA-FLOW',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #25D366;">MOTA-FLOW</h1>
              <h2>Redefinição de Senha</h2>
              <p>Você solicitou a redefinição de senha para sua conta MOTA-FLOW.</p>
              <p>Clique no botão abaixo para redefinir sua senha:</p>
              <a href="${resetUrl}" style="display: inline-block; background: #25D366; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Redefinir Senha</a>
              <p style="color: #666; font-size: 12px; margin-top: 24px;">Este link expira em 1 hora. Se você não solicitou isso, ignore este e-mail.</p>
            </div>
          `,
        })

        console.log('[EMAIL OK] E-mail de reset enviado para', targetEmail)
      } catch (emailErr: any) {
        console.error('[EMAIL ERROR] Falha ao enviar e-mail:', emailErr?.message)
        console.error('[EMAIL ERROR] Stack:', emailErr?.stack)
      }
    })
  } catch (error: any) {
    console.error('[FORGOT PASSWORD ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao processar solicitação' })
  }
})

// Reset Password - Com token
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ message: 'Token e nova senha obrigatórios' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' })

    const user = await db.getUserByResetToken(token)
    if (!user) return res.status(400).json({ message: 'Token inválido ou expirado' })

    // Verificar se o token expirou
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
      await db.clearResetToken(user.id)
      return res.status(400).json({ message: 'Token expirado. Solicite um novo.' })
    }

    const passwordHash = await hashPassword(newPassword)
    await db.updateUserPassword(user.id, passwordHash)
    await db.clearResetToken(user.id)

    res.json({ message: 'Senha redefinida com sucesso' })
  } catch (error: any) {
    console.error('[RESET PASSWORD ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao redefinir senha' })
  }
})

app.get('/api/flows', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const flows = await db.getUserMenuFlows(user.userId)
    res.json(flows)
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao buscar fluxos' })
  }
})

app.post('/api/flows', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { name, description, flowData } = req.body
    await db.createMenuFlow(user.userId, name, description, flowData)
    res.json({ message: 'Fluxo criado' })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao criar fluxo' })
  }
})

app.get('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const flow = await db.getMenuFlow(parseInt(req.params.flowId))
    res.json(flow)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar fluxo' })
  }
})

app.put('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, flowData } = req.body
    await db.updateMenuFlow(parseInt(req.params.flowId), { name, description, flowData })
    res.json({ message: 'Fluxo atualizado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar' })
  }
})

app.delete('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await db.deleteMenuFlow(parseInt(req.params.flowId))
    res.json({ message: 'Fluxo deletado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' })
  }
})

// WHATSAPP CORE LOGIC
async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string) {
  const sessionPath = `sessions/session-${userId}`

  console.log(`[MOTA-FLOW] Iniciando conexão para usuário ${userId}, método: ${phoneNumber ? 'Pairing Code' : 'QR Code'}`)

  // Limpeza de sessão antiga sempre que iniciar nova conexão
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      console.log('[MOTA-FLOW] Sessão antiga removida')
    } catch (e) {
      console.log('[MOTA-FLOW] Erro ao remover sessão antiga:', e)
    }
  }

  // Criar diretório de sessão
  const sessionDir = path.dirname(sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  console.log('[MOTA-FLOW] Auth state carregado, registered:', state.creds.registered)

  // Se registrado e conectando, não precisa gerar QR/Pairing
  if (state.creds.registered && !phoneNumber) {
    console.log('[MOTA-FLOW] Sessão já registrada, conectando diretamente...')
  }

  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 120000,
    keepAliveIntervalMs: 15000,
    printQRInTerminal: false
  })

  sessions.set(userId, sock)
  sock.ev.on('creds.update', saveCreds)

  // Pairing Code Logic
  if (phoneNumber && !state.creds.registered) {
    console.log(`[MOTA-FLOW] Solicitando Pairing Code para ${phoneNumber}...`)
    try {
      const code = await sock.requestPairingCode(phoneNumber)
      console.log(`[MOTA-FLOW] Pairing Code gerado: ${code}`)
      await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code, qrCode: null })
    } catch (err: any) {
      console.error('[MOTA-FLOW] Erro ao solicitar Pairing Code:', err?.message)
      await db.updateWhatsappInstance(instanceId, { status: 'disconnected' })
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('[MOTA-FLOW] QR Code recebido, gerando imagem...')
      try {
        const qrBase64 = await QRCode.toDataURL(qr)
        console.log('[MOTA-FLOW] QR Code Base64 gerado com sucesso')
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrBase64, pairingCode: null })
      } catch (err: any) {
        console.error('[MOTA-FLOW] Erro ao gerar QR Base64:', err?.message, 'Usando fallback...')
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrUrl, pairingCode: null })
        console.log('[MOTA-FLOW] QR Code gerado via API (Fallback).')
      }
    }

    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] || 'desconhecido'
      console.log(`[MOTA-FLOW] Conectado! Número: ${phone}`)
      await db.updateWhatsappInstance(instanceId, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`[MOTA-FLOW] Conexão fechada: ${statusCode}`)
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        const delay = (statusCode === 515 || statusCode === 408 || statusCode === 401) ? 2000 : 5000
        if (statusCode === 401 || statusCode === 408) {
          await db.updateWhatsappStatus(instanceId, 'disconnected', null)
        }
        setTimeout(() => connectToWhatsApp(userId, instanceId), delay)
      } else {
        await db.updateWhatsappStatus(instanceId, 'disconnected', null)
        sessions.delete(userId)
      }
    }
  })

  // Mensagens
  sock.ev.on('messages.upsert', async (m: any) => {
    const msg = m.messages[0]
    if (!msg || msg.key.fromMe) return
    const flows = await db.getUserMenuFlows(userId)
    const activeFlow = flows.find((f: any) => f.isActive)
    if (activeFlow && activeFlow.flowData) {
      await processMessage(sock, msg, userId, instanceId, activeFlow.flowData)
    }
  })
}

// WhatsApp Actions
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber, usePairingCode } = req.body
    console.log(`[WHATSAPP CONNECT] userId=${user.userId}, phoneNumber=${phoneNumber}, usePairingCode=${usePairingCode}`)

    // Se já existe uma sessão ativa, logout antes
    const existingSession = sessions.get(user.userId)
    if (existingSession) {
      console.log('[WHATSAPP CONNECT] Existe sessão ativa, fazendo logout...')
      try { existingSession.logout() } catch (e) {}
      sessions.delete(user.userId)
    }

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) instance = await db.createWhatsappInstance(user.userId)

    // Limpar qrCode e pairingCode antes de iniciar nova conexão
    await db.updateWhatsappInstance(instance.id, { status: 'connecting', qrCode: null, pairingCode: null })

    connectToWhatsApp(user.userId, instance.id, usePairingCode ? phoneNumber : undefined)

    res.json({ message: 'Conexão iniciada', instanceId: instance.id })
  } catch (error: any) {
    console.error('[WHATSAPP CONNECT ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao iniciar conexão', detail: error?.message })
  }
})

// Pairing Code endpoint
app.post('/api/whatsapp/pairing-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber } = req.body
    if (!phoneNumber) return res.status(400).json({ message: 'Número obrigatório' })

    console.log(`[PAIRING CODE] Solicitando código para ${phoneNumber} (user ${user.userId})`)

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) instance = await db.createWhatsappInstance(user.userId)

    await db.updateWhatsappInstance(instance.id, { status: 'connecting' })

    // Iniciar conexão com Baileys e gerar pairing code
    const sessionPath = `sessions/session-${user.userId}`
    const sessionDir = path.dirname(sessionPath)
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

    // Limpar sessão anterior
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 120000,
      keepAliveIntervalMs: 15000,
      printQRInTerminal: false
    })

    sessions.set(user.userId, sock)
    sock.ev.on('creds.update', saveCreds)

    try {
      const code = await sock.requestPairingCode(phoneNumber)
      console.log(`[PAIRING CODE] Código gerado: ${code}`)
      await db.updateWhatsappInstance(instance.id, { status: 'connecting', pairingCode: code })

      // Continuar monitorando conexão
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') {
          const phone = sock.user?.id?.split(':')[0]
          await db.updateWhatsappInstance(instance.id, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
        }
        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
          if (statusCode !== DisconnectReason.loggedOut) {
            setTimeout(() => connectToWhatsApp(user.userId, instance.id), 5000)
          } else {
            await db.updateWhatsappStatus(instance.id, 'disconnected', null)
          }
        }
      })

      res.json({ code })
    } catch (err: any) {
      console.error('[PAIRING CODE ERROR]', err?.message)
      res.status(500).json({ message: 'Erro ao gerar código de pareamento' })
    }
  } catch (error: any) {
    console.error('[PAIRING CODE ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao gerar código' })
  }
})

app.post('/api/whatsapp/:instanceId/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { instanceId } = req.params
    const sock = sessions.get(user.userId)
    if (sock) {
      await sock.logout()
      sessions.delete(user.userId)
    }
    const sessionPath = `sessions/session-${user.userId}`
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
    await db.updateWhatsappStatus(parseInt(instanceId), 'disconnected', null)
    res.json({ message: 'Desconectado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' })
  }
})

// Funções de Processamento de Mensagem e Build Menu
async function processMessage(sock: any, msg: any, userId: number, instanceId: number, flowData: MenuFlowData) {
  const sender = msg.key?.remoteJid
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
  if (!sender || !messageText) return
  if (messageText.trim().toLowerCase() === 'ping') {
    await sock.sendMessage(sender, { text: '🏓 *Pong!*' })
    return
  }
  let state = messageStates.get(sender)
  if (!state) {
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (!rootMenu) return
    const menuMsg = buildMenuMessage(rootMenu)
    await sock.sendMessage(sender, { text: menuMsg })
    messageStates.set(sender, { flowId: 0, menuId: flowData.rootMenuId, userId, instanceId })
    return
  }
  const currentMenu = flowData.menus[state.menuId]
  const input = messageText.trim().toLowerCase()
  const matchedOption = currentMenu.options.find((opt: MenuOption) => String(opt.number) === input || opt.text.toLowerCase() === input)
  if (!matchedOption) {
    await sock.sendMessage(sender, { text: `⚠️ Opção inválida.\n\n${buildMenuMessage(currentMenu)}` })
    return
  }
  if (matchedOption.nextMenuId) {
    const nextMenu = flowData.menus[matchedOption.nextMenuId]
    await sock.sendMessage(sender, { text: buildMenuMessage(nextMenu) })
    state.menuId = matchedOption.nextMenuId
  } else {
    await sock.sendMessage(sender, { text: matchedOption.response || 'Obrigado!' })
    messageStates.delete(sender)
  }
}

function buildMenuMessage(menu: MenuNode): string {
  let msg = `*${menu.title}*\n\n${menu.message}\n\n`
  menu.options.forEach(o => { msg += `*${o.number}* - ${o.text}\n` })
  return msg.trim()
}

// Servir arquivos estáticos do Frontend (React)
// O Vite está configurado para gerar o build em dist/client
const distPath = path.resolve(__dirname, 'dist', 'client')
console.log(`📂 [SYSTEM] Tentando servir arquivos estáticos de: ${distPath}`)

// Log de depuração para ver o que existe na pasta dist
if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
  console.log('📂 [DEBUG] Conteúdo de /dist:', fs.readdirSync(path.resolve(__dirname, 'dist')))
}

if (fs.existsSync(distPath)) {
  console.log('✅ [SYSTEM] Pasta dist/client encontrada!')
  app.use(express.static(distPath))

  // Fallback para SPA (Single Page Application)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
} else {
  console.error('❌ [SYSTEM] Pasta dist/client NÃO encontrada no caminho:', distPath)

  // Tentar um fallback para a pasta dist raiz caso o build tenha ido para lá
  const fallbackPath = path.resolve(__dirname, 'dist')
  if (fs.existsSync(path.join(fallbackPath, 'index.html'))) {
    console.log('✅ [SYSTEM] Fallback: index.html encontrado na raiz da pasta dist!')
    app.use(express.static(fallbackPath))
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(fallbackPath, 'index.html'))
      }
    })
  }
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message })
})

// Bootstrap: sincronizar schema do banco de dados
async function bootstrap() {
  try {
    console.log('🔄 [MOTA-FLOW] Sincronizando schema do banco de dados...')
    await db.syncSchema()
    console.log('✅ [MOTA-FLOW] Schema sincronizado com sucesso')
  } catch (error: any) {
    console.error('❌ [MOTA-FLOW] Erro ao sincronizar schema:', error?.message)
    console.error('Stack:', error?.stack)
  }

  app.listen(PORT, () => {
    console.log(`✅ [MOTA-FLOW] Servidor rodando na porta ${PORT}`)
  })
}

bootstrap()
