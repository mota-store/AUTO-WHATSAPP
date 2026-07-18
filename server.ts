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
// const pendingPairingNumbers = new Map<number, string>() // Removido: agora usamos phoneNumber diretamente via closure
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
    
    if (!avatar) return res.status(400).json({ message: 'Imagem obrigatória' })
    if (!avatar.startsWith('data:image/')) return res.status(400).json({ message: 'Formato de imagem inválido' })

    const base64Data = avatar.split(',')[1] || ''
    const sizeKB = Math.round((base64Data.length * 0.75) / 1024)
    if (sizeKB > 500) return res.status(400).json({ message: 'Imagem muito grande. Máximo 500KB.' })

    await db.updateUserAvatar(userPayload.userId, avatar)
    res.json({ message: 'Foto de perfil atualizada' })
  } catch (error: any) {
    console.error('[AVATAR ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao atualizar foto de perfil', detail: error?.message })
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

// ============ BOT AVATAR ROUTES ============

app.post('/api/bot-avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { avatar } = req.body
    if (!avatar) return res.status(400).json({ message: 'Imagem obrigatória' })
    if (!avatar.startsWith('data:image/')) return res.status(400).json({ message: 'Formato de imagem inválido' })

    const base64Data = avatar.split(',')[1] || ''
    const sizeKB = Math.round((base64Data.length * 0.75) / 1024)
    if (sizeKB > 500) return res.status(400).json({ message: 'Imagem muito grande. Máximo 500KB.' })

    // Save as JSON file for simplicity
    const avatarPath = path.join(__dirname, 'bot-avatar.json')
    fs.writeFileSync(avatarPath, JSON.stringify({ avatar, updatedAt: new Date().toISOString() }))
    console.log('[MOTA-FLOW] Bot avatar salvo no servidor')
    res.json({ message: 'Avatar do robô salvo com sucesso' })
  } catch (error: any) {
    console.error('[BOT AVATAR ERROR]', error?.message)
    res.status(500).json({ message: 'Erro ao salvar avatar' })
  }
})

app.get('/api/bot-avatar', async (req: Request, res: Response) => {
  try {
    const avatarPath = path.join(__dirname, 'bot-avatar.json')
    if (fs.existsSync(avatarPath)) {
      const data = JSON.parse(fs.readFileSync(avatarPath, 'utf-8'))
      res.json({ botAvatar: data.avatar })
    } else {
      res.json({ botAvatar: null })
    }
  } catch {
    res.json({ botAvatar: null })
  }
})

// Forgot Password
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email obrigatório' })

    const user = await db.getUserByEmail(email)
    if (!user) {
      return res.json({ message: 'Se o email existir, você receberá um link de redefinição' })
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const resetTokenExpiry = new Date(Date.now() + 3600000)

    await db.updateResetToken(user.id, resetToken, resetTokenExpiry)
    res.json({ message: 'Se o email existir, você receberá um link de redefinição' })

    const resetUrl = `${process.env.APP_URL || 'https://auto-whatsapp-production-73d9.up.railway.app'}/reset-password/${resetToken}`
    const targetEmail = email

    setImmediate(async () => {
      try {
        const mailtrapToken = process.env.MAILTRAP_API_TOKEN || ''
        if (!mailtrapToken) {
          console.error('[EMAIL ERROR] MAILTRAP_API_TOKEN não configurada')
          return
        }

        const res = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mailtrapToken}`,
          },
          body: JSON.stringify({
            from: { email: 'noreply@motaflow.com', name: 'MOTA-FLOW' },
            to: [{ email: targetEmail }],
            subject: 'Redefinição de Senha - MOTA-FLOW',
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #25D366;">MOTA-FLOW</h1>
                <h2>Redefinição de Senha</h2>
                <p>Você solicitou a redefinição de senha para sua conta MOTA-FLOW.</p>
                <p>Clique no botão abaixo para redefinir sua senha:</p>
                <a href="${resetUrl}" style="display: inline-block; background: #25D366; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Redefinir Senha</a>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">Este link expira em 1 hora.</p>
              </div>`,
            category: 'Password Reset',
          }),
        })

        const data = await res.json()
        if (res.ok) {
          console.log('[EMAIL OK] E-mail de reset enviado para', targetEmail)
        } else {
          console.error('[EMAIL ERROR] Mailtrap rejeitou:', JSON.stringify(data))
        }
      } catch (emailErr: any) {
        console.error('[EMAIL ERROR]', emailErr?.message)
      }
    })
  } catch (error: any) {
    console.error('[FORGOT PASSWORD ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao processar solicitação' })
  }
})

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ message: 'Token e nova senha obrigatórios' })
    if (newPassword.length < 6) return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' })

    const user = await db.getUserByResetToken(token)
    if (!user) return res.status(400).json({ message: 'Token inválido ou expirado' })

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
    await db.deleteMenuFlow(parseInt(req.params.flowId))
    res.json({ message: 'Fluxo deletado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' })
  }
})

// ============ WHATSAPP CORE LOGIC ============

function cleanPhoneNumber(num: string): string {
  return num.replace(/\D/g, '')
}

async function connectToWhatsApp(userId: number, instanceId: number, phoneNumber?: string, isReconnect = false) {
  const sessionPath = `sessions/session-${userId}`

  // SEMPRE limpar sessão na primeira conexão (mesmo se creds estão salvas)
  if (!isReconnect) {
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true })
        console.log('[MOTA-FLOW] Sessão antiga removida (nova conexão)')
      } catch (e) {
        console.error('[MOTA-FLOW] Erro ao remover sessão antiga:', e)
      }
    }
    // Limpar o cache de sessões em memória também
    sessions.delete(userId)
  }

  const sessionDir = path.dirname(sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  console.log('[MOTA-FLOW] Auth state, registered:', state.creds.registered, 'isReconnect:', isReconnect)

  // Usar versão pré-carregada (já está no baileysVersion)
  const version = baileysVersion

  // Configurar browser: Simular Android para forçar notificação de pareamento
  const browserConfig: [string, string, string] = phoneNumber 
    ? ['Android', 'Chrome', '11.0.0'] 
    : ['MotaFlow', 'Chrome', '1.0.0']

  console.log(`[MOTA-FLOW] Configurando browser: ${browserConfig.join(' ')}`)

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    logger: pino({ level: 'silent' }),
    browser: browserConfig,
    connectTimeoutMs: 60000, // Aumentado para 60s
    keepAliveIntervalMs: 30000,
    printQRInTerminal: false,
    maxMsgRetryCount: 5, // Aumentado para 5
    retryRequestDelayMs: 2000,
  })

  sessions.set(userId, sock)
  
  // Guardar o número usado nesta sessão para reconexão
  const reconnectPhone = phoneNumber

    // SEMPRE precisa de QR/pairing na primeira conexão (não na reconexão)
    if (!isReconnect && phoneNumber) {
      const cleanNumber = cleanPhoneNumber(phoneNumber)
      console.log(`[MOTA-FLOW] Agendando Pairing Code para: ${cleanNumber} (Aguardando estabilização total...)`)
      
      // Delay ajustado para 6s para máxima compatibilidade com a validação do WA
      setTimeout(async () => {
        try {
          if (sock.authState.creds.registered) {
             console.log('[MOTA-FLOW] Dispositivo já registrado, pulando pairing code')
             return
          }
          
          console.log(`[MOTA-FLOW] Solicitando Pairing Code para ${cleanNumber}...`)
          const code = await sock.requestPairingCode(cleanNumber)
          console.log(`[MOTA-FLOW] Pairing Code gerado com sucesso: ${code}`)
          await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code, qrCode: null })
        } catch (err: any) {
          console.error('[MOTA-FLOW] Erro ao solicitar Pairing Code:', err?.message || err)
          
          // Se falhar, vamos tentar novamente com um intervalo maior
          setTimeout(async () => {
            try {
              if (sock.ws.isOpen) {
                console.log(`[MOTA-FLOW] Tentando Pairing Code novamente para ${cleanNumber}...`)
                const code2 = await sock.requestPairingCode(cleanNumber)
                console.log(`[MOTA-FLOW] Pairing Code gerado na segunda tentativa: ${code2}`)
                await db.updateWhatsappInstance(instanceId, { status: 'connecting', pairingCode: code2, qrCode: null })
              }
            } catch (retryErr: any) {
              console.error('[MOTA-FLOW] Falha definitiva ao gerar Pairing Code:', retryErr?.message || retryErr)
            }
          }, 15000)
        }
      }, 8000)
    }
  
  sock.ev.on('creds.update', async () => {
    console.log('[MOTA-FLOW] creds.update chamado - salvando credenciais...')
    try {
      await saveCreds()
      console.log('[MOTA-FLOW] Credenciais salvas com sucesso')
    } catch (err: any) {
      console.error('[MOTA-FLOW] Erro ao salvar credenciais:', err?.message)
    }
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // QR CODE - só processar se NÃO está em reconexão e NÃO tem credenciais registradas
    if (qr && !isReconnect && !state.creds.registered) {
      if (phoneNumber) {
        // Modo pairing: ignorar QR, o código será gerado via setTimeout
        console.log('[MOTA-FLOW] QR recebido em modo pairing, ignorando (Pairing Code será gerado via setTimeout)...')
        // NÃO usar return aqui para não bloquear os outros eventos do handler
      } else {
        // Modo QR: salvar o QR Code no banco
        console.log('[MOTA-FLOW] QR Code recebido!')
        try {
          const qrBase64 = await QRCode.toDataURL(qr, {
            width: 256,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
          })
          await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrBase64, pairingCode: null })
          console.log('[MOTA-FLOW] QR Code atualizado no banco')
        } catch (err: any) {
          console.error('[MOTA-FLOW] Erro QR Base64:', err?.message)
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`
          await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: qrUrl, pairingCode: null })
        }
      }
    }

    // CONECTADO
    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] || 'desconhecido'
      console.log(`[MOTA-FLOW] Conectado! Número: ${phone}`)
      
      // Salvar credenciais imediatamente após abrir a conexão
      try {
        await saveCreds()
        console.log('[MOTA-FLOW] Credenciais salvas após conexão aberta')
      } catch (err) {
        console.error('[MOTA-FLOW] Erro ao salvar credenciais iniciais:', err)
      }
      
      await db.updateWhatsappInstance(instanceId, { status: 'connected', phoneNumber: phone, qrCode: null, pairingCode: null })
    }

    // DESCONECTADO
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      console.log(`[MOTA-FLOW] Conexão fechada: ${statusCode}`)

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      
      if (!shouldReconnect) {
        console.log(`[MOTA-FLOW] Desconectado definitivamente (statusCode ${statusCode}), não reconectar`)
        await db.updateWhatsappInstance(instanceId, { status: 'disconnected', phoneNumber: null, qrCode: null, pairingCode: null })
        sessions.delete(userId)
        try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
      } else {
        console.log(`[MOTA-FLOW] Reconectando em 3000ms (statusCode ${statusCode})...`)
        // Não resetar o phoneNumber no banco durante reconexões temporárias
        await db.updateWhatsappInstance(instanceId, { status: 'connecting', qrCode: null, pairingCode: null })
        setTimeout(() => connectToWhatsApp(userId, instanceId, reconnectPhone, true), 3000)
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

// ============ WHATSAPP ENDPOINTS ============

app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber, usePairingCode } = req.body
    console.log(`[WHATSAPP CONNECT] userId=${user.userId}, phoneNumber=${phoneNumber}, usePairingCode=${usePairingCode}`)

    // Logout existente
    const existingSession = sessions.get(user.userId)
    if (existingSession) {
      console.log('[WHATSAPP CONNECT] Logout sessão ativa...')
      try { existingSession.logout() } catch (e) {}
      sessions.delete(user.userId)
    }

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) instance = await db.createWhatsappInstance(user.userId)

    // Limpar dados antigos no banco para evitar loops de UI
    await db.updateWhatsappInstance(instance.id, { status: 'connecting', qrCode: null, pairingCode: null })

    const cleanPhone = phoneNumber ? cleanPhoneNumber(phoneNumber) : undefined
    
    // Iniciar conexão limpando o estado anterior
    connectToWhatsApp(user.userId, instance.id, usePairingCode ? cleanPhone : undefined, false)

    res.json({ message: 'Conexão iniciada', instanceId: instance.id })
  } catch (error: any) {
    console.error('[WHATSAPP CONNECT ERROR]', error?.message, error?.stack)
    res.status(500).json({ message: 'Erro ao iniciar conexão', detail: error?.message })
  }
})

app.post('/api/whatsapp/pairing-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { phoneNumber } = req.body
    if (!phoneNumber) return res.status(400).json({ message: 'Número obrigatório' })

    console.log(`[PAIRING CODE] userId=${user.userId}, number=${phoneNumber}`)

    let instance = await db.getWhatsappInstance(user.userId)
    if (!instance) instance = await db.createWhatsappInstance(user.userId)

    await db.updateWhatsappInstance(instance.id, { status: 'connecting' })

    const cleanPhone = cleanPhoneNumber(phoneNumber)
    connectToWhatsApp(user.userId, instance.id, cleanPhone)

    res.json({ message: 'Conexão iniciada, aguarde o código' })
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
      try { await sock.logout() } catch (e) {}
      sessions.delete(user.userId)
    }
    const sessionPath = `sessions/session-${user.userId}`
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
    await db.updateWhatsappInstance(parseInt(instanceId), { status: 'disconnected', qrCode: null, pairingCode: null, phoneNumber: null })
    res.json({ message: 'Desconectado' })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' })
  }
})

app.post('/api/whatsapp/:instanceId/reset', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    const { instanceId } = req.params
    
    // Matar sessão ativa se houver
    const sock = sessions.get(user.userId)
    if (sock) {
      try { 
        sock.ev.removeAllListeners('connection.update')
        sock.end(new Error('Reset requested')) 
      } catch (e) {}
      sessions.delete(user.userId)
    }
    
    // Limpeza profunda de arquivos
    const sessionPath = `sessions/session-${user.userId}`
    if (fs.existsSync(sessionPath)) {
      try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch (e) {}
    }
    
    // Limpar banco de dados
    await db.updateWhatsappInstance(parseInt(instanceId), { 
      status: 'disconnected', 
      qrCode: null, 
      pairingCode: null 
    })
    
    console.log(`[MOTA-FLOW] Instância ${instanceId} resetada com sucesso`)
    res.json({ message: 'Instância resetada' })
  } catch (error) {
    console.error('[RESET ERROR]', error)
    res.status(500).json({ message: 'Erro ao resetar' })
  }
})

// ============ MESSAGE PROCESSING ============

async function processMessage(sock: any, msg: any, userId: number, instanceId: number, flowData: MenuFlowData) {
  const sender = msg.key?.remoteJid
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
  if (!sender || !messageText) return

  // Ignorar mensagens que não são texto (mídia, sticker, etc.)
  if (messageText.trim().length === 0) return

  // Comando de teste
  if (messageText.trim().toLowerCase() === 'ping') {
    await sock.sendMessage(sender, { text: '🏓 *Pong!*' })
    return
  }

  let state = messageStates.get(sender)
  const input = messageText.trim().toLowerCase()

  // Se o usuário digitar "menu", reiniciar o fluxo independente do estado
  if (input === 'menu' || input === 'voltar' || input === 'inicio') {
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (rootMenu) {
      await sock.sendMessage(sender, { text: buildMenuMessage(rootMenu) })
      messageStates.set(sender, { 
        flowId: 0, 
        menuId: flowData.rootMenuId, 
        userId, 
        instanceId, 
        status: 'active',
        lastInteraction: Date.now() 
      })
      return
    }
  }

  // Se o estado for 'finished', verificar cooldown (ex: 24 horas = 86400000 ms)
  if (state?.status === 'finished') {
    const cooldown = 24 * 60 * 60 * 1000
    const now = Date.now()
    if (state.lastInteraction && (now - state.lastInteraction < cooldown)) {
      console.log(`[MOTA-FLOW] Usuário ${sender} em cooldown, ignorando mensagem.`)
      return
    }
    // Se passou o cooldown, removemos o estado para permitir novo início
    messageStates.delete(sender)
    state = undefined
  }

  // Se não tem estado, iniciar menu raiz com a primeira mensagem
  if (!state) {
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (!rootMenu) return
    
    // Enviar o menu raiz
    const menuMsg = buildMenuMessage(rootMenu)
    await sock.sendMessage(sender, { text: menuMsg })
    messageStates.set(sender, { 
      flowId: 0, 
      menuId: flowData.rootMenuId, 
      userId, 
      instanceId, 
      status: 'active',
      lastInteraction: Date.now() 
    })
    return
  }

  // Se já tem estado ativo, verificar se a mensagem é uma opção válida
  const currentMenu = flowData.menus[state.menuId]
  const matchedOption = currentMenu.options.find((opt: MenuOption) => String(opt.number) === input || opt.text.toLowerCase() === input)

  // Se não é opção válida, NÃO responder - ignorar
  if (!matchedOption) return

  // Opção válida encontrada - processar
  state.lastInteraction = Date.now()
  if (matchedOption.nextMenuId) {
    const nextMenu = flowData.menus[matchedOption.nextMenuId]
    await sock.sendMessage(sender, { text: buildMenuMessage(nextMenu) })
    state.menuId = matchedOption.nextMenuId
  } else {
    await sock.sendMessage(sender, { text: matchedOption.response || 'Obrigado!' })
    // Marcar como finalizado em vez de deletar
    state.status = 'finished'
  }
}

function buildMenuMessage(menu: MenuNode): string {
  let msg = `${menu.message}\n\n`
  menu.options.forEach(o => { msg += `*${o.number}* - ${o.text}\n` })
  return msg.trim()
}

// ============ SERVE STATIC ============

// O server.js compilado fica em dist/server.js, o client em dist/client/
// Em produção (Railway): __dirname = /app/dist → client está em /app/dist/client
// Em dev (local): __dirname = ./dist → client está em ./dist/client
const distPath = path.join(__dirname, 'client')

console.log(`📂 [SYSTEM] Serving from: ${distPath}`)
console.log('📂 [DEBUG] __dirname:', __dirname)

if (fs.existsSync(distPath)) {
  console.log('✅ [SYSTEM] dist/client found')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
} else {
  console.error('❌ [SYSTEM] dist/client NOT found:', distPath)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.status(404).send('Frontend não encontrado. Build não foi executado corretamente.')
    }
  })
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message })
})

// ============ BOOTSTRAP ============

async function bootstrap() {
  try {
    console.log('🔄 [MOTA-FLOW] Sincronizando schema...')
    await db.syncSchema()
    console.log('✅ [MOTA-FLOW] Schema OK')

    // PRE-LOAD Baileys version in BACKGROUND (não bloqueia o servidor)
    console.log('🔄 [MOTA-FLOW] Pré-carregando versão Baileys (background)...')
    preloadBaileysVersion().then(() => {
      console.log(`   Versão Baileys pronta: ${baileysVersion.join('.')}`)
    }).catch(() => {
      console.log('⚠️ [MOTA-FLOW] Usando versão fallback:', baileysVersion.join('.'))
    })

    app.listen(PORT, async () => {
      console.log(`✅ [MOTA-FLOW] Servidor rodando na porta ${PORT}`)
      console.log(`   Versão Baileys (fallback): ${baileysVersion.join('.')}`)

      // AUTO-RECONNECT: restaurar sessões conectadas após restart
      try {
        console.log('🔄 [MOTA-FLOW] Verificando sessões para reconectar...')
        const sessionDirs = fs.readdirSync('sessions', { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
        
        for (const dir of sessionDirs) {
          const userIdMatch = dir.match(/session-(\d+)/)
          if (!userIdMatch) continue
          const userId = parseInt(userIdMatch[1])
          
          const credsPath = path.join('sessions', dir, 'creds.json')
          if (!fs.existsSync(credsPath)) continue
          
          const instance = await db.getWhatsappInstance(userId)
          if (!instance || instance.status !== 'connected') continue
          
          console.log(`[MOTA-FLOW] Reconectando usuário ${userId} (sessão persistente)...`)
          connectToWhatsApp(userId, instance.id, undefined, true)
        }
        console.log('✅ [MOTA-FLOW] Reconexão automática concluída')
      } catch (err: any) {
        console.log('[MOTA-FLOW] Info: Nenhuma sessão para reconectar:', err?.message)
      }
    })
  } catch (error: any) {
    console.error('❌ [MOTA-FLOW] Erro no bootstrap:', error?.message)
    app.listen(PORT, () => {
      console.log(`⚠️ [MOTA-FLOW] Servidor rodando (com erros) na porta ${PORT}`)
    })
  }
}

bootstrap()
