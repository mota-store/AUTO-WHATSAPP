import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../../drizzle/schema'
import { eq } from 'drizzle-orm'

let db: ReturnType<typeof drizzle> | null = null

export async function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL || ''
    
    // Extrair informações da URL para garantir que o banco de dados seja selecionado
    // mysql://user:pass@host:port/db_name
    const connectionConfig: any = {
      uri: databaseUrl,
      ssl: {
        rejectUnauthorized: true
      }
    }

    // Se a URL contém parâmetros de query, o mysql2/promise prefere que passemos a URI direta
    // Mas para o TiDB Cloud, às vezes é necessário garantir o SSL explicitamente no config
    console.log('🔌 [DB] Conectando ao TiDB Cloud...');
    const connection = await mysql.createConnection(connectionConfig)
    console.log('✅ [DB] Conexão MySQL estabelecida');
    db = drizzle(connection, { schema, mode: 'default' })
    console.log('✅ [DB] Drizzle ORM inicializado');
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
