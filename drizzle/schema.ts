import {
  integer,
  sqliteTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at").default("CURRENT_TIMESTAMP").notNull(),
}, (users) => ({
  emailIdx: uniqueIndex("email_idx").on(users.email),
}));
});

export const whatsappInstances = sqliteTable("whatsapp_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  phoneNumber: text("phone_number"),
  status: text("status", { enum: ["disconnected", "connecting", "connected"] }).default("disconnected").notNull(),
  sessionData: text("session_data"),
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const menuFlows = sqliteTable("menu_flows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  flowData: text("flow_data").$type<MenuFlowData>().notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: timestamp("created_at").default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at").default("CURRENT_TIMESTAMP").notNull(),
});

export const messageLogs = sqliteTable("message_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  instanceId: integer("instance_id").notNull(),
  senderPhone: text("sender_phone").notNull(),
  messageText: text("message_text").notNull(),
  responseText: text("response_text"),
  flowId: integer("flow_id"),
  timestamp: timestamp("timestamp").default("CURRENT_TIMESTAMP").notNull(),
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
