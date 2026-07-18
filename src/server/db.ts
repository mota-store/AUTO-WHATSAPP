import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../../drizzle/schema'
import { eq } from 'drizzle-orm'

let db: ReturnType<typeof drizzle> | null = null

export async function getDb() {
  if (!db) {
    try {
      const sqlite = new Database('sqlite.db');
      db = drizzle(sqlite, { schema });
      console.log('✅ [DB] Conexão SQLite estabelecida e Drizzle ORM inicializado');
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

export async function updateUserPassword(id: number, passwordHash: string) {
  const database = await getDb()
  await database
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, id))
}

export async function updateUserAvatar(id: number, avatar: string) {
  const database = await getDb()
  await database
    .update(schema.users)
    .set({ avatar })
    .where(eq(schema.users.id, id))
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
  const updateData = { ...data };
  if (updateData.flowData && typeof updateData.flowData === 'object') {
    updateData.flowData = JSON.stringify(updateData.flowData) as any;
  }

  await database
    .update(schema.menuFlows)
    .set(updateData)
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
