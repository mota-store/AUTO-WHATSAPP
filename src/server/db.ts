import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../../drizzle/schema'
import { eq } from 'drizzle-orm'

let pool: mysql.Pool | null = null
let db: ReturnType<typeof drizzle> | null = null

export async function getDb() {
  if (!db) {
    try {
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL não configurada')
      }

      const url = new URL(databaseUrl)
      pool = mysql.createPool({
        uri: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionLimit: 10,
        connectTimeout: 30000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      })

      db = drizzle(pool, { schema, mode: 'default' })
      console.log('✅ [DB] Conexão MySQL (TiDB Cloud) estabelecida e Drizzle ORM inicializado')
    } catch (error: any) {
      console.error('❌ [DB] Falha crítica na conexão com o banco:', error.message)
      console.error('Stack:', error.stack)
      throw error
    }
  }
  return db
}

// User queries
export async function createUser(email: string, passwordHash: string, name: string) {
  const database = await getDb()
  const result = await database.insert(schema.users).values({
    email,
    passwordHash,
    name,
  })
  return result
}

export async function getUserByEmail(email: string) {
  const database = await getDb()
  const users = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
  return users[0]
}

export async function getUserById(id: number) {
  const database = await getDb()
  const users = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)
  return users[0]
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const database = await getDb()
  await database
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, id))
}

export async function updateUserAvatar(id: number, avatar: string) {
  const database = await getDb()
  try {
    await database
      .update(schema.users)
      .set({ avatar })
      .where(eq(schema.users.id, id))
    return true
  } catch (error: any) {
    console.error('[DB AVATAR ERROR]', error?.message)
    // If it's a data too long error, try with MEDIUMTEXT column
    if (error?.message?.includes('too long') || error?.code === 'ER_DATA_TOO_LONG') {
      console.error('[DB AVATAR ERROR] Coluna avatar muito pequena, imagem rejeitada')
      throw new Error('Imagem muito grande para o banco de dados. Use uma imagem menor.')
    }
    throw error
  }
}

export async function updateResetToken(userId: number, resetToken: string, resetTokenExpiry: Date) {
  const database = await getDb()
  await database
    .update(schema.users)
    .set({ resetToken, resetTokenExpiry })
    .where(eq(schema.users.id, userId))
}

export async function getUserByResetToken(token: string) {
  const database = await getDb()
  const users = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.resetToken, token))
    .limit(1)
  return users[0]
}

export async function clearResetToken(userId: number) {
  const database = await getDb()
  await database
    .update(schema.users)
    .set({ resetToken: null, resetTokenExpiry: null })
    .where(eq(schema.users.id, userId))
}

// WhatsApp Instance queries
export async function createWhatsappInstance(userId: number) {
  const database = await getDb()
  const result = await database.insert(schema.whatsappInstances).values({
    userId,
    status: 'disconnected',
  })
  return getWhatsappInstance(userId)
}

export async function getWhatsappInstance(userId: number) {
  const database = await getDb()
  const instances = await database
    .select()
    .from(schema.whatsappInstances)
    .where(eq(schema.whatsappInstances.userId, userId))
    .limit(1)
  return instances[0]
}

export async function updateWhatsappInstance(
  instanceId: number,
  data: Partial<typeof schema.whatsappInstances.$inferInsert>
) {
  const database = await getDb()
  try {
    await database
      .update(schema.whatsappInstances)
      .set(data)
      .where(eq(schema.whatsappInstances.id, instanceId))
  } catch (error: any) {
    // If qr_code is too long for TEXT, we'll get an error
    // This shouldn't happen since QR base64 is small (~3KB)
    console.error('[DB WA UPDATE ERROR]', error?.message)
    throw error
  }
}

export async function updateWhatsappStatus(instanceId: number, status: string, qrCode: string | null) {
  const database = await getDb()
  await database
    .update(schema.whatsappInstances)
    .set({ status, qrCode })
    .where(eq(schema.whatsappInstances.id, instanceId))
}

// Menu Flow queries
export async function createMenuFlow(userId: number, name: string, description: string | undefined, flowData: any) {
  const database = await getDb()
  const result = await database.insert(schema.menuFlows).values({
    userId,
    name,
    description,
    flowData: typeof flowData === 'object' ? JSON.stringify(flowData) : flowData,
    isActive: true,
  })
  return result
}

export async function getMenuFlow(flowId: number) {
  const database = await getDb()
  const flows = await database
    .select()
    .from(schema.menuFlows)
    .where(eq(schema.menuFlows.id, flowId))
    .limit(1)
  return flows[0]
}

export async function getUserMenuFlows(userId: number) {
  const database = await getDb()
  return database
    .select()
    .from(schema.menuFlows)
    .where(eq(schema.menuFlows.userId, userId))
}

export async function updateMenuFlow(
  flowId: number,
  data: Partial<typeof schema.menuFlows.$inferInsert>
) {
  const database = await getDb()
  const updateData = { ...data }
  if (updateData.flowData && typeof updateData.flowData === 'object') {
    updateData.flowData = JSON.stringify(updateData.flowData) as any
  }

  await database
    .update(schema.menuFlows)
    .set(updateData)
    .where(eq(schema.menuFlows.id, flowId))
}

export async function activateFlow(userId: number, flowId: number) {
  const database = await getDb()
  // Desativar todos os fluxos do usuário
  await database
    .update(schema.menuFlows)
    .set({ isActive: false })
    .where(eq(schema.menuFlows.userId, userId))
  // Ativar o fluxo escolhido
  await database
    .update(schema.menuFlows)
    .set({ isActive: true })
    .where(eq(schema.menuFlows.id, flowId))
}

export async function deleteMenuFlow(flowId: number) {
  const database = await getDb()
  await database
    .delete(schema.menuFlows)
    .where(eq(schema.menuFlows.id, flowId))
}

// Message Log queries
export async function logMessage(
  userId: number,
  instanceId: number,
  senderPhone: string,
  messageText: string,
  responseText: string | undefined,
  flowId: number | undefined
) {
  const database = await getDb()
  await database.insert(schema.messageLogs).values({
    userId,
    instanceId,
    senderPhone,
    messageText,
    responseText,
    flowId,
  })
}

// Sync schema on boot
export async function syncSchema() {
  try {
    if (!pool) {
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL não configurada')
      }
      pool = mysql.createPool({
        uri: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionLimit: 10,
        connectTimeout: 30000,
      })
    }

    const connection = await pool.getConnection()

    // Create users table - using MEDIUMTEXT for avatar to support up to 16MB
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar MEDIUMTEXT,
        reset_token TEXT,
        reset_token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        UNIQUE INDEX email_idx (email)
      )
    `)
    console.log('✅ [DB] Tabela users verificada/criada')

    // Check and fix avatar column type if it's still TEXT (too small)
    try {
      const [colInfo] = await connection.execute(
        `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`
      )
      const colData = (colInfo as any[])
      if (colData.length > 0 && colData[0].COLUMN_TYPE === 'text') {
        console.log('[DB] Alterando coluna avatar de TEXT para MEDIUMTEXT...')
        await connection.execute(`ALTER TABLE users MODIFY COLUMN avatar MEDIUMTEXT`)
        console.log('✅ [DB] Coluna avatar alterada para MEDIUMTEXT (suporta até 16MB)')
      } else {
        console.log('✅ [DB] Coluna avatar já está com tipo adequado')
      }
    } catch (err: any) {
      console.warn('[DB] Aviso ao verificar/alterar coluna avatar:', err.message)
    }

    // Check and add missing columns
    const [colsResult] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('reset_token', 'reset_token_expiry', 'avatar')`
    )
    const existingCols = (colsResult as any[]).map(c => c.COLUMN_NAME)
    console.log('📊 [DB] Colunas existentes na tabela users:', existingCols)
    for (const col of ['avatar', 'reset_token', 'reset_token_expiry']) {
      if (!existingCols.includes(col)) {
        const colType = col === 'reset_token_expiry' ? 'TIMESTAMP' : (col === 'avatar' ? 'MEDIUMTEXT' : 'TEXT')
        try {
          await connection.execute(`ALTER TABLE users ADD COLUMN ${col} ${colType}`)
          console.log(`✅ [DB] Coluna ${col} adicionada com sucesso`)
        } catch (err: any) {
          console.error(`❌ [DB] Erro ao adicionar ${col}:`, err.message)
        }
      } else {
        console.log(`✅ [DB] Coluna ${col} já existe`)
      }
    }
    console.log('✅ [DB] Colunas da tabela users verificadas/criadas')

    // Check whatsapp_instances columns
    const [waColsResult] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whatsapp_instances' AND COLUMN_NAME IN ('pairing_code')`
    )
    const waExistingCols = (waColsResult as any[]).map(c => c.COLUMN_NAME)
    console.log('📊 [DB] Colunas existentes na tabela whatsapp_instances:', waExistingCols)
    if (!waExistingCols.includes('pairing_code')) {
      try {
        await connection.execute(`ALTER TABLE whatsapp_instances ADD COLUMN pairing_code TEXT`)
        console.log('✅ [DB] Coluna pairing_code adicionada com sucesso')
      } catch (err: any) {
        console.error('❌ [DB] Erro ao adicionar pairing_code:', err.message)
      }
    } else {
      console.log('✅ [DB] Coluna pairing_code já existe')
    }

    // Create whatsapp_instances table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_instances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        phone_number VARCHAR(50),
        status ENUM('disconnected', 'connecting', 'connected') DEFAULT 'disconnected' NOT NULL,
        session_data TEXT,
        qr_code TEXT,
        pairing_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `)
    console.log('✅ [DB] Tabela whatsapp_instances verificada/criada')

    // Create menu_flows table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS menu_flows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        flow_data LONGTEXT NOT NULL,
        is_active TINYINT(1) DEFAULT 1 NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `)
    console.log('✅ [DB] Tabela menu_flows verificada/criada')

    // Create message_logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        instance_id INT NOT NULL,
        sender_phone VARCHAR(50) NOT NULL,
        message_text TEXT NOT NULL,
        response_text TEXT,
        flow_id INT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `)
    console.log('✅ [DB] Tabela message_logs verificada/criada')

    connection.release()
    console.log('✅ [DB] Schema sincronizado com sucesso')
  } catch (error: any) {
    console.error('❌ [DB] Erro ao sincronizar schema:', error.message)
    console.error('Stack:', error.stack)
    throw error
  }
}
