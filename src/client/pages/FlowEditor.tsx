import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  ChevronRight, 
  MessageSquare, 
  Zap,
  Smartphone,
  Eye,
  Settings,
  MousePointer2,
  ChevronLeft,
  RefreshCw,
  Send
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

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

interface ChatMessage {
  type: 'user' | 'bot'
  text: string
}

export default function FlowEditor() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [flowData, setFlowData] = useState<MenuFlowData>({
    rootMenuId: 'menu_1',
    menus: {
      menu_1: {
        id: 'menu_1',
        title: 'Início da Conversa',
        message: '👋 Olá! Seja bem-vindo(a). Como podemos ajudar você hoje?',
        options: [
          { id: 'opt_1', number: 1, text: 'Quero ver os produtos', response: '' },
          { id: 'opt_2', number: 2, text: 'Falar com atendente', response: 'Um momento, já vamos te atender!' },
        ],
      },
    },
  })
  const [selectedMenuId, setSelectedMenuId] = useState('menu_1')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!flowId)
  const [previewMode, setPreviewMode] = useState(false)
  const [botAvatar, setBotAvatar] = useState<string>('')

  // Preview chat state
  const [previewCurrentMenuId, setPreviewCurrentMenuId] = useState<string>('')
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flowId) {
      loadFlow()
    }
    loadBotAvatar()
  }, [flowId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [previewMessages])

  // Initialize preview chat when entering preview mode
  useEffect(() => {
    if (previewMode && flowData.rootMenuId) {
      const rootMenu = flowData.menus[flowData.rootMenuId]
      if (rootMenu) {
        setPreviewCurrentMenuId(flowData.rootMenuId)
        setPreviewMessages([{ type: 'bot', text: rootMenu.message }])
      }
    }
  }, [previewMode])

  const loadBotAvatar = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/bot-avatar', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.botAvatar) setBotAvatar(data.botAvatar)
      }
    } catch {}
  }

  const loadFlow = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${flowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setFlowName(data.name)
        setFlowDescription(data.description || '')
        if (data.flowData) {
          setFlowData(data.flowData)
          if (data.flowData.rootMenuId) {
            setSelectedMenuId(data.flowData.rootMenuId)
          }
        }
      }
    } catch (error) {
      toast.error('Erro ao carregar')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error('Dê um nome para este fluxo')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const method = flowId ? 'PUT' : 'POST'
      const url = flowId ? `/api/flows/${flowId}` : '/api/flows'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: flowName,
          description: flowDescription,
          flowData,
        }),
      })

      if (response.ok) {
        toast.success('Salvo com sucesso!')
        navigate('/flows')
      }
    } catch (error) {
      toast.error('Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  const createNextStep = (optionId: string) => {
    const optionIndex = selectedMenu.options.findIndex(o => o.id === optionId)
    if (optionIndex === -1) return

    const newMenuId = `menu_${Date.now()}`
    const newMenus = { ...flowData.menus }
    
    newMenus[newMenuId] = {
      id: newMenuId,
      title: `${selectedMenu.options[optionIndex].text}`,
      message: 'O que o robô deve dizer agora?',
      options: [
        { id: `opt_back_${Date.now()}`, number: 0, text: 'Voltar ao início', nextMenuId: flowData.rootMenuId }
      ]
    }

    newMenus[selectedMenuId].options[optionIndex].nextMenuId = newMenuId
    newMenus[selectedMenuId].options[optionIndex].response = ''

    setFlowData({ ...flowData, menus: newMenus })
    setSelectedMenuId(newMenuId)
    toast.success('Nova resposta criada!')
  }

  // Preview: handle option click
  const handlePreviewOptionClick = (option: MenuOption) => {
    if (!flowData) return

    const currentMenu = flowData.menus[previewCurrentMenuId]
    if (!currentMenu) return

    // Add user message
    const newMessages: ChatMessage[] = [...previewMessages, { type: 'user', text: option.number.toString() }]
    
    // Add bot response
    if (option.response) {
      newMessages.push({ type: 'bot', text: option.response })
    }

    // Navigate to next menu if exists
    if (option.nextMenuId && flowData.menus[option.nextMenuId]) {
      const nextMenu = flowData.menus[option.nextMenuId]
      newMessages.push({ type: 'bot', text: nextMenu.message })
      setPreviewCurrentMenuId(option.nextMenuId)
    } else if (option.response) {
      // No next menu, just show the response
    }

    setPreviewMessages(newMessages)
  }

  // Preview: handle text input
  const handlePreviewSend = () => {
    if (!previewInput.trim() || !flowData) return

    const trimmed = previewInput.trim().toLowerCase()
    const currentMenu = flowData.menus[previewCurrentMenuId]
    if (!currentMenu) {
      setPreviewInput('')
      return
    }

    // Try match by number
    const numMatch = currentMenu.options.find(opt => opt.number.toString() === trimmed)
    if (numMatch) {
      handlePreviewOptionClick(numMatch)
      setPreviewInput('')
      return
    }

    // Try match by text (partial)
    const textMatch = currentMenu.options.find(opt => 
      opt.text.toLowerCase().includes(trimmed) || trimmed.includes(opt.text.toLowerCase())
    )
    if (textMatch) {
      handlePreviewOptionClick(textMatch)
      setPreviewInput('')
      return
    }

    // No match: user message is sent but bot ignores (no response)
    setPreviewMessages(prev => [...prev, { type: 'user', text: previewInput.trim() }])
    setPreviewInput('')
  }

  const handlePreviewReset = () => {
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (!rootMenu) return
    setPreviewCurrentMenuId(flowData.rootMenuId)
    setPreviewMessages([{ type: 'bot', text: rootMenu.message }])
    setPreviewInput('')
  }

  const selectedMenu = flowData.menus[selectedMenuId]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <RefreshCw className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-3 lg:p-6 transition-all duration-500">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Top Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/flows')} className="p-2 hover:bg-muted rounded-lg transition-all">
                <ChevronLeft className="w-6 h-6 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-lg font-black tracking-tight">{flowName || 'Novo Atendimento'}</h1>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Editor</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-lg font-black text-xs flex items-center justify-center gap-1 transition-all ${previewMode ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                <Eye className="w-4 h-4" /> {previewMode ? 'Voltar' : 'Testar'}
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2 bg-whatsapp text-white rounded-lg font-black text-xs flex items-center justify-center gap-1 shadow-lg shadow-whatsapp/20 hover:opacity-90 transition-all"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Side - Mapa Simples */}
            <div className={`${previewMode ? 'hidden' : 'lg:col-span-4'} space-y-3`}>
              <div className="glass-card rounded-xl p-3 border border-border/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Nome
                </h3>
                <input 
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Ex: Suporte de Vendas"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              <div className="glass-card rounded-xl p-3 border border-border/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <MousePointer2 className="w-3 h-3" /> Etapas
                </h3>
                <div className="space-y-1">
                  {Object.values(flowData.menus).map(menu => (
                    <button 
                      key={menu.id}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`w-full p-2 rounded-lg text-left transition-all border-2 text-xs ${
                        selectedMenuId === menu.id 
                        ? 'border-primary bg-primary/5 text-primary font-black' 
                        : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate">{menu.id === flowData.rootMenuId ? 'Menu Principal' : `Resposta: ${menu.title.replace(/^Sub-menu:\s*/, '')}`}</span>
                        {menu.id === flowData.rootMenuId && <span className="text-[7px] bg-primary text-white px-1.5 py-0.5 rounded-full">INÍCIO</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side - Editor Visual */}
            <div className={`${previewMode ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
              {previewMode ? (
                /* Preview Realista Estilo WhatsApp - FUNCIONAL */
                <div className="flex justify-center py-8 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                  <div className="w-full max-w-[360px] bg-[#E5DDD5] rounded-[3rem] border-[12px] border-black shadow-2xl overflow-hidden flex flex-col h-[600px]">
                    {/* Header */}
                    <div className="bg-[#075E54] p-4 flex items-center gap-3">
                      {botAvatar ? (
                        <img src={botAvatar} alt="Bot" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <img src="/bot-avatar.png" alt="Bot" className="w-10 h-10 rounded-full object-cover" />
                      )}
                      <div>
                        <p className="text-white font-black text-sm">MOTA-FLOW (Robô)</p>
                        <p className="text-white/70 text-[10px]">Online</p>
                      </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      {previewMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`px-3 py-2 rounded-lg shadow-sm max-w-[85%] ${
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
                      <div ref={chatEndRef} />
                    </div>

                    {/* Options (clickable buttons) */}
                    {flowData.menus[previewCurrentMenuId]?.options.length > 0 && (
                      <div className="border-t border-gray-300/50 p-3 space-y-2 max-h-[150px] overflow-y-auto">
                        {flowData.menus[previewCurrentMenuId].options.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => handlePreviewOptionClick(opt)}
                            className="w-full text-left px-3 py-2 bg-white/80 hover:bg-white rounded-lg transition text-sm font-bold text-[#128C7E]"
                          >
                            {opt.number}. {opt.text}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input funcional */}
                    <div className="bg-[#F0F0F0] p-3 flex gap-2 items-center">
                      <input 
                        type="text" 
                        placeholder="Digite uma mensagem"
                        value={previewInput}
                        onChange={(e) => setPreviewInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePreviewSend()}
                        className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-black outline-none border-none"
                      />
                      <button 
                        onClick={handlePreviewSend}
                        className="w-10 h-10 bg-[#128C7E] rounded-full flex items-center justify-center text-white shrink-0"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editor Passo a Passo */
                <div className="glass-card rounded-xl p-3 border border-border/50 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-lg font-black tracking-tight mb-1">{selectedMenu.title}</h2>
                    <p className="text-muted-foreground font-medium text-xs">Escreva o que o robô vai responder nesta etapa.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Mensagem
                      </label>
                      <textarea 
                        value={selectedMenu.message}
                        onChange={(e) => {
                          const newMenus = { ...flowData.menus };
                          newMenus[selectedMenuId].message = e.target.value;
                          setFlowData({ ...flowData, menus: newMenus });
                        }}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg font-medium h-24 focus:border-primary outline-none transition-all text-sm"
                        placeholder="Ex: Olá! Como posso te ajudar?"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Opções:</h3>
                        <button 
                          onClick={() => {
                            const newId = `opt_${Date.now()}`;
                            const newMenus = { ...flowData.menus };
                            newMenus[selectedMenuId].options.push({
                              id: newId,
                              number: newMenus[selectedMenuId].options.length + 1,
                              text: 'Nova Opção',
                              response: ''
                            });
                            setFlowData({ ...flowData, menus: newMenus });
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg font-black text-[10px] hover:bg-primary hover:text-white transition-all"
                        >
                          <Plus className="w-3 h-3" /> Opção
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {selectedMenu.options.map((option, index) => (
                          <div key={option.id} className="group bg-muted/20 hover:bg-muted/40 p-2 rounded-lg border border-border/50 transition-all">
                            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                              <div className="w-7 h-7 bg-white border-2 border-primary rounded-lg flex items-center justify-center font-black text-primary text-xs shadow-sm">
                                {option.number}
                              </div>
                              <div className="flex-1 w-full">
                                <label className="text-[8px] font-black uppercase text-muted-foreground mb-0.5 block">Texto</label>
                                <input 
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => {
                                    const newMenus = { ...flowData.menus };
                                    newMenus[selectedMenuId].options[index].text = e.target.value;
                                    setFlowData({ ...flowData, menus: newMenus });
                                  }}
                                  className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-0.5 font-bold text-xs transition-all"
                                />
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto justify-end">
                                {option.number !== 0 && (
                                  <button 
                                    onClick={() => {
                                      if (option.nextMenuId) {
                                        setSelectedMenuId(option.nextMenuId);
                                      } else {
                                        createNextStep(option.id);
                                      }
                                    }}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs transition-all ${option.nextMenuId ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                                  >
                                    <ChevronRight className="w-4 h-4" /> {option.nextMenuId ? 'Editar Resposta' : 'Criar Resposta'}
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    const newMenus = { ...flowData.menus };
                                    newMenus[selectedMenuId].options = newMenus[selectedMenuId].options.filter(o => o.id !== option.id);
                                    setFlowData({ ...flowData, menus: newMenus });
                                  }}
                                  className="p-3 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive hover:text-white transition-all"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reset Preview Button */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handlePreviewReset}
                      className="px-6 py-3 bg-muted text-muted-foreground rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-primary hover:text-white transition-all"
                    >
                      <RefreshCw className="w-4 h-4" /> Reiniciar Preview
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
