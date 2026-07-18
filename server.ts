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

const execAsync = promisify(exec)
const sessions = new Map<number, any>()
const pairingCodeRequests = new Map<number, { number: string, attempts: number, timer: any }>()
const lastConnectionAttempt = new Map<number, number>()
const messageStates = new Map<string, { flowId: number, menuId: string, userId: number, instanceId: number }>()
const app = express()
const PORT = process.env.PORT || 3000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 [MOTA-FLOW] Iniciando servidor...');

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)
  if (!token) return res.status(401).json({ message: 'Token não fornecido' })
  const payload = await verifyToken(token)
  if (!payload) return res.status(401).json({ message: 'Token inválido' })
  ;(req as any).user = payload
  next()
}

// Routes... (Mantendo as rotas de Auth, Dashboard, Flows que já funcionam)
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
    res.status(500).json({ message: error.message })
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
    res.status(500).json({ message: error.message })
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

// WHATSAPP CORE LOGIC - MELHORADA PARA RAILWAY
async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string) {
  const now = Date.now()
  const lastAttempt = lastConnectionAttempt.get(userId) || 0
  
  // Trava de segurança reduzida para 30s para ser mais responsivo
  if (now - lastAttempt < 30000 && !phoneNumber) {
    console.log(`⏳ [MOTA-FLOW] Aguardando 30s para usuário ${userId}`)
    return
  }
  
  lastConnectionAttempt.set(userId, now)
  const sessionPath = `sessions/session-${userId}`

  // Limpeza de sessão antiga se estiver tentando reconectar do zero
  if (phoneNumber && fs.existsSync(sessionPath)) {
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch (e) {}
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

  sessions.set(userId, sock)
  sock.ev.on('creds.update', saveCreds)

  // Pairing Code Logic
  if (phoneNumber && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        console.log(`🔑 [MOTA-FLOW] Pairing Code para ${phoneNumber}: ${code}`)
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code })
      } catch (err) {
        console.error('Erro ao solicitar Pairing Code:', err)
      }
    }, 5000)
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        const qrBase64 = await QRCode.toDataURL(qr)
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrBase64 })
        console.log('📱 [MOTA-FLOW] QR Code gerado em Base64.')
      } catch (err) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrUrl })
        console.log('📱 [MOTA-FLOW] QR Code gerado via API (Fallback).')
      }
    }

    if (connection === 'open') {
      const phone = sock.user?.id.split(':')[0]
      await db.updateWhatsappInstance(instanceId, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
      console.log('✅ [MOTA-FLOW] Conectado!')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`📡 [MOTA-FLOW] Conexão fechada: ${statusCode}`)
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
    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) instance = await db.createWhatsappInstance(user.userId)
    
    await db.updateWhatsappStatus(instance.id, 'connecting', null)
    connectToWhatsApp(user.userId, instance.id, usePairingCode ? phoneNumber : undefined)
    
    res.json({ message: 'Iniciando conexão...' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao iniciar conexão' })
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

// Funções de Processamento de Mensagem e Build Menu (Mantidas como antes)
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

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`)
})
