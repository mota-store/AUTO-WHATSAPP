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
  Send,
  Wand2,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Clock,
  Keyboard,
  X,
  Play,
  Layers,
  Activity,
  Info
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import FlowGenerator from '../components/FlowGenerator'

interface MenuOption {
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

interface MenuNode {
  id: string
  title: string
  message: string
  options: MenuOption[]
  delay?: number
  isTyping?: boolean
  isRecording?: boolean
}

interface MenuFlowData {
  rootMenuId: string
  menus: Record<string, MenuNode>
}

interface ChatMessage {
  type: 'user' | 'bot'
  text: string
  attachmentName?: string
  attachmentData?: string
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [botAvatar, setBotAvatar] = useState<string>('')
  const [showGenerator, setShowGenerator] = useState(false)

  // Preview chat state
  const [previewCurrentMenuId, setPreviewCurrentMenuId] = useState<string>('')
  const [previewMessages, setPreviewMessages] = useState<ChatMessage[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const [isPreviewTyping, setIsPreviewTyping] = useState(false)
  const [isPreviewRecording, setIsPreviewRecording] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flowId) {
      loadFlow()
    }
    loadBotAvatar()

    // Abrir gerador automático se solicitado
    const params = new URLSearchParams(window.location.search)
    if (params.get('openGenerator') === 'true') {
      setShowGenerator(true)
    }
  }, [flowId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [previewMessages])

  useEffect(() => {
    if (previewMode && flowData.rootMenuId) {
      const rootMenu = flowData.menus[flowData.rootMenuId]
      if (rootMenu) {
        setPreviewCurrentMenuId(flowData.rootMenuId)
        handleBotResponse(rootMenu)
      }
    } else {
      setPreviewMessages([])
      setIsPreviewTyping(false)
      setIsPreviewRecording(false)
    }
  }, [previewMode])

  const handleBotResponse = async (menu: MenuNode, responseText?: string, attachmentName?: string, attachmentData?: string, delay?: number, isTyping?: boolean, isRecording?: boolean) => {
    const waitTime = (delay || menu.delay || 0) * 1000
    if (waitTime > 0 || isTyping || menu.isTyping || isRecording || menu.isRecording) {
      if (isRecording || menu.isRecording) setIsPreviewRecording(true)
      else setIsPreviewTyping(true)
      await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 1000)))
      setIsPreviewTyping(false)
      setIsPreviewRecording(false)
    }

    const newMessages: ChatMessage[] = []
    if (responseText || attachmentName) {
      newMessages.push({ type: 'bot', text: responseText || '', attachmentName, attachmentData })
    }
    newMessages.push({ type: 'bot', text: menu.message })
    setPreviewMessages(prev => [...prev, ...newMessages])
  }

  const loadBotAvatar = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.avatar) setBotAvatar(data.avatar)
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

  const handleSave = async (isAuto = false) => {
    if (!flowName.trim() || !flowId) return

    if (!isAuto) setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${flowId}`, {
        method: 'PUT',
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
        setLastSaved(new Date())
        if (!isAuto) {
          toast.success('Salvo com sucesso!')
          navigate('/flows')
        }
      }
    } catch (error) {
      if (!isAuto) toast.error('Erro ao salvar')
    } finally {
      if (!isAuto) setIsSaving(false)
    }
  }

  // Lógica de Auto-Save
  useEffect(() => {
    if (isLoading || !flowId) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true)
    }, 2000) // Salva 2 segundos após a última alteração

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [flowData, flowName, flowDescription])

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

  const handlePreviewOptionClick = async (option: MenuOption) => {
    if (!flowData || isPreviewTyping || isPreviewRecording) return
    const currentMenu = flowData.menus[previewCurrentMenuId]
    if (!currentMenu) return
    setPreviewMessages(prev => [...prev, { type: 'user', text: option.number.toString() }])
    if (option.nextMenuId && flowData.menus[option.nextMenuId]) {
      const nextMenu = flowData.menus[option.nextMenuId]
      setPreviewCurrentMenuId(option.nextMenuId)
      await handleBotResponse(nextMenu, option.response, option.attachmentName, option.attachmentData, option.delay, option.isTyping, option.isRecording)
    } else if (option.response || option.attachmentName) {
      await handleBotResponse(currentMenu, option.response, option.attachmentName, option.attachmentData, option.delay, option.isTyping, option.isRecording)
    }
  }

  const handlePreviewSend = () => {
    if (!previewInput.trim() || !flowData) return

    const trimmed = previewInput.trim().toLowerCase()
    const currentMenu = flowData.menus[previewCurrentMenuId]
    if (!currentMenu) {
      setPreviewInput('')
      return
    }

    const numMatch = currentMenu.options.find(opt => opt.number.toString() === trimmed)
    if (numMatch) {
      handlePreviewOptionClick(numMatch)
      setPreviewInput('')
      return
    }

    const textMatch = currentMenu.options.find(opt => 
      opt.text.toLowerCase().includes(trimmed) || trimmed.includes(opt.text.toLowerCase())
    )
    if (textMatch) {
      handlePreviewOptionClick(textMatch)
      setPreviewInput('')
      return
    }

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

  const handleGenerate = (newFlowData: MenuFlowData) => {
    setFlowData(newFlowData)
    if (newFlowData.rootMenuId) {
      setSelectedMenuId(newFlowData.rootMenuId)
    }
    toast.success('Fluxo gerado com sucesso!')
  }

  const selectedMenu = flowData.menus[selectedMenuId]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <Zap className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans selection:bg-primary/30">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-4 lg:p-8 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Profissional */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-zinc-800/50 shadow-2xl">
            <div className="flex items-center gap-5">
              <button onClick={() => navigate('/flows')} className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-all group">
                <ChevronLeft className="w-6 h-6 text-zinc-400 group-hover:text-white" />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-black tracking-tight">{flowName || 'Novo Atendimento'}</h1>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">Editor Pro</span>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                     <Layers className="w-3.5 h-3.5" /> {Object.keys(flowData.menus).length} Etapas
                   </div>
                   <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                     <Activity className="w-3.5 h-3.5" /> Ativo
                   </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={() => setShowGenerator(true)}
                className="flex-1 md:flex-none px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Wand2 className="w-4 h-4 text-primary" /> Gerador Mágico
              </button>
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex-1 md:flex-none px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${previewMode ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {previewMode ? <ChevronLeft className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? 'Sair do Teste' : 'Testar Fluxo'}
              </button>
              <div className="flex flex-col items-end gap-1">
                <button 
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="w-full md:w-auto px-6 py-3 bg-primary text-black rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sair e Salvar
                </button>
                {lastSaved && (
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mr-2 animate-pulse">
                    ✓ Auto-salvo às {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Sidebar de Etapas (Node-like) */}
            <div className={`${previewMode ? 'hidden' : 'lg:col-span-3'} space-y-4`}>
              {/* Configurações do Fluxo */}
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] p-6 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2 px-1">
                  <Settings className="w-3 h-3" /> Configurações
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Nome do Fluxo</label>
                    <input 
                      type="text"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                      placeholder="Ex: Atendimento Loja"
                      className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Descrição</label>
                    <textarea 
                      value={flowDescription}
                      onChange={(e) => setFlowDescription(e.target.value)}
                      placeholder="Breve descrição..."
                      className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-primary outline-none transition-all h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] p-5 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2 px-1">
                  <Layers className="w-3 h-3" /> Mapa de Navegação
                </h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.values(flowData.menus).map(menu => (
                    <button 
                      key={menu.id}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border group relative ${
                        selectedMenuId === menu.id 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : 'border-zinc-800/50 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800/30'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className={`text-[11px] font-black truncate ${selectedMenuId === menu.id ? 'text-primary' : 'text-zinc-300'}`}>
                            {menu.id === flowData.rootMenuId ? 'Menu Principal' : menu.title}
                          </span>
                          <span className="text-[9px] font-bold opacity-50 truncate">
                            {menu.options.length} opções • {menu.message.substring(0, 20)}...
                          </span>
                        </div>
                        {menu.id === flowData.rootMenuId && (
                          <div className="shrink-0 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    const newId = `menu_${Date.now()}`
                    const newMenus = { ...flowData.menus }
                    newMenus[newId] = {
                      id: newId,
                      title: 'Nova Etapa',
                      message: 'Escreva sua mensagem aqui...',
                      options: []
                    }
                    setFlowData({ ...flowData, menus: newMenus })
                    setSelectedMenuId(newId)
                  }}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-dashed border-zinc-700"
                >
                  <Plus className="w-3 h-3" /> Adicionar Etapa
                </button>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Dica Pro</h4>
                </div>
                <p className="text-[11px] font-bold text-zinc-500 leading-relaxed">
                  Use os controles de <span className="text-zinc-300">Humanização</span> para fazer o robô parecer uma pessoa real.
                </p>
              </div>
            </div>

            {/* Área de Edição (Cards de Elite) */}
            <div className={`${previewMode ? 'lg:col-span-12' : 'lg:col-span-9'}`}>
              {previewMode ? (
                /* Preview WhatsApp Profissional */
                <div className="flex justify-center py-4 bg-zinc-900/20 rounded-[3rem] border-2 border-dashed border-zinc-800/50">
                  <div className="w-full max-w-[380px] bg-[#0b141a] rounded-[3rem] border-[12px] border-zinc-900 shadow-2xl overflow-hidden flex flex-col h-[650px] relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-20"></div>
                    
                    {/* WA Header */}
                    <div className="bg-[#202c33] p-5 pt-8 flex items-center gap-3 border-b border-white/5">
                      <div className="relative">
                        {botAvatar ? (
                          <img src={botAvatar} alt="Bot" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black font-black">M</div>
                        )}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#202c33] rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm tracking-tight">MOTA-FLOW</p>
                        <p className="text-emerald-500 text-[10px] font-bold">
                          {isPreviewTyping ? 'Digitando...' : isPreviewRecording ? 'Gravando áudio...' : 'Online'}
                        </p>
                      </div>
                    </div>

                    {/* WA Chat */}
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                      {previewMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`px-3 py-2 rounded-2xl shadow-lg max-w-[85%] relative ${
                              msg.type === 'user' ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-white rounded-tl-none'
                            }`}>
                            {msg.attachmentData && (
                              <div className="mb-2 rounded-xl overflow-hidden bg-black/20 p-1 border border-white/5">
                                {msg.attachmentName?.toLowerCase().match(/\.(jpg|jpeg|png)$/) ? (
                                  <img src={msg.attachmentData} alt="Anexo" className="w-full h-auto rounded-lg" />
                                ) : msg.attachmentName?.toLowerCase().match(/\.(mp4)$/) ? (
                                  <div className="bg-black aspect-video flex items-center justify-center rounded-lg">
                                    <Play className="w-10 h-10 text-white/30 fill-white/30" />
                                  </div>
                                ) : msg.attachmentName?.toLowerCase().match(/\.(mp3|ogg|wav)$/) ? (
                                  <div className="bg-[#111b21] p-3 flex items-center gap-3 rounded-lg min-w-[200px]">
                                    <div className="relative">
                                      <Mic className="w-5 h-5 text-zinc-400" />
                                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#111b21]"></div>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex gap-0.5 items-end h-4">
                                        {[...Array(15)].map((_, i) => (
                                          <div key={i} className="w-0.5 bg-zinc-600 rounded-full" style={{ height: `${Math.random() * 100}%` }}></div>
                                        ))}
                                      </div>
                                      <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase">
                                        <span>0:12</span>
                                        <span>Hoje</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-[#111b21] flex items-center gap-3 rounded-lg">
                                    <FileText className="w-6 h-6 text-primary" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black truncate max-w-[150px]">{msg.attachmentName}</span>
                                      <span className="text-[8px] font-bold text-zinc-500 uppercase">Documento</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            <span className="text-[9px] text-white/40 block text-right mt-1 font-bold">05:30</span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* WA Input */}
                    <div className="bg-[#202c33] p-4 flex gap-3 items-center border-t border-white/5">
                      <div className="flex-1 bg-[#2a3942] rounded-full px-5 py-3 flex items-center">
                        <input 
                          type="text" 
                          placeholder="Digite uma mensagem"
                          value={previewInput}
                          onChange={(e) => setPreviewInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePreviewSend()}
                          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                        />
                      </div>
                      <button 
                        onClick={handlePreviewSend}
                        className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-black shrink-0 shadow-lg shadow-primary/20 active:scale-90 transition-all"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editor Visual por Cards */
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
                  
                  {/* Card Principal da Etapa */}
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-primary/10 rounded-xl">
                            <MessageSquare className="w-5 h-5 text-primary" />
                          </div>
                          <h2 className="text-2xl font-black tracking-tight">{selectedMenu.title}</h2>
                        </div>
                        <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest ml-1">Configuração da Resposta Automática</p>
                      </div>
                      
                      {/* Controles de Humanização (UI Elite) */}
                      <div className="flex items-center gap-2 bg-black/40 p-2 rounded-[1.5rem] border border-zinc-800/50 shadow-inner">
                        <div className="flex items-center gap-3 px-4 border-r border-zinc-800/50 group/delay">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Pausa (Seg)</span>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <input 
                                type="number" 
                                value={selectedMenu.delay || 0}
                                onChange={(e) => {
                                  const newMenus = { ...flowData.menus };
                                  newMenus[selectedMenuId].delay = parseInt(e.target.value);
                                  setFlowData({ ...flowData, menus: newMenus });
                                }}
                                className="w-8 bg-transparent text-sm font-black outline-none text-white"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1 px-2">
                          <button 
                            onClick={() => {
                              const newMenus = { ...flowData.menus };
                              newMenus[selectedMenuId].isTyping = !newMenus[selectedMenuId].isTyping;
                              if (newMenus[selectedMenuId].isTyping) newMenus[selectedMenuId].isRecording = false;
                              setFlowData({ ...flowData, menus: newMenus });
                            }}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${selectedMenu.isTyping ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
                          >
                            <Keyboard className="w-4 h-4" />
                            <span className="text-[7px] font-black uppercase tracking-tighter">Digitando</span>
                          </button>
                          <button 
                            onClick={() => {
                              const newMenus = { ...flowData.menus };
                              newMenus[selectedMenuId].isRecording = !newMenus[selectedMenuId].isRecording;
                              if (newMenus[selectedMenuId].isRecording) newMenus[selectedMenuId].isTyping = false;
                              setFlowData({ ...flowData, menus: newMenus });
                            }}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${selectedMenu.isRecording ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
                          >
                            <Mic className="w-4 h-4" />
                            <span className="text-[7px] font-black uppercase tracking-tighter">Gravando</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 ml-1">
                          <Send className="w-3 h-3" /> Conteúdo da Mensagem
                        </label>
                        <textarea 
                          value={selectedMenu.message}
                          onChange={(e) => {
                            const newMenus = { ...flowData.menus };
                            newMenus[selectedMenuId].message = e.target.value;
                            setFlowData({ ...flowData, menus: newMenus });
                          }}
                          className="w-full px-6 py-5 bg-black/40 border border-zinc-800/50 rounded-3xl font-medium h-32 focus:border-primary outline-none transition-all text-base shadow-inner placeholder:text-zinc-700"
                          placeholder="Ex: Olá! Escolha uma das opções abaixo para continuarmos..."
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-800/50">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Opções de Interação</h3>
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
                          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-black transition-all border border-primary/20 shadow-lg shadow-primary/5"
                        >
                          <Plus className="w-4 h-4" /> Nova Opção
                        </button>
                      </div>

                      {/* Lista de Opções (Cards Filhos) */}
                      <div className="grid grid-cols-1 gap-4">
                        {selectedMenu.options.map((option, index) => (
                          <div key={option.id} className="group bg-zinc-900/60 hover:bg-zinc-800/40 p-5 rounded-3xl border border-zinc-800/50 transition-all hover:shadow-xl hover:shadow-black/20">
                            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                              <div className="w-10 h-10 bg-black border-2 border-primary rounded-2xl flex items-center justify-center font-black text-primary text-sm shadow-xl shadow-primary/10">
                                {option.number}
                              </div>
                              
                              <div className="flex-1 w-full space-y-1">
                                <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest ml-1">Texto da Opção</label>
                                <input 
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => {
                                    const newMenus = { ...flowData.menus };
                                    newMenus[selectedMenuId].options[index].text = e.target.value;
                                    setFlowData({ ...flowData, menus: newMenus });
                                  }}
                                  className="w-full bg-transparent border-b border-zinc-800 focus:border-primary outline-none py-1 font-black text-sm transition-all text-zinc-200"
                                />
                              </div>

                              <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto items-center">
                                
                                {/* Controles de Humanização da Opção */}
                                <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-zinc-800/50">
                                  <div className="flex items-center gap-1 px-2 border-r border-zinc-800/50">
                                    <Clock className="w-3 h-3 text-primary" />
                                    <input 
                                      type="number" 
                                      value={option.delay || 0}
                                      onChange={(e) => {
                                        const newMenus = { ...flowData.menus };
                                        newMenus[selectedMenuId].options[index].delay = parseInt(e.target.value);
                                        setFlowData({ ...flowData, menus: newMenus });
                                      }}
                                      className="w-6 bg-transparent text-[10px] font-black outline-none text-white"
                                    />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const newMenus = { ...flowData.menus };
                                      newMenus[selectedMenuId].options[index].isTyping = !newMenus[selectedMenuId].options[index].isTyping;
                                      if (newMenus[selectedMenuId].options[index].isTyping) newMenus[selectedMenuId].options[index].isRecording = false;
                                      setFlowData({ ...flowData, menus: newMenus });
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${option.isTyping ? 'bg-primary text-black' : 'text-zinc-600'}`}
                                    title="Digitando"
                                  >
                                    <Keyboard className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const newMenus = { ...flowData.menus };
                                      newMenus[selectedMenuId].options[index].isRecording = !newMenus[selectedMenuId].options[index].isRecording;
                                      if (newMenus[selectedMenuId].options[index].isRecording) newMenus[selectedMenuId].options[index].isTyping = false;
                                      setFlowData({ ...flowData, menus: newMenus });
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${option.isRecording ? 'bg-primary text-black' : 'text-zinc-600'}`}
                                    title="Gravando Áudio"
                                  >
                                    <Mic className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Sistema de Mídia da Opção */}
                                <div className="relative">
                                  {option.attachmentName ? (
                                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-2xl border border-emerald-500/20 max-w-[150px] group/file relative">
                                      {option.attachmentName.toLowerCase().match(/\.(jpg|jpeg|png)$/) ? <ImageIcon className="w-4 h-4 shrink-0" /> : 
                                       option.attachmentName.toLowerCase().match(/\.(mp3|ogg|wav)$/) ? <Mic className="w-4 h-4 shrink-0" /> :
                                       option.attachmentName.toLowerCase().match(/\.(mp4)$/) ? <Video className="w-4 h-4 shrink-0" /> :
                                       <FileText className="w-4 h-4 shrink-0" />}
                                      <span className="text-[10px] font-black truncate">{option.attachmentName}</span>
                                      <button 
                                        onClick={() => {
                                          const newMenus = { ...flowData.menus };
                                          newMenus[selectedMenuId].options[index].attachmentName = undefined;
                                          newMenus[selectedMenuId].options[index].attachmentData = undefined;
                                          setFlowData({ ...flowData, menus: newMenus });
                                        }}
                                        className="hover:text-red-500 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                      
                                      {/* Preview Real ao passar o mouse */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl opacity-0 pointer-events-none group-hover/file:opacity-100 transition-all z-50">
                                        {option.attachmentData && (
                                          <div className="rounded-xl overflow-hidden">
                                            {option.attachmentName.toLowerCase().match(/\.(jpg|jpeg|png)$/) ? (
                                              <img src={option.attachmentData} alt="Preview" className="w-full h-auto" />
                                            ) : option.attachmentName.toLowerCase().match(/\.(mp3|ogg|wav)$/) ? (
                                              <div className="p-3 bg-black/40 flex items-center gap-3">
                                                <Play className="w-4 h-4 text-primary" />
                                                <div className="flex-1 h-1 bg-zinc-800 rounded-full"></div>
                                              </div>
                                            ) : (
                                              <div className="p-3 text-[10px] font-bold text-center text-zinc-500">Preview não disponível</div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-700 cursor-pointer transition-all border border-zinc-700/50">
                                      <ImageIcon className="w-4 h-4" /> Anexar
                                      <input 
                                        type="file" 
                                        accept=".txt,.jpg,.jpeg,.png,.mp3,.mp4,.pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (file.size > 5 * 1024 * 1024) {
                                              toast.error('Arquivo muito grande (máx 5MB)');
                                              return;
                                            }
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                              const data = event.target?.result as string;
                                              const newMenus = { ...flowData.menus };
                                              newMenus[selectedMenuId].options[index].attachmentName = file.name;
                                              newMenus[selectedMenuId].options[index].attachmentData = data;
                                              setFlowData({ ...flowData, menus: newMenus });
                                              toast.success(`${file.name} anexado!`);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  {option.number !== 0 && (
                                    <button 
                                      onClick={() => {
                                        if (option.nextMenuId) {
                                          setSelectedMenuId(option.nextMenuId);
                                        } else {
                                          createNextStep(option.id);
                                        }
                                      }}
                                      className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all ${option.nextMenuId ? 'bg-primary text-black shadow-xl shadow-primary/20' : 'bg-primary/10 text-primary hover:bg-primary hover:text-black'}`}
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
                                    className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Botão Reiniciar Preview */}
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={handlePreviewReset}
                      className="px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all border border-zinc-800/50 shadow-xl active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" /> Reiniciar Simulação de Teste
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <FlowGenerator 
        isOpen={showGenerator} 
        onClose={() => setShowGenerator(false)} 
        onGenerate={handleGenerate} 
      />
    </div>
  )
}
