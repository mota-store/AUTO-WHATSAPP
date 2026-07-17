import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createToken, verifyPassword, hashPassword, verifyToken, extractToken } from './src/server/utils'
import * as db from './src/server/db'
import { AuthPayload, CreateFlowRequest, UpdateFlowRequest } from './src/server/types'
import { MenuFlowData, MenuNode, MenuOption } from './drizzle/schema'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
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

console.log('🚀 [MOTA-FLOW] Iniciando servidor...');
console.log('📊 [ENV] DATABASE_URL detectada:', !!process.env.DATABASE_URL);
console.log('📊 [ENV] JWT_SECRET detectado:', !!process.env.JWT_SECRET);
console.log('📊 [ENV] NODE_ENV:', process.env.NODE_ENV);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

// Auth middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization)

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return res.status(401).json({ message: 'Token inválido' })
  }

  ;(req as any).user = payload
  next()
}

// Auth Routes
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, senha e nome são obrigatórios' })
    }

    const existingUser = await db.getUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' })
    }

    const passwordHash = await hashPassword(password)
    const result = await db.createUser(email, passwordHash, name)
    
    // Buscar o usuário recém-criado
    const newUser = await db.getUserByEmail(email)
    if (!newUser) {
      console.error('[REGISTER ERROR] Falha ao recuperar usuário após insert:', result)
      throw new Error('Erro ao recuperar usuário após criação')
    }

    const token = await createToken(newUser.id, newUser.email)

    res.json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    })
    } catch (error: any) {
    console.error('[REGISTER ERROR]', error);
    console.error(error?.stack);
    res.status(500).json({ message: error.message || 'Erro ao criar usuário' })
  }
})

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' })
    }

    const user = await db.getUserByEmail(email)
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const token = await createToken(user.id, user.email)

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
    } catch (error: any) {
    console.error('[LOGIN ERROR]', error);
    console.error(error?.stack);
    res.status(500).json({ message: error.message || 'Erro ao fazer login' })
  }
})

// Dashboard Route
app.get('/api/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const instance = await db.getWhatsappInstance(user.userId)
    const flows = await db.getUserMenuFlows(user.userId)

    res.json({
      instance,
      flows,
    })
    } catch (error: any) {
    console.error('[DASHBOARD ERROR]', error);
    console.error(error?.stack);
    res.status(500).json({ message: error.message || 'Erro ao carregar dashboard' })
  }
})

// Menu Flows Routes
app.post('/api/flows', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { name, description, flowData } = req.body as CreateFlowRequest

    if (!name || !flowData) {
      return res.status(400).json({ message: 'Nome e flowData são obrigatórios' })
    }

    // Garantir que flowData seja tratado como string se a coluna for text
    await db.createMenuFlow(user.userId, name, description, typeof flowData === 'string' ? JSON.parse(flowData) : flowData)

    res.json({ message: 'Fluxo criado com sucesso' })
    } catch (error: any) {
    console.error('[CREATE FLOW ERROR]', error);
    console.error(error?.stack);
    res.status(500).json({ message: error.message || 'Erro ao criar fluxo' })
  }
})

app.get('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params
    const flow = await db.getMenuFlow(parseInt(flowId))

    if (!flow) {
      return res.status(404).json({ message: 'Fluxo não encontrado' })
    }

    res.json(flow)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao buscar fluxo' })
  }
})

app.put('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params
    const { name, description, flowData } = req.body as UpdateFlowRequest

    await db.updateMenuFlow(parseInt(flowId), {
      name,
      description,
      flowData: typeof flowData === 'string' ? JSON.parse(flowData) : flowData,
    })

    res.json({ message: 'Fluxo atualizado com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao atualizar fluxo' })
  }
})

app.delete('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params

    await db.deleteMenuFlow(parseInt(flowId))

    res.json({ message: 'Fluxo deletado com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao deletar fluxo' })
  }
})

// Processar mensagens recebidas do WhatsApp
async function processMessage(sock: any, msg: any, userId: number, instanceId: number, flowData: MenuFlowData) {
  const sender = msg.key?.remoteJid
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
  const chatId = sender

  if (!sender || !messageText) return

  console.log(`💬 [MOTA-FLOW] Mensagem de ${sender}: ${messageText}`)

  // Comando especial: /ping
  if (messageText.trim().toLowerCase() === 'ping') {
    const startTime = Date.now()
    await sock.sendMessage(sender, { text: 'Calculando...' })
    const endTime = Date.now()
    const ms = endTime - startTime
    await sock.sendMessage(sender, { text: `🏓 *Pong!* — Resposta em *${ms}ms*` })
    return
  }

  // Determinar o estado atual do chat
  let state = messageStates.get(chatId)

  // Se não houver estado, verificar se o usuário está iniciando o fluxo
  if (!state) {
    // Buscar o menu raiz
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (!rootMenu) return

    // Enviar a mensagem inicial do fluxo
    const menuMessage = buildMenuMessage(rootMenu)
    await sock.sendMessage(sender, { text: menuMessage })

    // Salvar estado inicial
    state = { flowId: 0, menuId: flowData.rootMenuId, userId, instanceId }
    messageStates.set(chatId, state)

    // Log da interação
    await db.logMessage(userId, instanceId, sender, messageText, menuMessage, 0)
    return
  }

  // Processar a resposta do usuário
  const currentMenu = flowData.menus[state.menuId]
  if (!currentMenu) {
    messageStates.delete(chatId)
    return
  }

  const input = messageText.trim().toLowerCase()

  // Buscar opção correspondente ao input
  const matchedOption = currentMenu.options.find((opt: MenuOption) => {
    const optNum = String(opt.number).trim()
    const optText = opt.text?.toLowerCase().trim() || ''
    return input === optNum || optText === input || (optText && input.startsWith(optText))
  })

  if (!matchedOption) {
    // Opção inválida - reenviar o menu
    const errorMsg = `⚠️ Opção inválida. Por favor, digite o número ou o nome da opção:\n\n${buildMenuMessage(currentMenu)}`
    await sock.sendMessage(sender, { text: errorMsg })
    return
  }

  // Opção válida encontrada
  if (matchedOption.nextMenuId) {
    // Navegar para próximo menu
    const nextMenu = flowData.menus[matchedOption.nextMenuId]
    if (nextMenu) {
      const nextMessage = buildMenuMessage(nextMenu)
      await sock.sendMessage(sender, { text: nextMessage })
      state.menuId = matchedOption.nextMenuId
      messageStates.set(chatId, state)
    } else {
      await sock.sendMessage(sender, { text: `⚠️ Erro: submenu não encontrado. Tente novamente.\n\n${buildMenuMessage(currentMenu)}` })
    }
  } else if (matchedOption.response) {
    // Enviar resposta personalizada e resetar estado
    await sock.sendMessage(sender, { text: matchedOption.response })
    messageStates.delete(chatId)
  } else {
    // Sem resposta e sem próximo menu - finalizar
    await sock.sendMessage(sender, { text: 'Obrigado por entrar em contato!' })
    messageStates.delete(chatId)
  }

  // Log da interação
  await db.logMessage(userId, instanceId, sender, messageText, matchedOption.response || currentMenu.options.find((o: MenuOption) => o.id === matchedOption.id)?.text || '', 0)
}

// Construir mensagem de menu formatada
function buildMenuMessage(menu: MenuNode): string {
  let message = `📌 *${menu.title}*\n\n${menu.message || 'Escolha uma opção:'}\n\n`

  menu.options.forEach((opt: MenuOption) => {
    if (opt.nextMenuId || opt.response) {
      message += `*${opt.number} - ${opt.text}*\n`
    }
  })

  return message.trim()
}

// Helper para limpar sessão completamente
function cleanSession(userId: number) {
  const sessionPath = `sessions/session-${userId}`
  if (fs.existsSync(sessionPath)) {
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch (e) {}
  }
  sessions.delete(userId)
  pairingCodeRequests.delete(userId)
}

// Helper para criar sessão WhatsApp (QR ou Pairing)
async function createWASession(userId: number, instanceId: number, phoneNumber?: string) {
  const now = Date.now()
  const lastAttempt = lastConnectionAttempt.get(userId) || 0
  
  // Trava de segurança para evitar loops (exceto se for reconexão interna do Baileys)
  if (now - lastAttempt < 60000 && !phoneNumber) {
    console.log(`⏳ [MOTA-FLOW] Aguardando trava de 1 minuto para usuário ${userId}`)
    return sessions.get(userId)
  }
  
  lastConnectionAttempt.set(userId, now)
  const sessionPath = `sessions/session-${userId}`

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
    syncFullHistory: false,
    connectTimeoutMs: 120000, // Aumentado para 2 minutos
    keepAliveIntervalMs: 15000,
    maxMsgRetryCount: 5,
    retryRequestDelayMs: 5000,
  })

  sessions.set(userId, sock)
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async (m: any) => {
    try {
      const msg = m.messages[0]
      if (!msg || msg.key.fromMe) return

      const flows = await db.getUserMenuFlows(userId)
      const activeFlow = flows.find((f: any) => f.isActive)
      if (!activeFlow) return

      const flowData: MenuFlowData = activeFlow.flowData
      if (!flowData || !flowData.menus || !flowData.rootMenuId) return

      await processMessage(sock, msg, userId, instanceId, flowData)
    } catch (err) {
      console.error('Erro ao processar mensagem:', err)
    }
  })

  sock.ev.on('connection.update', async (update: ConnectionState) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      await db.updateWhatsappInstance(instanceId, {
        status: 'connecting',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`,
      })
      console.log('📱 [MOTA-FLOW] QR Code gerado.')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`📡 [MOTA-FLOW] Conexão fechada. Status: ${statusCode}`)

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      
      if (shouldReconnect) {
        // TRATAMENTO ESPECIAL PARA STATUS 515 (Restart Required)
        if (statusCode === 515 || statusCode === 408) {
          console.log('🔄 [MOTA-FLOW] Status crítico detectado (515/408). Reiniciando socket imediatamente...')
          setTimeout(() => createWASession(userId, instanceId, phoneNumber), 2000)
        } else {
          console.log('🔄 [MOTA-FLOW] Tentando reconectar em 10s...')
          setTimeout(() => createWASession(userId, instanceId, phoneNumber), 10000)
        }
      } else {
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected', qrCode: null })
        sessions.delete(userId)
        cleanSession(userId)
      }
    } else if (connection === 'open') {
      console.log('✅ [MOTA-FLOW] WhatsApp conectado com sucesso!')
      await db.updateWhatsappInstance(instanceId, {
        status: 'connected',
        qrCode: null,
        phoneNumber: sock.user?.id.split(':')[0]
      })
      pairingCodeRequests.delete(userId)
      lastConnectionAttempt.delete(userId)
    }
  })

  return sock
}

// WhatsApp Routes
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber, usePairingCode } = req.body

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) {
      await db.createWhatsappInstance(user.userId)
      instance = await db.getWhatsappInstance(user.userId)
    }

    if (usePairingCode && phoneNumber) {
      const cleanNumber = phoneNumber.replace(/\D/g, '')
      console.log(`📲 [MOTA-FLOW] Iniciando Pairing para: ${cleanNumber}`)
      
      const sock = await createWASession(user.userId, instance.id, cleanNumber)
      
      // Tentar obter o código de pareamento com retry e timeout estendido
      let attempts = 0
      const getCode = async () => {
        try {
          // Aguardar o socket estar minimamente pronto
          await new Promise(resolve => setTimeout(resolve, 3000))
          const code = await sock.requestPairingCode(cleanNumber)
          res.json({ pairingCode: code })
        } catch (err: any) {
          attempts++
          console.error(`❌ Erro ao pedir Pairing Code (tentativa ${attempts}):`, err.message)
          if (attempts < 3) {
            setTimeout(getCode, 5000)
          } else {
            res.status(500).json({ message: 'WhatsApp demorou a responder. Tente novamente em 1 minuto.' })
          }
        }
      }
      
      getCode()
      return
    }

    // Conexão via QR Code
    await createWASession(user.userId, instance.id)
    res.json({ message: 'Conexão iniciada. QR Code será gerado em instantes.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao conectar WhatsApp' })
  }
})

app.post('/api/whatsapp/:instanceId/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const user = (req as any).user as AuthPayload

    const sock = sessions.get(user.userId)
    if (sock) {
      try { sock.logout() } catch (e) {}
      sessions.delete(user.userId)
    }

    cleanSession(user.userId)
    await db.updateWhatsappInstance(parseInt(instanceId), {
      status: 'disconnected',
      qrCode: null,
      phoneNumber: null,
    })

    res.json({ message: 'WhatsApp desconectado com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao desconectar WhatsApp' })
  }
})

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Serve frontend
app.use(express.static('dist/client'))

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ ERRO GLOBAL CAPTURADO:", err);
  res.status(500).json({ message: err.message || 'Erro interno no servidor' });
});

app.get('*', (req: Request, res: Response) => {
  res.sendFile('dist/client/index.html', { root: '.' })
})

app.listen(PORT, async () => {
  console.log(`🚀 Servidor MOTA-FLOW rodando em http://localhost:${PORT}`)
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    try {
      console.log('🔄 Sincronizando banco de dados...');
      await execAsync('npx drizzle-kit push');
      console.log('✅ Banco de dados sincronizado!');
    } catch (error: any) {
      console.error('⚠️ Aviso: Falha ao sincronizar banco:', error.message);
    }
  }
})
