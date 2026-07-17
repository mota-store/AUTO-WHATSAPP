import {
  int,
  mysqlTable,
  varchar,
  text,
  timestamp,
  json,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const whatsappInstances = mysqlTable("whatsapp_instances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  status: mysqlEnum("status", ["disconnected", "connecting", "connected"]).default("disconnected").notNull(),
  sessionData: text("session_data"),
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const menuFlows = mysqlTable("menu_flows", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  flowData: text("flow_data").$type<MenuFlowData>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const messageLogs = mysqlTable("message_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  instanceId: int("instance_id").notNull(),
  senderPhone: varchar("sender_phone", { length: 20 }).notNull(),
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
