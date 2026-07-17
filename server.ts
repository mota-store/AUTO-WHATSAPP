import 'dotenv/config'
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
  WAMessage
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { Boom } from '@hapi/boom'

const execAsync = promisify(exec)
const sessions = new Map<number, any>()
const pairingCodeRequests = new Map<number, { number: string, attempts: number, timer: any }>()
const messageStates = new Map<string, { flowId: number, menuId: string, userId: number, instanceId: number }>()
const app = express()
const PORT = process.env.PORT || 3000

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
    await db.createUser(email, passwordHash, name)

    const newUser = await db.getUserByEmail(email)
    if (!newUser) throw new Error('Erro ao recuperar usuário após criação')

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
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao criar usuário' })
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
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao fazer login' })
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
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao carregar dashboard' })
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

    await db.createMenuFlow(user.userId, name, description, flowData)

    res.json({ message: 'Fluxo criado com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao criar fluxo' })
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
      flowData,
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
  if (matchedOption.response) {
    // Enviar resposta personalizada e resetar estado
    await sock.sendMessage(sender, { text: matchedOption.response })
    messageStates.delete(chatId)
  } else if (matchedOption.nextMenuId) {
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

// Helper para criar sessão WhatsApp
// IMPORTANTE: NÃO reconecta automaticamente. Só conecta quando o usuário solicita.
async function createWhatsAppSession(userId: number, phoneNumber: string, instanceId: number) {
  const sessionPath = `sessions/session-${userId}`

  // Limpeza da sessão anterior
  if (fs.existsSync(sessionPath)) {
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch (e) {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  // Conexão simplificada igual ao bot que funciona
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '110.0.5481.178'],
  })

  sessions.set(userId, sock)

  sock.ev.on('creds.update', saveCreds)

  // PROCESSAMENTO DE MENSAGENS REAIS
  sock.ev.on('messages.upsert', async (m: any) => {
    try {
      const msg = m.messages[0]
      if (!msg || msg.key.fromMe) return

      // Buscar fluxos ativos do usuário
      const flows = await db.getUserMenuFlows(userId)
      const activeFlow = flows.find((f: any) => f.isActive)
      if (!activeFlow) return

      const flowData: MenuFlowData = activeFlow.flowData
      if (!flowData || !flowData.menus || !flowData.rootMenuId) return

      console.log(`📨 [MOTA-FLOW] Processando mensagem para flow: ${activeFlow.name}`)
      await processMessage(sock, msg, userId, instanceId, flowData)
    } catch (err) {
      console.error('Erro ao processar mensagem:', err)
    }
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      // Salvar QR Code no banco - permanece FIXO até ser escaneado ou expirar
      await db.updateWhatsappInstance(instanceId, {
        status: 'connecting',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`,
      })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`📡 [MOTA-FLOW] Conexão fechada. Status: ${statusCode}`)

      // ATUALIZAR STATUS NO BANCO MAS NÃO RECONNECTAR AUTOMATICAMENTE
      // O usuário precisa clicar em "Reconectar" no Dashboard
      await db.updateWhatsappInstance(instanceId, { status: 'disconnected', qrCode: null })

      // Limpar sessão do mapa
      sessions.delete(userId)
    } else if (connection === 'open') {
      console.log('✅ [MOTA-FLOW] WhatsApp conectado com sucesso!')
      await db.updateWhatsappInstance(instanceId, {
        status: 'connected',
        qrCode: null,
        phoneNumber: sock.user?.id.split(':')[0]
      })
      pairingCodeRequests.delete(userId)
    }
  })

  return sock
}

// WhatsApp Routes
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber, usePairingCode } = req.body

    // Verificar se já existe uma sessão ativa
    const existingSession = sessions.get(user.userId)
    if (existingSession) {
      try {
        existingSession.logout()
      } catch (e) {}
      sessions.delete(user.userId)
    }

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) {
      await db.createWhatsappInstance(user.userId)
      instance = await db.getWhatsappInstance(user.userId)
    }

    const sessionId = user.userId

    // Limpar status anterior
    await db.updateWhatsappInstance(instance.id, {
      status: 'connecting',
      qrCode: null,
      phoneNumber: null,
    })

    if (usePairingCode && phoneNumber) {
      const sock = await createWhatsAppSession(sessionId, phoneNumber, instance.id)

      const cleanNumber = phoneNumber.replace(/\D/g, '')
      pairingCodeRequests.set(sessionId, { number: cleanNumber, attempts: 1, timer: null })

      // Aguardar inicialização completa do socket
      setTimeout(async () => {
        try {
          console.log(`📲 [MOTA-FLOW] Solicitando Pairing Code: ${cleanNumber}`)
          const code = await sock.requestPairingCode(cleanNumber)
          res.json({ pairingCode: code })
        } catch (err) {
          console.error('Erro no pareamento:', err)
          res.status(500).json({ message: 'Erro ao gerar código. Tente novamente em 10 segundos.' })
        }
      }, 5000)
      return
    }

    // Conexão via QR Code
    const sock = await createWhatsAppSession(sessionId, '', instance.id)
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

    const pairingReq = pairingCodeRequests.get(user.userId)
    if (pairingReq && pairingReq.timer) {
      clearTimeout(pairingReq.timer)
      pairingCodeRequests.delete(user.userId)
    }

    // Limpar estados de mensagens ao desconectar
    messageStates.clear()

    const sessionPath = `sessions/session-${user.userId}`
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true })
      } catch (e) { }
    }

    await db.updateWhatsappInstance(parseInt(instanceId), {
      status: 'disconnected',
      sessionData: null,
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
app.get('*', (req: Request, res: Response) => {
  res.sendFile('dist/client/index.html', { root: '.' })
})

app.listen(PORT, async () => {
  console.log(`🚀 Servidor MOTA-FLOW rodando em http://localhost:${PORT}`)

  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    try {
      console.log('🔄 Sincronizando banco de dados...')
      const databaseUrl = process.env.DATABASE_URL || ''
      const sslUrl = databaseUrl.includes('?')
        ? `${databaseUrl}&ssl={"rejectUnauthorized":true}`
        : `${databaseUrl}?ssl={"rejectUnauthorized":true}`

      const { stdout } = await execAsync(`DATABASE_URL='${sslUrl}' npx drizzle-kit push`)
      console.log('✅ Banco de dados sincronizado com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao sincronizar banco de dados:', error)
    }
  }
})
