import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createToken, verifyPassword, hashPassword, verifyToken, extractToken } from './src/server/utils'
import * as db from './src/server/db'
import { eq } from 'drizzle-orm'
import { AuthPayload, CreateFlowRequest, UpdateFlowRequest } from './src/server/types'
import { MenuFlowData, MenuNode, MenuOption } from './drizzle/schema'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
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
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const sessions = new Map<number, any>()
const connectionLocks = new Map<number, boolean>()
const messageStates = new Map<string, { 
  flowId: number, 
  menuId: string, 
  userId: number, 
  instanceId: number, 
  status?: 'active' | 'finished',
  lastInteraction?: number 
}>()
const reconnectAttempts = new Map<number, { count: number, lastAttempt: number }>()
const app = express()
const PORT = process.env.PORT || 8080

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🚀 [MOTA-FLOW] Iniciando servidor...')

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))

let baileysVersion: [number, number, number] = [2, 3000, 1015901307] 

async function preloadBaileysVersion() {
  try {
    console.log('[MOTA-FLOW] Buscando versão atualizada do Baileys...')
    const { version, isLatest } = await fetchLatestBaileysVersion()
    baileysVersion = version
    console.log(`✅ [MOTA-FLOW] Versão Baileys: ${baileysVersion.join('.')} (Latest: ${isLatest})`)
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
    res.json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name, avatar: newUser.avatar } })
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
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } })
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

app.put('/api/auth/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as AuthPayload
    const { name } = req.body
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' })
    
    const database = await db.getDb()
    await database.update(db.schema.users).set({ name }).where(eq(db.schema.users.id, userPayload.userId))
    
    res.json({ message: 'Perfil atualizado' })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao atualizar perfil' })
  }
})

app.put('/api/auth/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user as AuthPayload
    const { avatar } = req.body
    
    if (!avatar) {
      return res.status(400).json({ message: 'Imagem não fornecida' })
    }

    // Verificar se é uma base64 válida e o tamanho aproximado
    if (avatar.length > 10 * 1024 * 1024) { // Limite de 10MB para a string base64
      return res.status(400).json({ message: 'Imagem muito grande. Limite de 5MB.' })
    }

    await db.updateUserAvatar(userPayload.userId, avatar)
    res.json({ message: 'Avatar atualizado com sucesso' })
  } catch (error: any) {
    console.error('[AVATAR ERROR]', error)
    res.status(500).json({ message: error.message || 'Erro ao processar imagem de perfil' })
  }
})

app.get('/api/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    // Garantir que buscamos os dados mais frescos do banco
    const instance = await db.getWhatsappInstance(user.userId)
    const flows = await db.getUserMenuFlows(user.userId)
    
    // Desativar cache para este endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
    
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

app.get('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const flowId = parseInt(req.params.flowId)
    const flow = await db.getMenuFlow(flowId)
    if (!flow) return res.status(404).json({ message: 'Fluxo não encontrado' })
    
    // Garantir que flowData seja um objeto
    if (typeof flow.flowData === 'string') {
      flow.flowData = JSON.parse(flow.flowData)
    }
    
    res.json(flow)
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao buscar fluxo' })
  }
})

app.put('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const flowId = parseInt(req.params.flowId)
    const { name, description, flowData } = req.body
    await db.updateMenuFlow(flowId, { name, description, flowData })
    res.json({ message: 'Fluxo atualizado' })
  } catch (error: any) {
    res.status(500).json({ message: 'Erro ao atualizar fluxo' })
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

app.delete('/api/flows/:flowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const flowId = parseInt(req.params.flowId)
    await db.deleteMenuFlow(flowId)
    res.json({ message: 'Fluxo excluído' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir fluxo' })
  }
})

// WHATSAPP CORE
function cleanPhoneNumber(num: string): string {
  return num.replace(/\D/g, '')
}

async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string, isReconnect = false) {
  // Removida a trava de segurança no início pois ela bloqueia reconexões legítimas
  // connectionLocks.set(userId, true)
  
  const sessionPath = path.join(process.cwd(), 'sessions', `session_${userId}`)

  // Fechar socket antigo se existir para evitar leaks e conflitos
  const oldSock = sessions.get(userId)
  if (oldSock) {
    console.log(`[MOTA-FLOW] [User ${userId}] Fechando socket antigo antes de nova conexão.`)
    try {
      oldSock.ev.removeAllListeners('connection.update')
      oldSock.ev.removeAllListeners('creds.update')
      oldSock.ev.removeAllListeners('messages.upsert')
      oldSock.ws.close()
    } catch (e) {}
    sessions.delete(userId)
  }

  const sessionDir = path.dirname(sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  
  // CONFIGURAÇÃO UBUNTU CHROME OFICIAL (Mais estável e recomendada)
  const browserConfig = Browsers.ubuntu('Chrome')

  console.log(`[MOTA-FLOW] [User ${userId}] Criando socket com versão: ${baileysVersion.join('.')}`)
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
    syncFullHistory: false,
    markOnlineOnConnect: true,
    shouldSyncHistoryMessage: () => false,
    qrTimeout: 60000,
    defaultQueryTimeoutMs: 60000,
  })

  console.log(`[MOTA-FLOW] [User ${userId}] Socket criado e armazenado com sucesso`)
  sessions.set(userId, sock)
  
  let pairingCodeRequested = false

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    console.log(`[MOTA-FLOW] [User ${userId}] Update de conexão: ${connection || 'status'}`)

    // 1. Lógica de QR Code
    if (qr) {
      try {
        const qrDataURL = await QRCode.toDataURL(qr)
        const updateData: any = { qrCode: qrDataURL }
        if (!phoneNumber) {
          updateData.status = 'connecting'
          updateData.pairingCode = null
        }
        await db.updateWhatsappInstance(instanceId, updateData)
      } catch (e) {
        console.error(`[MOTA-FLOW] [User ${userId}] Erro ao gerar QR Code:`, e)
      }
    }

    // 2. Lógica de Pairing Code (Refatorada para handler único)
    if (connection === 'connecting' && phoneNumber && !pairingCodeRequested) {
      pairingCodeRequested = true
      console.log(`[MOTA-FLOW] [User ${userId}] Agendando solicitação de pairing code para ${phoneNumber} em 3s...`)
      
      setTimeout(async () => {
        try {
          if (sock.authState.creds.registered) {
            console.log(`[MOTA-FLOW] [User ${userId}] Já registrado, ignorando solicitação de pairing code.`)
            return
          }
          
          const cleanNumber = cleanPhoneNumber(phoneNumber)
          console.log(`[MOTA-FLOW] [User ${userId}] Solicitando pairing code para ${cleanNumber}...`)
          const code = await sock.requestPairingCode(cleanNumber)
          console.log(`[MOTA-FLOW] [User ${userId}] ✅ Pairing code recebido: ${code}`)
          
          await db.updateWhatsappInstance(instanceId, { 
            status: 'connecting', 
            pairingCode: code, 
            qrCode: null,
            phoneNumber: cleanNumber 
          })
        } catch (err: any) {
          console.error(`[MOTA-FLOW] [User ${userId}] ❌ Erro ao obter pairing code:`, err.message)
          pairingCodeRequested = false // Permitir nova tentativa se falhar
        }
      }, 3000)
    }

    // 3. Conexão Estabelecida (O MAIS IMPORTANTE)
    if (connection === 'open') {
      console.log(`[MOTA-FLOW] [User ${userId}] ✅ CONEXÃO ESTABELECIDA! Atualizando banco...`)
      
      const me = sock.user
      const cleanMeId = me?.id?.split(':')[0] || ''
      
      try {
        await db.updateWhatsappInstance(instanceId, {
          status: 'connected',
          phoneNumber: cleanMeId,
          qrCode: null,
          pairingCode: null
        })
        console.log(`[MOTA-FLOW] [User ${userId}] Banco de dados atualizado com status 'connected' para ${cleanMeId}`)
        
        // Limpar travas e contadores de erro
        connectionLocks.delete(userId)
        reconnectAttempts.delete(userId)
      } catch (dbErr) {
        console.error(`[MOTA-FLOW] [User ${userId}] Erro ao atualizar banco no 'open':`, dbErr)
      }
    }

    // 4. Conexão Fechada
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`[MOTA-FLOW] [User ${userId}] Conexão fechada. Status: ${statusCode}`)
      
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || 
                         statusCode === 401 ||
                         statusCode === 403 ||
                         statusCode === 440

      // Erro 515 (Restart Required) - APENAS RECONECTAR, NÃO LIMPAR NADA
      if (statusCode === 515) {
        console.log(`[MOTA-FLOW] [User ${userId}] Erro 515 detectado: Reiniciando socket sem limpar dados...`)
        setTimeout(() => connectToWhatsApp(userId, instanceId, phoneNumber, true), 2000)
        return
      }

      if (isLoggedOut) {
        console.log(`[MOTA-FLOW] [User ${userId}] Logout detectado. Limpando sessão...`)
        connectionLocks.delete(userId)
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected', qrCode: null, pairingCode: null })
        return
      }

      // Outros erros: Retry com backoff exponencial
      const retryData = reconnectAttempts.get(userId) || { count: 0, lastAttempt: 0 }
      const backoffDelay = Math.min(5000 * Math.pow(2, retryData.count), 80000)
      
      if (retryData.count < 5) {
        console.log(`[MOTA-FLOW] [User ${userId}] Tentativa de reconexão ${retryData.count + 1} em ${backoffDelay/1000}s...`)
        reconnectAttempts.set(userId, { count: retryData.count + 1, lastAttempt: Date.now() })
        setTimeout(() => connectToWhatsApp(userId, instanceId, phoneNumber, true), backoffDelay)
      } else {
        console.log(`[MOTA-FLOW] [User ${userId}] Limite de reconexões atingido.`)
        connectionLocks.delete(userId)
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected' })
      }
    }
  })

  sock.ev.on('creds.update', async () => {
    await saveCreds()
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        await processMessage(sock, msg, userId, instanceId)
      }
    }
  })

  sock.ev.on('messaging-history.set', ({ messages }) => {
    console.log(`[MOTA-FLOW] Histórico sincronizado: ${messages.length} mensagens carregadas.`)
  })
}

async function processMessage(sock: any, msg: WAMessage, userId: number, instanceId: number) {
  try {
    const from = msg.key.remoteJid!
    
    // Ignorar mensagens de grupos (@g.us) e canais (@newsletter)
    if (from.endsWith('@g.us') || from.endsWith('@newsletter')) {
      return
    }

    const text = (
      msg.message?.conversation || 
      msg.message?.extendedTextMessage?.text || 
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      ''
    ).trim()

    if (!text) return

    console.log(`[MOTA-FLOW] [User ${userId}] Processando texto: "${text}" de ${from}`)

    const state = messageStates.get(from)
    const now = Date.now()
    const COOLDOWN_24H = 24 * 60 * 60 * 1000
    const isResetKeyword = ['menu', 'voltar', 'inicio', 'início'].includes(text.toLowerCase())

    if (state?.status === 'finished' && !isResetKeyword) {
      if (state.lastInteraction && (now - state.lastInteraction < COOLDOWN_24H)) {
        console.log(`[MOTA-FLOW] [User ${userId}] Usuário ${from} em cooldown. Ignorando.`)
        return
      }
    }

    const flows = await db.getUserMenuFlows(userId)
    const activeFlow = flows.find(f => f.isActive)
    
    if (!activeFlow) {
      console.log(`[MOTA-FLOW] [User ${userId}] Nenhum fluxo ativo encontrado no banco.`)
      return
    }

    let flowData: MenuFlowData
    try {
      flowData = typeof activeFlow.flowData === 'string' 
        ? JSON.parse(activeFlow.flowData) 
        : activeFlow.flowData as any as MenuFlowData
    } catch (e) {
      console.error(`[MOTA-FLOW] [User ${userId}] Erro ao parsear flowData:`, e)
      return
    }

    if (!flowData || !flowData.menus || !flowData.rootMenuId) {
      console.error(`[MOTA-FLOW] [User ${userId}] Estrutura de fluxo inválida: menus ou rootMenuId ausentes.`)
      return
    }

    if (!state || isResetKeyword) {
      const rootMenu = flowData.menus[flowData.rootMenuId]
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
        console.log(`[MOTA-FLOW] [User ${userId}] Fluxo iniciado/resetado para ${from}`)
      } else {
        console.error(`[MOTA-FLOW] [User ${userId}] Menu raiz ${flowData.rootMenuId} não encontrado.`)
        await sock.sendMessage(from, { text: 'Desculpe, o fluxo principal não foi encontrado. Por favor, entre em contato com o suporte.' })
      }
      return
    }

    const currentMenu = flowData.menus[state.menuId]
    if (!currentMenu) {
      console.log(`[MOTA-FLOW] [User ${userId}] Menu atual ${state.menuId} não encontrado. Resetando.`)
      messageStates.delete(from)
      await sock.sendMessage(from, { text: 'Desculpe, houve um problema e seu menu atual não foi encontrado. Reiniciando o fluxo.' })
      const rootMenu = flowData.menus[flowData.rootMenuId]
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

    const option = currentMenu.options.find(o => 
      o.number.toString() === text || 
      o.text.toLowerCase() === text.toLowerCase()
    )

    if (option) {
      console.log(`[MOTA-FLOW] [User ${userId}] Opção selecionada: ${option.number} - ${option.text}`)
      
      if (option.response) {
        await sock.sendMessage(from, { text: option.response })
      }

      // Enviar anexo se existir
      if (option.attachmentData && option.attachmentName) {
        try {
          console.log(`[MOTA-FLOW] Enviando anexo: ${option.attachmentName} para ${from}`)
          const buffer = Buffer.from(option.attachmentData.split(',')[1] || option.attachmentData, 'base64')
          await sock.sendMessage(from, { 
            document: buffer, 
            fileName: option.attachmentName,
            mimetype: 'text/plain'
          })
        } catch (err) {
          console.error(`[MOTA-FLOW] Erro ao enviar anexo:`, err)
        }
      }

      if (option.nextMenuId && flowData.menus[option.nextMenuId]) {
        const nextMenu = flowData.menus[option.nextMenuId]
        await sendMenu(sock, from, nextMenu)
        
        const isFinal = !nextMenu.options || nextMenu.options.length === 0
        messageStates.set(from, { 
          ...state, 
          menuId: nextMenu.id, 
          status: isFinal ? 'finished' : 'active',
          lastInteraction: now
        })
      } else {
        messageStates.set(from, { 
          ...state, 
          status: 'finished',
          lastInteraction: now
        })
        await sock.sendMessage(from, { text: 'Obrigado! Seu atendimento foi finalizado. Digite \'menu\' para recomeçar.' })
      }
    } else {
      console.log(`[MOTA-FLOW] [User ${userId}] Opção inválida de ${from}: "${text}". Repetindo menu.`)
      await sendMenu(sock, from, currentMenu)
    }
  } catch (err) {
    console.error(`[MOTA-FLOW] [User ${userId}] Erro crítico no processMessage:`, err)
    const from = msg.key.remoteJid!
    await sock.sendMessage(from, { text: 'Desculpe, ocorreu um erro inesperado. Por favor, tente novamente ou digite \'menu\' para reiniciar.' })
  }
}

async function sendMenu(sock: any, to: string, menu: MenuNode) {
  try {
    let text = `${menu.message}`
    
    if (menu.options && menu.options.length > 0) {
      text += `\n\n`
      const sortedOptions = [...menu.options].sort((a, b) => a.number - b.number)
      sortedOptions.forEach(opt => {
        text += `*${opt.number}* - ${opt.text}\n`
      })
    }
    
    await sock.sendMessage(to, { text: text.trim() })
  } catch (err) {
    console.error(`[MOTA-FLOW] Erro ao enviar menu:`, err)
  }
}

// WHATSAPP API
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  const { phoneNumber } = req.body
  
  const sessionPath = path.join(process.cwd(), 'sessions', `session_${user.userId}`)
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true })
      console.log(`[MOTA-FLOW] Sessão anterior limpa para usuário ${user.userId}`)
    } catch (err) {
      console.error(`[MOTA-FLOW] Erro ao limpar sessão:`, err)
    }
  }
  
  let instance = await db.getWhatsappInstance(user.userId)
  if (!instance) {
    await db.createWhatsappInstance(user.userId)
    instance = await db.getWhatsappInstance(user.userId)
  }
  if (instance) {
    try {
      await db.updateWhatsappInstance(instance.id, { qrCode: null, pairingCode: null, status: 'connecting' })
      console.log(`[MOTA-FLOW] Iniciando conexão para usuário ${user.userId} com número ${phoneNumber || 'QR code'}`)
      connectToWhatsApp(user.userId, instance.id, phoneNumber).catch(err => {
        console.error(`[MOTA-FLOW] Erro ao conectar WhatsApp:`, err)
      })
      res.json({ message: 'Iniciando...' })
    } catch (err: any) {
      console.error(`[MOTA-FLOW] Erro na rota connect:`, err.message)
      res.status(500).json({ message: 'Erro ao iniciar conexão' })
    }
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
        try { sock.ws.close() } catch (e) {}
        sessions.delete(user.userId)
      }
      const sessionPath = path.join(process.cwd(), 'sessions', `session_${user.userId}`)
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
      connectionLocks.delete(user.userId)
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

app.post('/api/whatsapp/reconnect', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  try {
    const instance = await db.getWhatsappInstance(user.userId)
    if (!instance) {
      return res.status(404).json({ message: 'Instância WhatsApp não encontrada' })
    }

    const sock = sessions.get(user.userId)
    if (sock) {
      sock.ev.removeAllListeners('connection.update')
      sock.ev.removeAllListeners('creds.update')
      sock.ev.removeAllListeners('messages.upsert')
      try { sock.ws.close() } catch (e) {}
      sessions.delete(user.userId)
    }

    await db.updateWhatsappInstance(instance.id, { status: 'connecting', qrCode: null, pairingCode: null })
    connectToWhatsApp(user.userId, instance.id, instance.phoneNumber || undefined, true)

    res.json({ success: true, message: 'Reconectando...' })
  } catch (error) {
    console.error(`[MOTA-FLOW] Erro ao reconectar:`, error)
    res.status(500).json({ success: false, message: 'Erro ao reconectar' })
  }
})

app.get('/api/whatsapp/logs', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload
  const logPath = path.join(process.cwd(), 'logs', `whatsapp_${user.userId}.log`)
  
  if (!fs.existsSync(logPath)) {
    return res.json({ logs: 'Nenhum log encontrado para esta sessão.' })
  }

  try {
    const logs = fs.readFileSync(logPath, 'utf8')
    const lines = logs.split('\n').slice(-100).join('\n')
    res.json({ logs: lines })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao ler logs' })
  }
})

app.use(express.static(path.join(__dirname, 'client')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client', 'index.html')))

app.listen(PORT, '0.0.0.0', () => {
  db.syncSchema().then(() => {
    preloadBaileysVersion().then(() => {
      console.log(`🚀 [MOTA-FLOW] Porta ${PORT}`)
    })
  })
})
