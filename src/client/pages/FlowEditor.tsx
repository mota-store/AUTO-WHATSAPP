import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  ChevronRight, 
  Reply, 
  List, 
  Smartphone, 
  Send, 
  RefreshCw,
  MessageSquare,
  Zap
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
        title: 'Menu Principal',
        message: '👋 Olá! Seja muito bem-vindo(a). Como podemos ajudar hoje?',
        options: [
          { id: 'opt_1', number: 1, text: 'Produtos', response: '' },
          { id: 'opt_2', number: 2, text: 'Promoções', response: '' },
          { id: 'opt_3', number: 3, text: 'Dúvidas Frequentes (FAQ)', response: '' },
          { id: 'opt_4', number: 4, text: 'Falar com um Atendente', response: 'Perfeito! Descreva sua dúvida com o máximo de detalhes possível.' },
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
      toast.error('Erro ao carregar fluxo')
    } finally {
      setIsLoading(false)
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
        navigate('/flows')
      }
    } catch (error) {
      toast.error('Erro ao salvar fluxo')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedMenu = flowData.menus[selectedMenuId]

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Editor */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                <Zap className="w-4 h-4" />
                <span>Editor de Automação</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter">
                {flowId ? 'Editar Fluxo' : 'Novo Fluxo'}
              </h1>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => navigate('/flows')}
                className="px-6 py-3 bg-muted/50 border border-border rounded-xl font-bold hover:bg-muted transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" /> Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary px-8 py-3 flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Fluxo
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Configurações do Fluxo */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-card rounded-[2rem] p-6 border border-border/50">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <List className="w-5 h-5 text-primary" /> Configurações
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Nome do Fluxo</label>
                    <input 
                      type="text"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl mt-1 font-bold focus:ring-2 focus:ring-primary/20"
                      placeholder="Ex: Suporte Mota Store"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição</label>
                    <textarea 
                      value={flowDescription}
                      onChange={(e) => setFlowDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl mt-1 font-medium h-24 resize-none"
                      placeholder="Breve descrição do fluxo..."
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[2rem] p-6 border border-border/50">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> Lista de Menus
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.values(flowData.menus).map(menu => (
                    <button 
                      key={menu.id}
                      onClick={() => setSelectedMenuId(menu.id)}
                      className={`w-full p-4 rounded-xl text-left transition-all border ${
                        selectedMenuId === menu.id 
                        ? 'bg-primary/10 border-primary text-primary font-bold' 
                        : 'bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="truncate">{menu.title}</span>
                        {menu.id === flowData.rootMenuId && <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full">RAIZ</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editor do Menu Selecionado */}
            <div className="lg:col-span-8">
              {selectedMenu && (
                <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 border border-border/50">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">{selectedMenu.title}</h3>
                      <p className="text-muted-foreground font-medium">Configure a mensagem e as opções deste menu.</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Mensagem do WhatsApp</label>
                      <textarea 
                        value={selectedMenu.message}
                        onChange={(e) => {
                          const newMenus = { ...flowData.menus };
                          newMenus[selectedMenuId].message = e.target.value;
                          setFlowData({ ...flowData, menus: newMenus });
                        }}
                        className="w-full px-6 py-4 bg-background border border-border rounded-2xl mt-2 font-medium h-32 focus:ring-4 focus:ring-primary/10"
                        placeholder="Escreva a mensagem que o cliente receberá..."
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Opções do Menu</h4>
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
                          className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {selectedMenu.options.map((option, index) => (
                          <div key={option.id} className="p-4 bg-muted/30 rounded-2xl border border-border/50 flex flex-col sm:flex-row gap-4 items-center">
                            <div className="w-10 h-10 bg-background border border-border rounded-xl flex items-center justify-center font-black text-primary">
                              {option.number}
                            </div>
                            <input 
                              type="text"
                              value={option.text}
                              onChange={(e) => {
                                const newMenus = { ...flowData.menus };
                                newMenus[selectedMenuId].options[index].text = e.target.value;
                                setFlowData({ ...flowData, menus: newMenus });
                              }}
                              className="flex-1 px-4 py-2 bg-background border border-border rounded-xl font-bold"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const subMenuId = `menu_${Date.now()}`;
                                  const newMenus = { ...flowData.menus };
                                  newMenus[subMenuId] = {
                                    id: subMenuId,
                                    title: `Sub-menu: ${option.text}`,
                                    message: 'Escolha uma opção:',
                                    options: [{ id: `opt_back_${Date.now()}`, number: 0, text: 'Voltar', nextMenuId: selectedMenuId }]
                                  };
                                  newMenus[selectedMenuId].options[index].nextMenuId = subMenuId;
                                  newMenus[selectedMenuId].options[index].response = '';
                                  setFlowData({ ...flowData, menus: newMenus });
                                  setSelectedMenuId(subMenuId);
                                }}
                                className={`p-2 rounded-xl transition-all ${option.nextMenuId ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                                title="Criar Sub-menu"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => {
                                  const newMenus = { ...flowData.menus };
                                  newMenus[selectedMenuId].options = newMenus[selectedMenuId].options.filter(o => o.id !== option.id);
                                  setFlowData({ ...flowData, menus: newMenus });
                                }}
                                className="p-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive hover:text-white transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
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
