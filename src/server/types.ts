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
  attachmentName?: string
  attachmentData?: string
  delay?: number
  isTyping?: boolean
  isRecording?: boolean
}

export interface MenuNode {
  id: string
  title: string
  message: string
  options: MenuOption[]
  delay?: number
  isTyping?: boolean
  isRecording?: boolean
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
