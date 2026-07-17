import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Save, ChevronRight, Reply, List, Smartphone, Send, RefreshCw } from 'lucide-react'

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
        title: 'Menu Principal',
        message: '👋 Olá! Seja muito bem-vindo(a). Como podemos ajudar hoje?',
        options: [
          { id: 'opt_1', number: 1, text: 'Produtos', response: '' },
          { id: 'opt_2', number: 2, text: 'Promoções', response: '' },
          { id: 'opt_3', number: 3, text: 'Dúvidas Frequentes (FAQ)', response: '' },
          { id: 'opt_4', number: 4, text: 'Falar com um Atendente', response: 'Perfeito! Descreva sua dúvida com o máximo de detalhes possível.\n\nNossa equipe responderá assim que um atendente estiver disponível.\n\n⏰ Horário: Seg-Sex, 08h às 18h\n\n🙏 Obrigado por escolher a Mota Store!' },
        ],
      },
    },
  })
  const [selectedMenuId, setSelectedMenuId] = useState('menu_1')
  const [navigationHistory, setNavigationHistory] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!flowId)
  const [previewMode, setPreviewMode] = useState<'editor' | 'preview'>('editor')

  // Estado da simulação de conversa no preview
  const [chatMessages, setChatMessages] = useState<Array<{ type: 'bot' | 'client', text: string }>>([])
  const [currentMenuId, setCurrentMenuId] = useState<string>('')

  useEffect(() => {
    if (flowId) {
      loadFlow()
    }
  }, [flowId])

  // Iniciar preview do menu raiz
  useEffect(() => {
    if (previewMode === 'preview' && flowData.rootMenuId) {
      resetChat()
    }
  }, [previewMode, flowData.rootMenuId])

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
      } else {
        toast.error('Erro ao carregar fluxo')
        navigate('/dashboard')
      }
    } catch (error) {
      toast.error('Erro ao conectar ao servidor')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedMenu = flowData.menus[selectedMenuId]

  // Resetar chat para o menu raiz
  const resetChat = () => {
    const rootMenu = flowData.menus[flowData.rootMenuId]
    if (!rootMenu) return

    const optionsText = rootMenu.options
      .map(opt => `${opt.number}. ${opt.text}`)
      .join('\n')

    setChatMessages([
      { type: 'bot', text: `${rootMenu.message}\n\n${optionsText}` },
    ])
    setCurrentMenuId(flowData.rootMenuId)
  }

  // Simular cliente digitando uma opção
  const handleClientChoice = (option: MenuOption) => {
    if (option.nextMenuId) {
      // Navegar para sub-menu
      const nextMenu = flowData.menus[option.nextMenuId]
      if (!nextMenu) return

      const optionsText = nextMenu.options
        .map(opt => `${opt.number}. ${opt.text}`)
        .join('\n')

      setChatMessages(prev => [
        ...prev,
        { type: 'client', text: String(option.number) },
        { type: 'bot', text: `${nextMenu.message}\n\n${optionsText}` },
      ])
      setCurrentMenuId(option.nextMenuId)
    } else if (option.response) {
      // Resposta final
      setChatMessages(prev => [
        ...prev,
        { type: 'client', text: String(option.number) },
        { type: 'bot', text: option.response! },
      ])
    } else {
      // Opção sem resposta e sem sub-menu
      setChatMessages(prev => [
        ...prev,
        { type: 'client', text: String(option.number) },
        { type: 'bot', text: 'Obrigado por entrar em contato!' },
      ])
    }
  }

  const addOption = () => {
    if (!selectedMenu) return
    const newNumber = selectedMenu.options.length + 1
    const newOption: MenuOption = {
      id: `opt_${Date.now()}`,
      number: newNumber,
      text: `Opção ${newNumber}`,
      response: '',
    }

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: [...selectedMenu.options, newOption],
        },
      },
    })
  }

  const updateOption = (optionId: string, field: string, value: any) => {
    if (!selectedMenu) return
    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.map((opt) =>
            opt.id === optionId ? { ...opt, [field]: value } : opt
          ),
        },
      },
    })
  }

  const deleteOption = (optionId: string) => {
    if (!selectedMenu) return
    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.filter((opt) => opt.id !== optionId),
        },
      },
    })
  }

  const createSubMenu = (optionId: string) => {
    const option = selectedMenu.options.find(opt => opt.id === optionId)
    if (!option) return

    const newMenuId = `menu_${Date.now()}`
    const newMenu: MenuNode = {
      id: newMenuId,
      title: `Sub-menu: ${option.text}`,
      message: `Você selecionou "${option.text}". Escolha uma opção abaixo:`,
      options: [
        {
          id: `opt_back_${Date.now()}`,
          number: 0,
          text: 'Voltar ao menu anterior',
          nextMenuId: selectedMenuId,
          response: '',
        },
      ],
    }

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [newMenuId]: newMenu,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.map(opt =>
            opt.id === optionId ? { ...opt, nextMenuId: newMenuId, response: '' } : opt
          ),
        },
      },
    })

    navigateToMenu(newMenuId)
    toast.success('Sub-menu criado com sucesso!')
  }

  const navigateToMenu = (menuId: string) => {
    if (!flowData.menus[menuId]) return
    setNavigationHistory([...navigationHistory, selectedMenuId])
    setSelectedMenuId(menuId)
  }

  const goBack = () => {
    if (navigationHistory.length === 0) return
    const newHistory = [...navigationHistory]
    const lastMenuId = newHistory.pop()
    if (lastMenuId) {
      setSelectedMenuId(lastMenuId)
      setNavigationHistory(newHistory)
    }
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error('Nome do fluxo é obrigatório')
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
        toast.success(flowId ? 'Fluxo atualizado!' : 'Fluxo criado!')
        navigate('/dashboard')
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Erro ao salvar fluxo')
      }
    } catch (error) {
      toast.error('Erro ao conectar ao servidor')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Premium */}
      <header className="bg-card/80 border-b border-border sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition btn-touch min-h-[44px] px-3 py-2 rounded-xl hover:bg-muted/50"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline font-bold">Dashboard</span>
            </button>
            <div className="h-6 w-[1px] bg-border hidden sm:block"></div>
            <div>
              <h1 className="text-xl font-black gradient-text-whatsapp">Editor de Fluxos</h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                {selectedMenuId === flowData.rootMenuId ? 'MENU PRINCIPAL' : `SUB-MENU NÍVEL ${navigationHistory.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Preview Toggle */}
            <button
              onClick={() => setPreviewMode(previewMode === 'editor' ? 'preview' : 'editor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition btn-touch min-h-[44px] font-bold text-sm ${
                previewMode === 'preview'
                  ? 'bg-primary text-white shadow-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">{previewMode === 'editor' ? 'Pré-visualizar' : 'Editar'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition disabled:opacity-50 font-bold shadow-primary btn-touch min-h-[44px]"
            >
              <Save className="w-5 h-5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Configurações */}
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-black text-foreground text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <List className="w-4 h-4 text-primary" /> Menus
              </h2>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {Object.values(flowData.menus).map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setNavigationHistory([...navigationHistory, selectedMenuId])
                      setSelectedMenuId(menu.id)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition btn-touch ${
                      selectedMenuId === menu.id
                        ? 'bg-primary text-white font-black shadow-sm'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{menu.title}</span>
                      {menu.id === flowData.rootMenuId && (
                        <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full">INÍCIO</span>
                      )}
                    </div>
                    <p className="text-[10px] opacity-60 mt-1">{menu.options.length} opções</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-black text-foreground text-sm uppercase tracking-wider mb-4">Fluxo</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder="Ex: Menu de Vendas"
                    className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl input-focus font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={flowDescription}
                    onChange={(e) => setFlowDescription(e.target.value)}
                    placeholder="Para que serve este fluxo?"
                    className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl input-focus font-medium text-sm resize-none h-20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            {previewMode === 'preview' ? (
              /* Preview Mode - Simulação conversa WhatsApp REAL */
              <div className="glass-card rounded-2xl overflow-hidden animate-in fade-in duration-300">
                {/* Header do "celular" */}
                <div className="bg-[#075E54] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => resetChat()}
                      className="text-white/80 hover:text-white transition flex items-center gap-1 text-xs font-bold"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <Send className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{flowName || 'MOTA-FLOW'}</p>
                      <p className="text-white/60 text-[10px]">online</p>
                    </div>
                  </div>
                  <button
                    onClick={resetChat}
                    className="text-white/60 hover:text-white transition p-1 btn-touch"
                    title="Reiniciar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Corpo da conversa - fundo WhatsApp */}
                <div
                  className="px-3 py-4 min-h-[450px] max-h-[600px] overflow-y-auto space-y-2 custom-scrollbar"
                  style={{
                    backgroundColor: '#0B141A',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                  }}
                >
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.type === 'client' ? 'justify-end' : 'justify-start'}`}>
                      {msg.type === 'bot' ? (
                        <div
                          className="rounded-lg px-3 py-2 max-w-[85%] text-sm"
                          style={{ backgroundColor: '#202C33' }}
                        >
                          <p className="text-white/90 whitespace-pre-line leading-relaxed text-[13px]">
                            {msg.text}
                          </p>
                        </div>
                      ) : (
                        <div
                          className="rounded-lg px-3 py-2 max-w-[85%] text-sm"
                          style={{ backgroundColor: '#005C4B' }}
                        >
                          <p className="text-white whitespace-pre-line text-[13px]">
                            {msg.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Área de input - simular digitação */}
                <div className="bg-[#202C33] px-3 py-3 border-t border-[#2A3942]">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-2 text-center">
                    Selecione uma opção (simulação)
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentMenuId && flowData.menus[currentMenuId]?.options?.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleClientChoice(option)}
                        className="px-3 py-1.5 bg-[#2A3942] text-white/70 text-xs font-medium rounded-full hover:bg-[#005C4B] hover:text-white transition btn-touch min-h-[36px]"
                      >
                        {option.number}. {option.text}
                      </button>
                    ))}
                    {currentMenuId && (
                      <button
                        onClick={resetChat}
                        className="px-3 py-1.5 bg-primary/20 text-primary text-xs font-bold rounded-full hover:bg-primary hover:text-white transition btn-touch min-h-[36px]"
                      >
                        ↺ Reiniciar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedMenu ? (
              /* Editor Mode */
              <div className="glass-card rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Menu Title Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    {navigationHistory.length > 0 && (
                      <button
                        onClick={goBack}
                        className="p-2 bg-muted/50 hover:bg-muted rounded-xl transition text-muted-foreground hover:text-primary btn-touch min-h-[44px]"
                        title="Voltar"
                      >
                        <Reply className="w-5 h-5" />
                      </button>
                    )}
                    <div>
                      <h2 className="text-lg font-black text-foreground">{selectedMenu.title}</h2>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        ID: {selectedMenu.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-black rounded-full border border-primary/20 uppercase">
                      Nível {navigationHistory.length + 1}
                    </span>
                  </div>
                </div>

                {/* Bot Message Preview */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="w-3 h-3 text-primary" />
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      Mensagem do Bot
                    </label>
                  </div>
                  <textarea
                    value={selectedMenu.message}
                    onChange={(e) =>
                      setFlowData({
                        ...flowData,
                        menus: {
                          ...flowData.menus,
                          [selectedMenuId]: {
                            ...selectedMenu,
                            message: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Olá! Como posso ajudar? Digite o número da opção desejada:"
                    className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl input-focus text-sm resize-none h-28 leading-relaxed"
                  />
                </div>

                {/* Options Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                      Opções <span className="text-[10px] font-normal text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{selectedMenu.options.length}</span>
                    </h3>
                    <button
                      onClick={addOption}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition text-xs font-black border border-primary/20 btn-touch min-h-[44px]"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Opção
                    </button>
                  </div>

                  <div className="space-y-4">
                    {selectedMenu.options.map((option) => (
                      <div
                        key={option.id}
                        className="bg-muted/20 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition card-hover"
                      >
                        {/* Header da Opção */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <div className="w-12">
                            <label className="block text-[9px] font-black text-muted-foreground uppercase mb-1">Nº</label>
                            <input
                              type="number"
                              value={option.number}
                              onChange={(e) => updateOption(option.id, 'number', parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-background/50 border border-border rounded-xl text-sm font-black focus:ring-2 focus:ring-primary outline-none text-center"
                            />
                          </div>
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-[9px] font-black text-muted-foreground uppercase mb-1">Texto</label>
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                              placeholder="Ex: Falar com Vendas"
                              className="w-full px-3 py-2 bg-background/50 border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            {option.nextMenuId ? (
                              <button
                                onClick={() => navigateToMenu(option.nextMenuId!)}
                                className="flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition btn-touch min-h-[44px]"
                              >
                                <ChevronRight className="w-3 h-3" /> Editar
                              </button>
                            ) : (
                              <button
                                onClick={() => createSubMenu(option.id)}
                                className="flex items-center gap-1 px-3 py-2 bg-muted hover:bg-muted/80 border border-dashed border-border rounded-xl text-xs font-medium transition text-muted-foreground hover:text-primary btn-touch min-h-[44px]"
                              >
                                <Plus className="w-3 h-3" /> Sub-menu
                              </button>
                            )}
                            <button
                              onClick={() => deleteOption(option.id)}
                              className="p-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl transition btn-touch"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Ação e Resposta */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Status da Ação */}
                          <div className="space-y-2">
                            <label className="block text-[9px] font-black text-muted-foreground uppercase">Ação</label>
                            {option.nextMenuId ? (
                              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                <div className="flex items-center gap-2 text-primary">
                                  <ChevronRight className="w-4 h-4" />
                                  <span className="text-xs font-bold">{flowData.menus[option.nextMenuId]?.title || 'Menu'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-muted/30 border border-border/50 rounded-xl text-xs text-muted-foreground">
                                Nenhuma ação configurada
                              </div>
                            )}
                          </div>

                          {/* Resposta */}
                          <div className="space-y-2">
                            <label className="block text-[9px] font-black text-muted-foreground uppercase">Resposta</label>
                            <textarea
                              value={option.response || ''}
                              onChange={(e) => updateOption(option.id, 'response', e.target.value)}
                              disabled={!!option.nextMenuId}
                              placeholder={option.nextMenuId
                                ? 'Desabilitado (sub-menu configurado)'
                                : 'O bot responderá este texto...'}
                              className="w-full px-3 py-2 bg-background/50 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none transition resize-none h-20 disabled:opacity-40 disabled:bg-muted/10"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground text-lg">Selecione um menu para editar</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
