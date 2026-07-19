import {
  int,
  mysqlTable,
  text,
  varchar,
  tinyint,
  timestamp,
  mysqlEnum,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  avatar: text("avatar"),  // Will be MEDIUMTEXT in actual DB via syncSchema
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (users) => ({
  emailIdx: uniqueIndex("email_idx").on(users.email),
}));

export const whatsappInstances = mysqlTable("whatsapp_instances", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  status: mysqlEnum("status", ["disconnected", "connecting", "connected"]).default("disconnected").notNull(),
  sessionData: text("session_data"),
  qrCode: text("qr_code"),
  pairingCode: text("pairing_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const menuFlows = mysqlTable("menu_flows", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  flowData: text("flow_data").notNull(),
  isActive: tinyint("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const messageLogs = mysqlTable("message_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  instanceId: int("instance_id").notNull(),
  senderPhone: varchar("sender_phone", { length: 50 }).notNull(),
  messageText: text("message_text").notNull(),
  responseText: text("response_text"),
  flowId: int("flow_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = typeof whatsappInstances.$inferInsert;

export type MenuFlow = typeof menuFlows.$inferSelect;
export type InsertMenuFlow = typeof menuFlows.$inferInsert;

export type MessageLog = typeof messageLogs.$inferSelect;
export type InsertMessageLog = typeof messageLogs.$inferInsert;

export interface MenuOption {
  id: string;
  number: number;
  text: string;
  nextMenuId?: string;
  response?: string;
}

export interface MenuNode {
  id: string;
  title: string;
  message: string;
  options: MenuOption[];
}

export interface MenuFlowData {
  rootMenuId: string;
  menus: Record<string, MenuNode>;
}
