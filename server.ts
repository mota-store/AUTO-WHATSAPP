import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createToken, verifyPassword, hashPassword, verifyToken, extractToken } from './src/server/utils'
import * as db from './src/server/db'
import { AuthPayload, CreateFlowRequest, UpdateFlowRequest } from './src/server/types'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
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
    const result = await db.createUser(email, passwordHash, name)
    
    // Obter o usuário recém-criado para gerar o token
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

// WhatsApp Routes
app.post('/api/whatsapp/connect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as AuthPayload
    let instance = await db.getWhatsappInstance(user.userId)
    
    if (!instance) {
      await db.createWhatsappInstance(user.userId)
      instance = await db.getWhatsappInstance(user.userId)
    }

    // Aqui você integraria com o Baileys para gerar o QR Code
    // Por enquanto, simulamos o início da conexão
    await db.updateWhatsappInstance(instance!.id, {
      status: 'connecting',
      qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=MotaFlow_Simulated_QR',
    })

    res.json({ message: 'Conexão iniciada' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Erro ao conectar WhatsApp' })
  }
})

app.post('/api/whatsapp/:instanceId/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params

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
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
  
  // Tentar sincronizar o banco de dados automaticamente no boot
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('🔄 Sincronizando banco de dados...')
      const databaseUrl = process.env.DATABASE_URL || ''
      const sslUrl = databaseUrl.includes('?') 
        ? `${databaseUrl}&ssl={"rejectUnauthorized":true}`
        : `${databaseUrl}?ssl={"rejectUnauthorized":true}`
      const { stdout, stderr } = await execAsync(`DATABASE_URL='${sslUrl}' npx drizzle-kit push`)
      console.log('✅ Banco de dados sincronizado:', stdout)
      if (stderr) console.error('⚠️ Aviso na sincronização:', stderr)
    } catch (error) {
      console.error('❌ Erro ao sincronizar banco de dados:', error)
    }
  }
})
