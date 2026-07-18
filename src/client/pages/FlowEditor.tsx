import { useState, useEffect } from 'react'
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

  const selectedMenu = flowData.menus[selectedMenuId]

  const createNextStep = (optionId: string) => {
    const optionIndex = selectedMenu.options.findIndex(o => o.id === optionId)
    if (optionIndex === -1) return

    const newMenuId = `menu_${Date.now()}`
    const newMenus = { ...flowData.menus }
    
    newMenus[newMenuId] = {
      id: newMenuId,
      title: `Após: "${selectedMenu.options[optionIndex].text}"`,
      message: 'O que o robô deve dizer agora?',
      options: [
        { id: `opt_back_${Date.now()}`, number: 0, text: 'Voltar ao início', nextMenuId: flowData.rootMenuId }
      ]
    }

    newMenus[selectedMenuId].options[optionIndex].nextMenuId = newMenuId
    newMenus[selectedMenuId].options[optionIndex].response = ''

    setFlowData({ ...flowData, menus: newMenus })
    setSelectedMenuId(newMenuId)
    toast.success('Novo passo criado!')
  }

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
      
      <main className="flex-1 lg:ml-72 p-4 lg:p-8 transition-all duration-500">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top Header - Simples */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-[2rem] border border-border/50 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/flows')} className="p-3 hover:bg-muted rounded-2xl transition-all">
                <ChevronLeft className="w-6 h-6 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight">{flowName || 'Novo Atendimento'}</h1>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Editor de Mensagens</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setPreviewMode(!previewMode)}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${previewMode ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                <Eye className="w-5 h-5" /> {previewMode ? 'Voltar ao Editor' : 'Ver como fica no Celular'}
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-8 py-3 bg-whatsapp text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-whatsapp/20 hover:opacity-90 transition-all"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Tudo
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side - Mapa Simples */}
            <div className={`${previewMode ? 'hidden' : 'lg:col-span-4'} space-y-4`}>
              <div className="glass-card rounded-[2rem] p-6 border border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Nome do Atendimento
                </h3>
                <input 
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Ex: Suporte de Vendas"
                  className="w-full px-5 py-4 bg-background border border-border rounded-2xl font-bold focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>

              <div className="glass-card rounded-[2rem] p-6 border border-border/50">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" /> Etapas Criadas
                </h3>
                <div className="space-y-2">
                  {Object.values(flowData.menus).map(menu => (
                    <button 
                      key={menu.id}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${
                        selectedMenuId === menu.id 
                        ? 'border-primary bg-primary/5 text-primary font-black' 
                        : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate text-sm">{menu.title}</span>
                        {menu.id === flowData.rootMenuId && <span className="text-[8px] bg-primary text-white px-2 py-0.5 rounded-full">INÍCIO</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side - Editor Visual */}
            <div className={`${previewMode ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
              {previewMode ? (
                /* Preview Realista Estilo WhatsApp */
                <div className="flex justify-center py-8 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                  <div className="w-full max-w-[360px] bg-[#E5DDD5] rounded-[3rem] border-[12px] border-black shadow-2xl overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-[#075E54] p-4 flex items-center gap-3">
                      <img src="/bot-avatar.png" alt="Bot" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="text-white font-black text-sm">MOTA-FLOW (Robô)</p>
                        <p className="text-white/70 text-[10px]">Online</p>
                      </div>
                    </div>
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
                        <p className="text-sm whitespace-pre-wrap text-black">{selectedMenu.message}</p>
                        <div className="mt-3 space-y-1">
                          {selectedMenu.options.map(opt => (
                            <p key={opt.id} className="text-xs font-bold text-[#128C7E]">{opt.number}. {opt.text}</p>
                          ))}
                        </div>
                        <p className="text-[9px] text-gray-400 text-right mt-1">12:00</p>
                      </div>
                    </div>
                    <div className="bg-[#F0F0F0] p-3 flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Digite uma mensagem"
                        className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-black outline-none"
                      />
                      <div className="w-10 h-10 bg-[#128C7E] rounded-full flex items-center justify-center text-white">
                        <Send className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editor Passo a Passo */
                <div className="glass-card rounded-[2.5rem] p-6 sm:p-10 border border-border/50 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight mb-2">{selectedMenu.title}</h2>
                    <p className="text-muted-foreground font-medium">Escreva o que o robô vai responder nesta etapa.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Mensagem que o robô envia
                      </label>
                      <textarea 
                        value={selectedMenu.message}
                        onChange={(e) => {
                          const newMenus = { ...flowData.menus };
                          newMenus[selectedMenuId].message = e.target.value;
                          setFlowData({ ...flowData, menus: newMenus });
                        }}
                        className="w-full px-6 py-5 bg-background border-2 border-border rounded-3xl font-medium h-40 focus:border-primary outline-none transition-all text-lg"
                        placeholder="Ex: Olá! Como posso te ajudar?"
                      />
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Opções para o cliente escolher:</h3>
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
                          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-black text-xs hover:bg-primary hover:text-white transition-all"
                        >
                          <Plus className="w-4 h-4" /> Adicionar Opção
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {selectedMenu.options.map((option, index) => (
                          <div key={option.id} className="group bg-muted/20 hover:bg-muted/40 p-5 rounded-[2rem] border border-border/50 transition-all">
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                              <div className="w-12 h-12 bg-white border-2 border-primary rounded-2xl flex items-center justify-center font-black text-primary text-xl shadow-sm">
                                {option.number}
                              </div>
                              <div className="flex-1 w-full">
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Texto da Opção</label>
                                <input 
                                  type="text"
                                  value={option.text}
                                  onChange={(e) => {
                                    const newMenus = { ...flowData.menus };
                                    newMenus[selectedMenuId].options[index].text = e.target.value;
                                    setFlowData({ ...flowData, menus: newMenus });
                                  }}
                                  className="w-full bg-transparent border-b-2 border-border focus:border-primary outline-none py-1 font-black text-lg transition-all"
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
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
