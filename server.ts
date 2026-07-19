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
import QRCode from 'qrcode'

const execAsync = promisify(exec)
const sessions = new Map<number, any>()
const messageStates = new Map<string, { 
  flowId: number, 
  menuId: string, 
  userId: number, 
  instanceId: number, 
  status?: 'active' | 'finished',
  lastInteraction?: number 
}>()
const app = express()
const PORT = process.env.PORT || 8080

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 [MOTA-FLOW] Iniciando servidor...')

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))

let baileysVersion: [number, number, number] = [2, 2413, 1]

async function preloadBaileysVersion() {
  try {
    const result = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ])
    baileysVersion = (result as any).version
    console.log(`✅ [MOTA-FLOW] Versão Baileys: ${baileysVersion.join('.')}`)
  } catch (err) {
    console.log('⚠️ [MOTA-FLOW] Usando versão fallback:', baileysVersion.join('.'))
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)
  if (!token) return res.status(401).json({ message: 'Token não fornecido' })
  const payload = await verifyToken(token)
  if (!payload) return res.status(401).json({ message: 'Token inválido' })
  ;(req as any).user = payload
  next()
}

// AUTH ROUTES
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) return res.status(400).json({ message: 'Campos obrigatórios' })
    const existingUser = await db.getUserByEmail(email)
    if (existingUser) return res.status(400).json({ message: 'Email já cadastrado' })
    const passwordHash = await hashPassword(password)
    await db.createUser(email, passwordHash, name)
    const newUser = await db.getUserByEmail(email)
    if (!newUser) throw new Error('Erro ao criar usuário')
    const token = await createToken(newUser.id, newUser.email)
    res.json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao criar usuário' })
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
    res.status(500).json({ message: 'Erro ao fazer login' })
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

// FLOWS ROUTES
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

app.post('/api/flows/:flowId/activate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const flowId = parseInt(req.params.flowId)
    await db.activateFlow(user.userId, flowId)
    res.json({ message: 'Fluxo ativado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao ativar fluxo' })
  }
})

// WHATSAPP CORE
function cleanPhoneNumber(num: string): string {
  return num.replace(/\D/g, '')
}

async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string, isReconnect = false) {
  const sessionPath = `sessions/session-${userId}`

  if (!isReconnect) {
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true })
      } catch (e) {}
    }
  }

  const sessionDir = path.dirname(sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  
  // CONFIGURAÇÃO UBUNTU (200% GARANTIDA PELO USUÁRIO)
  const browserConfig = phoneNumber 
    ? Browsers.ubuntu('Chrome') 
    : ['MotaFlow', 'Chrome', '1.0.0'] as [string, string, string]

  const sock = makeWASocket({
    version: baileysVersion,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    logger: pino({ level: 'silent' }),
    browser: browserConfig,
    connectTimeoutMs: 60000,
    printQRInTerminal: false,
  })

  sessions.set(userId, sock)
  const reconnectPhone = phoneNumber

  if (!isReconnect && phoneNumber) {
    const cleanNumber = cleanPhoneNumber(phoneNumber)
    setTimeout(async () => {
      try {
        if (sock.authState.creds.registered) return
        const code = await sock.requestPairingCode(cleanNumber)
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code, qrCode: null })
      } catch (err: any) {
        setTimeout(async () => {
          try {
            if (sock.ws.isOpen) {
              const code2 = await sock.requestPairingCode(cleanNumber)
              await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code2, qrCode: null })
            }
          } catch (e) {}
        }, 10000)
      }
    }, 7000)
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    console.log(`[MOTA-FLOW] Update de conexão: ${connection || 'status'}`)

    if (qr) {
      const qrDataURL = await QRCode.toDataURL(qr)
      await db.updateWhatsappInstance(instanceId, { qrCode: qrDataURL, status: 'connecting', pairingCode: null })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`[MOTA-FLOW] Conexão fechada. Status: ${statusCode}`)
      
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log('[MOTA-FLOW] Tentando reconectar automaticamente...')
        setTimeout(() => connectToWhatsApp(userId, instanceId, reconnectPhone, true), 3000)
      } else {
        console.log('[MOTA-FLOW] Logout detectado ou sessão encerrada.')
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected', qrCode: null, pairingCode: null, phoneNumber: null })
        sessions.delete(userId)
        // Limpar pasta de sessão se for logout real
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
      }
    }

    if (connection === 'open') {
      console.log('[MOTA-FLOW] Conexão aberta com sucesso!')
      const phone = sock.user?.id.split(':')[0]
      await db.updateWhatsappInstance(instanceId, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      console.log(`[MOTA-FLOW] Mensagem recebida de ${msg.key.remoteJid}: ${msg.message?.conversation || 'mídia/outros'}`)
      await processMessage(sock, msg, userId, instanceId)
    }
  })
}

async function processMessage(sock: any, msg: WAMessage, userId: number, instanceId: number) {
  const from = msg.key.remoteJid!
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim()
  if (!text) return

  console.log(`[MOTA-FLOW] Processando texto: "${text}" de ${from}`)

  const state = messageStates.get(from)
  const now = Date.now()
  const COOLDOWN_24H = 24 * 60 * 60 * 1000
  const isResetKeyword = ['menu', 'voltar', 'inicio', 'início'].includes(text.toLowerCase())

  if (state?.status === 'finished' && !isResetKeyword) {
    if (state.lastInteraction && (now - state.lastInteraction < COOLDOWN_24H)) {
      console.log(`[MOTA-FLOW] Usuário ${from} em cooldown. Ignorando.`)
      return
    }
  }

  const flows = await db.getUserMenuFlows(userId)
  const activeFlow = flows.find(f => f.isActive)
  
  if (!activeFlow) {
    console.log(`[MOTA-FLOW] Nenhum fluxo ativo para o usuário ${userId}`)
    return
  }

  const flowData = activeFlow.flowData as MenuFlowData
  
  if (!state || isResetKeyword) {
    const rootMenu = flowData.nodes.find(n => n.id === flowData.rootNodeId)
    if (rootMenu) {
      await sendMenu(sock, from, rootMenu)
      messageStates.set(from, { 
        flowId: activeFlow.id, 
        menuId: rootMenu.id, 
        userId, 
        instanceId,
        status: 'active',
        lastInteraction: now
      })
    }
    return
  }

  const currentMenu = flowData.nodes.find(n => n.id === state.menuId)
  if (!currentMenu) return

  const option = currentMenu.options.find(o => o.key === text.trim())
  if (option) {
    const nextMenu = flowData.nodes.find(n => n.id === option.nextNodeId)
    if (nextMenu) {
      await sendMenu(sock, from, nextMenu)
      const isFinal = nextMenu.options.length === 0
      messageStates.set(from, { 
        ...state, 
        menuId: nextMenu.id, 
        status: isFinal ? 'finished' : 'active',
        lastInteraction: now
      })
    }
  } else {
    await sendMenu(sock, from, currentMenu)
  }
}

async function sendMenu(sock: any, to: string, menu: MenuNode) {
  let text = `${menu.message}\n\n`
  menu.options.forEach(opt => {
    text += `*${opt.key}* - ${opt.value}\n`
  })
  await sock.sendMessage(to, { text: text.trim() })
}

// WHATSAPP API
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  const { phoneNumber } = req.body
  let instance = await db.getWhatsappInstance(user.userId)
  if (!instance) {
    await db.createWhatsappInstance(user.userId)
    instance = await db.getWhatsappInstance(user.userId)
  }
  if (instance) {
    await db.updateWhatsappInstance(instance.id, { qrCode: null, pairingCode: null, status: 'connecting' })
    connectToWhatsApp(user.userId, instance.id, phoneNumber)
    res.json({ message: 'Iniciando...' })
  } else {
    res.status(500).json({ message: 'Erro' })
  }
})

app.post('/api/whatsapp/reset', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  try {
    const instance = await db.getWhatsappInstance(user.userId)
    if (instance) {
      const sock = sessions.get(user.userId)
      if (sock) {
        sock.ev.removeAllListeners('connection.update')
        try { sock.ws.close() } catch (e) {}
        sessions.delete(user.userId)
      }
      const sessionPath = `sessions/session-${user.userId}`
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
      await db.updateWhatsappInstance(instance.id, { status: 'disconnected', qrCode: null, pairingCode: null, phoneNumber: null })
      res.json({ message: 'Resetado' })
    } else {
      res.status(404).json({ message: 'Não encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro' })
  }
})

app.post('/api/whatsapp/disconnect', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  try {
    const instance = await db.getWhatsappInstance(user.userId)
    const sock = sessions.get(user.userId)
    if (sock) {
      sock.ev.removeAllListeners('connection.update')
      await sock.logout()
      try { sock.ws.close() } catch (e) {}
      sessions.delete(user.userId)
    }
    if (instance) await db.updateWhatsappInstance(instance.id, { status: 'disconnected', qrCode: null, pairingCode: null })
    res.json({ message: 'Desconectado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro' })
  }
})

app.use(express.static(path.join(__dirname, 'client')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client', 'index.html')))

app.listen(PORT, () => {
  preloadBaileysVersion().then(() => {
    console.log(`🚀 [MOTA-FLOW] Porta ${PORT}`)
  })
})
