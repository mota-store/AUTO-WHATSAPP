import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Save, ChevronRight, Reply, List } from 'lucide-react'

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
        message: '👋 Olá! Bem-vindo. Escolha uma opção:',
        options: [
          { id: 'opt_1', number: 1, text: 'Opção 1', response: 'Você escolheu a opção 1' },
          { id: 'opt_2', number: 2, text: 'Opção 2', response: 'Você escolheu a opção 2' },
        ],
      },
    },
  })
  const [selectedMenuId, setSelectedMenuId] = useState('menu_1')
  const [navigationHistory, setNavigationHistory] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!flowId)

  useEffect(() => {
    if (flowId) {
      loadFlow()
    }
  }, [flowId])

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

  const addOption = () => {
    if (!selectedMenu) return

    const newOption: MenuOption = {
      id: `opt_${Date.now()}`,
      number: selectedMenu.options.length + 1,
      text: `Opção ${selectedMenu.options.length + 1}`,
      response: `Resposta para opção ${selectedMenu.options.length + 1}`,
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
      title: `Sub-menu de: ${option.text}`,
      message: `Você está no sub-menu de ${option.text}. Escolha uma opção:`,
      options: [
        { 
          id: `opt_back_${Date.now()}`, 
          number: 0, 
          text: 'Voltar ao menu anterior', 
          nextMenuId: selectedMenuId 
        }
      ]
    }

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [newMenuId]: newMenu,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.map(opt => 
            opt.id === optionId ? { ...opt, nextMenuId: newMenuId, response: undefined } : opt
          )
        }
      }
    })

    // Navegar para o novo menu
    navigateToMenu(newMenuId)
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
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10 backdrop-blur-md bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition btn-touch"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="h-6 w-[1px] bg-border hidden sm:block"></div>
            <h1 className="text-xl font-bold gradient-text-whatsapp">Editor de Fluxos</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition disabled:opacity-50 font-bold shadow-primary btn-touch"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Fluxo'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Menu List & Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 glass-card">
              <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <List className="w-4 h-4 text-primary" /> Menus Criados
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.values(flowData.menus).map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setNavigationHistory([...navigationHistory, selectedMenuId])
                      setSelectedMenuId(menu.id)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedMenuId === menu.id
                        ? 'bg-primary text-white font-bold'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {menu.title}
                    {menu.id === flowData.rootMenuId && <span className="ml-2 text-[10px] opacity-70">(Início)</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 glass-card">
              <h2 className="font-bold text-foreground mb-4">Configurações</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Nome do Fluxo
                  </label>
                  <input
                    type="text"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder="Ex: Menu de Vendas"
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={flowDescription}
                    onChange={(e) => setFlowDescription(e.target.value)}
                    placeholder="Para que serve este fluxo?"
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none h-24"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Editor */}
          <div className="lg:col-span-3">
            {selectedMenu && (
              <div className="bg-card rounded-2xl border border-border p-6 glass-card animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    {navigationHistory.length > 0 && (
                      <button
                        onClick={goBack}
                        className="p-2 bg-muted hover:bg-muted/80 rounded-lg transition text-muted-foreground btn-touch"
                        title="Voltar"
                      >
                        <Reply className="w-5 h-5" />
                      </button>
                    )}
                    <div>
                      <h2 className="text-xl font-black text-foreground">{selectedMenu.title}</h2>
                      <p className="text-xs text-muted-foreground">ID: {selectedMenu.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                      Nível {navigationHistory.length + 1}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Mensagem que o Bot enviará
                    </label>
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
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none h-32 text-lg"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        Opções do Menu <span className="text-xs font-normal text-muted-foreground">({selectedMenu.options.length})</span>
                      </h3>
                      <button
                        onClick={addOption}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition text-sm font-bold border border-primary/20 btn-touch"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Opção
                      </button>
                    </div>

                    <div className="space-y-4">
                      {selectedMenu.options.map((option) => (
                        <div key={option.id} className="bg-muted/30 rounded-2xl p-5 border border-border/50 card-hover transition">
                          <div className="flex flex-wrap gap-4 mb-4">
                            <div className="w-16">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Nº</label>
                              <input
                                type="number"
                                value={option.number}
                                onChange={(e) => updateOption(option.id, 'number', parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                              />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Texto da Opção</label>
                              <input
                                type="text"
                                value={option.text}
                                onChange={(e) => updateOption(option.id, 'text', e.target.value)}
                                placeholder="Ex: Falar com Vendas"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => deleteOption(option.id)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition btn-touch"
                                title="Remover Opção"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase">Ação da Opção</label>
                              {option.nextMenuId ? (
                                <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                  <div className="flex items-center gap-2 text-primary">
                                    <ChevronRight className="w-4 h-4" />
                                    <span className="text-sm font-bold italic">Leva ao: {flowData.menus[option.nextMenuId]?.title || 'Menu Desconhecido'}</span>
                                  </div>
                                  <button
                                    onClick={() => navigateToMenu(option.nextMenuId!)}
                                    className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90 transition font-bold"
                                  >
                                    Editar Menu
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => createSubMenu(option.id)}
                                  className="w-full flex items-center justify-center gap-2 p-3 bg-muted hover:bg-muted/80 border border-dashed border-border rounded-xl text-sm font-medium transition text-muted-foreground hover:text-foreground"
                                >
                                  <Plus className="w-4 h-4" />
                                  Puxar Sub-menu
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase">Resposta Simples (se não houver sub-menu)</label>
                              <textarea
                                value={option.response || ''}
                                onChange={(e) => updateOption(option.id, 'response', e.target.value)}
                                disabled={!!option.nextMenuId}
                                placeholder={option.nextMenuId ? "Desabilitado pois esta opção leva a um sub-menu" : "O bot responderá este texto e encerrará o fluxo."}
                                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition resize-none h-20 disabled:opacity-50 disabled:bg-muted/20"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
