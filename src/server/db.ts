import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../../drizzle/schema'
import { eq } from 'drizzle-orm'

let db: ReturnType<typeof drizzle> | null = null

export async function getDb() {
  if (!db) {
    console.log('🔍 [DB DEBUG] Tentando ler DATABASE_URL...');
    const dbKeys = Object.keys(process.env).filter(k => k.includes("DATABASE"));
    console.log('🔍 [DB DEBUG] Chaves DATABASE disponíveis:', dbKeys);
    
    // Tentar ler de forma insensível a espaços ou nomes aproximados
    const databaseUrl = process.env.DATABASE_URL || process.env['DATABASE_URL '] || process.env.DATABASEURL;
    
    if (!databaseUrl) {
      console.error('❌ [DB] DATABASE_URL não definida nas variáveis de ambiente');
      throw new Error('Configuração de banco de dados ausente (DATABASE_URL)');
    }

    console.log('🔌 [DB] Conectando ao banco de dados remoto...');
    
    // Configuração robusta para o driver mysql2
    const connectionConfig: any = {
      uri: databaseUrl,
      ssl: {
        rejectUnauthorized: true
      },
      // Forçar o uso da URI para evitar fallbacks de localhost no driver
      connectTimeout: 10000,
    }

    try {
      const connection = await mysql.createConnection(connectionConfig)
      console.log('✅ [DB] Conexão MySQL estabelecida com sucesso');
      db = drizzle(connection, { schema, mode: 'default' })
      console.log('✅ [DB] Drizzle ORM inicializado');
    } catch (error: any) {
      console.error('❌ [DB] Falha crítica na conexão com o banco:', error.message);
      console.error('Stack:', error.stack);
      throw error;
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

// WhatsApp Instance queries
export async function createWhatsappInstance(userId: number) {
  const database = await getDb()
  const result = await database.insert(schema.whatsappInstances).values({
    userId,
    status: 'disconnected',
  })
  return result
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
  await database
    .update(schema.whatsappInstances)
    .set(data)
    .where(eq(schema.whatsappInstances.id, instanceId))
}

// Menu Flow queries
export async function createMenuFlow(userId: number, name: string, description: string | undefined, flowData: any) {
  const database = await getDb()
  const result = await database.insert(schema.menuFlows).values({
    userId,
    name,
    description,
    flowData,
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
  await database
    .update(schema.menuFlows)
    .set(data)
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
