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

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))

// Baileys version - PRE-LOADED on bootstrap
let baileysVersion: [number, number, number] = [2, 2413, 1] // safe default

async function preloadBaileysVersion() {
  try {
    const start = Date.now()
    const result = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ])
    baileysVersion = (result as any).version
    console.log(`✅ [MOTA-FLOW] Versão Baileys pré-carregada em ${Date.now() - start}ms: ${baileysVersion.join('.')}`)
  } catch (err) {
    console.log('⚠️ [MOTA-FLOW] Usando versão fallback Baileys:', baileysVersion.join('.'))
  }
}

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)
  if (!token) return res.status(401).json({ message: 'Token não fornecido' })
  const payload = await verifyToken(token)
  if (!payload) return res.status(401).json({ message: 'Token inválido' })
  ;(req as any).user = payload
  next()
}

// ============ AUTH ROUTES ============

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

// ============ FLOWS ROUTES ============

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

// ============ WHATSAPP CORE LOGIC ============

function cleanPhoneNumber(num: string): string {
  return num.replace(/\D/g, '')
}

async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string, isReconnect = false) {
  const sessionPath = `sessions/session-${userId}`

  if (!isReconnect) {
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true })
        console.log(`[MOTA-FLOW] Sessão antiga limpa para o usuário ${userId}`)
      } catch (e) {
        console.error(`[MOTA-FLOW] Erro ao limpar sessão ${userId}:`, e)
      }
    }
  }

  const sessionDir = path.dirname(sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const version = baileysVersion

  // CONFIGURAÇÃO UBUNTU (200% GARANTIDA)
  const browserConfig = phoneNumber 
    ? Browsers.ubuntu('Chrome') 
    : ['MotaFlow', 'Chrome', '1.0.0'] as [string, string, string]

  console.log(`[MOTA-FLOW] Iniciando socket com Opera: ${browserConfig.join(' ')}`)

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    logger: pino({ level: 'silent' }),
    browser: browserConfig,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    printQRInTerminal: false,
    maxMsgRetryCount: 5,
    retryRequestDelayMs: 2000,
  })

  sessions.set(userId, sock)
  
  const reconnectPhone = phoneNumber

  if (!isReconnect && phoneNumber) {
    const cleanNumber = cleanPhoneNumber(phoneNumber)
    console.log(`[MOTA-FLOW] Agendando Pairing Code (Opera) para: ${cleanNumber}`)
    
    // Ajustado para 7 segundos para equilibrar velocidade e estabilidade (evita rejeição do WA)
    setTimeout(async () => {
      try {
        if (sock.authState.creds.registered) return
        console.log(`[MOTA-FLOW] Solicitando Pairing Code (Ubuntu) para ${cleanNumber}...`)
        const code = await sock.requestPairingCode(cleanNumber)
        console.log(`[MOTA-FLOW] Pairing Code gerado: ${code}`)
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code, qrCode: null })
      } catch (err: any) {
        console.error('[MOTA-FLOW] Erro ao solicitar Pairing Code:', err?.message)
        // Segunda tentativa com 10s de delay
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

    if (qr) {
      const qrDataURL = await QRCode.toDataURL(qr)
      await db.updateWhatsappInstance(instanceId, { qrCode: qrDataURL, status: 'connecting', pairingCode: null })
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log(`[MOTA-FLOW] Conexão fechada. Reconnect: ${shouldReconnect}`)
      
      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(userId, instanceId, reconnectPhone, true), 3000)
      } else {
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected', qrCode: null, pairingCode: null })
        sessions.delete(userId)
      }
    }

    if (connection === 'open') {
      console.log(`[MOTA-FLOW] WhatsApp conectado para o usuário ${userId}`)
      const phone = sock.user?.id.split(':')[0]
      await db.updateWhatsappInstance(instanceId, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
      await sock.waitForSocketOpen()
      await sock.sendPresenceUpdate('available')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      await processMessage(sock, msg, userId, instanceId)
    }
  })
}

async function processMessage(sock: any, msg: WAMessage, userId: number, instanceId: number) {
  const from = msg.key.remoteJid!
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
  
  if (!text) return

  const state = messageStates.get(from)
  const now = Date.now()
  const COOLDOWN_24H = 24 * 60 * 60 * 1000

  // Reinício manual
  const isResetKeyword = ['menu', 'voltar', 'inicio', 'início'].includes(text.toLowerCase().trim())

  if (state?.status === 'finished' && !isResetKeyword) {
    if (state.lastInteraction && (now - state.lastInteraction < COOLDOWN_24H)) {
      console.log(`[MOTA-FLOW] Ignorando mensagem de ${from} (Cooldown ativo)`)
      return
    }
  }

  const flows = await db.getUserMenuFlows(userId)
  const activeFlow = flows.find(f => f.isActive)
  if (!activeFlow) return

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

// ============ API ROUTES FOR WHATSAPP ============

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
    res.json({ message: 'Iniciando conexão...' })
  } else {
    res.status(500).json({ message: 'Erro ao criar instância' })
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
        sock.ev.removeAllListeners('creds.update')
        sock.ev.removeAllListeners('messages.upsert')
        try { sock.ws.close() } catch (e) {}
        sessions.delete(user.userId)
      }
      const sessionPath = `sessions/session-${user.userId}`
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
      }
      await db.updateWhatsappInstance(instance.id, { 
        status: 'disconnected', 
        qrCode: null, 
        pairingCode: null,
        phoneNumber: null 
      })
      res.json({ message: 'Instância resetada com sucesso' })
    } else {
      res.status(404).json({ message: 'Instância não encontrada' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao resetar instância' })
  }
})

app.post('/api/whatsapp/disconnect', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  try {
    const instance = await db.getWhatsappInstance(user.userId)
    const sock = sessions.get(user.userId)
    
    if (sock) {
      // Remover ouvintes para evitar loops de reconexão durante o logout proposital
      sock.ev.removeAllListeners('connection.update')
      await sock.logout()
      try { sock.ws.close() } catch (e) {}
      sessions.delete(user.userId)
    }

    if (instance) {
      await db.updateWhatsappInstance(instance.id, { 
        status: 'disconnected', 
        qrCode: null, 
        pairingCode: null 
      })
    }
    
    res.json({ message: 'Desconectado com sucesso' })
  } catch (error) {
    console.error('[DISCONNECT ERROR]', error)
    res.status(500).json({ message: 'Erro ao desconectar' })
  }
})

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, 'client')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'))
})

app.listen(PORT, () => {
  preloadBaileysVersion().then(() => {
    console.log(`🚀 [MOTA-FLOW] Servidor rodando na porta ${PORT}`)
  })
})
