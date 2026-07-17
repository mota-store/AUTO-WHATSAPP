export interface AuthPayload {
  userId: number
  email: string
}

export interface AuthResponse {
  token: string
  user: {
    id: number
    email: string
    name: string
  }
}

export interface MenuOption {
  id: string
  number: number
  text: string
  nextMenuId?: string
  response?: string
}

export interface MenuNode {
  id: string
  title: string
  message: string
  options: MenuOption[]
}

export interface MenuFlowData {
  rootMenuId: string
  menus: Record<string, MenuNode>
}

export interface CreateFlowRequest {
  name: string
  description?: string
  flowData: MenuFlowData
}

export interface UpdateFlowRequest extends CreateFlowRequest {}
