import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Send } from 'lucide-react'

interface MenuOption {
  id: string
  number: number
  text: string
  nextMenuId?: string
  response?: string
}

interface MenuNode {
  id: string
  title: string
  message: string
  options: MenuOption[]
}

interface MenuFlowData {
  rootMenuId: string
  menus: Record<string, MenuNode>
}

interface MenuFlow {
  id: number
  name: string
  flowData: MenuFlowData
}

export default function FlowPreview() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const [flow, setFlow] = useState<MenuFlow | null>(null)
  const [currentMenuId, setCurrentMenuId] = useState<string>('')
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'bot'; text: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inputText, setInputText] = useState('')

  useEffect(() => {
    loadFlow()
  }, [flowId])

  const loadFlow = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${flowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setFlow(data)
        setCurrentMenuId(data.flowData.rootMenuId)
        setMessages([{ type: 'bot', text: data.flowData.menus[data.flowData.rootMenuId].message }])
      } else {
        toast.error('Fluxo não encontrado')
        navigate('/dashboard')
      }
    } catch (error) {
      toast.error('Erro ao carregar fluxo')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOptionClick = (option: MenuOption) => {
    if (!flow) return

    setMessages((prev) => [
      ...prev,
      { type: 'user', text: option.number.toString() },
      { type: 'bot', text: option.response || 'Opção selecionada' },
    ])

    if (option.nextMenuId && flow.flowData.menus[option.nextMenuId]) {
      setCurrentMenuId(option.nextMenuId)
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: flow.flowData.menus[option.nextMenuId!].message },
      ])
    }
  }

  const handleSendMessage = () => {
    if (!flow || !inputText.trim()) return

    const trimmed = inputText.trim().toLowerCase()
    const currentMenu = flow.flowData.menus[currentMenuId]
    if (!currentMenu) return

    // Tenta match com o número
    const numMatch = currentMenu.options.find(opt => opt.number.toString() === trimmed)
    if (numMatch) {
      handleOptionClick(numMatch)
      setInputText('')
      return
    }

    // Tenta match com o texto da opção (ex: "produtos" bate com "Quero ver os produtos")
    const textMatch = currentMenu.options.find(opt => 
      opt.text.toLowerCase().includes(trimmed) || trimmed.includes(opt.text.toLowerCase())
    )
    if (textMatch) {
      handleOptionClick(textMatch)
      setInputText('')
      return
    }

    // Se não bate com nada, o robô ignora (não envia mensagem)
    setInputText('')
  }

  const handleReset = () => {
    if (!flow) return
    setCurrentMenuId(flow.flowData.rootMenuId)
    setMessages([{ type: 'bot', text: flow.flowData.menus[flow.flowData.rootMenuId].message }])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!flow) return null

  const currentMenu = flow.flowData.menus[currentMenuId]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-foreground">Preview: {flow.name}</h1>
          <div></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col h-[600px]">
          {/* Chat Header com avatar do bot */}
          <div className="bg-[#075E54] p-4 flex items-center gap-3 border-b">
            <img src="/bot-avatar.png" alt="Bot" className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="text-white font-black text-sm">MOTA-FLOW (Robô)</p>
              <p className="text-white/70 text-[10px]">Online</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: '#E5DDD5' }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg shadow-sm ${
                    msg.type === 'user'
                      ? 'bg-[#DCF8C6] text-black'
                      : 'bg-white text-black'
                  }`}
                  style={msg.type === 'user' ? { borderTopRightRadius: '4px' } : { borderTopLeftRadius: '4px' }}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Options + Input */}
          <div className="border-t border-border">
            {currentMenu && currentMenu.options.length > 0 && (
              <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {currentMenu.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleOptionClick(option)}
                    className="w-full text-left px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition text-foreground text-sm"
                  >
                    <span className="font-bold">{option.number}.</span> {option.text}
                  </button>
                ))}
              </div>
            )}

            {/* Input de mensagem estilo WhatsApp */}
            <div className="bg-[#F0F0F0] p-3 flex gap-2 items-center">
              <input 
                type="text" 
                placeholder="Digite uma mensagem"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-black outline-none"
              />
              <button 
                onClick={handleSendMessage}
                className="w-10 h-10 bg-[#128C7E] rounded-full flex items-center justify-center text-white shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="w-full mt-4 px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition text-sm font-medium"
        >
          Reiniciar
        </button>
      </main>
    </div>
  )
}
