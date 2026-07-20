import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  Plus, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  RefreshCw,
  Search,
  Power,
  X,
  Wand2,
  MousePointer2,
  Zap,
  ChevronRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

interface MenuFlow {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

export default function Flows() {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<MenuFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDescription, setNewFlowDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadFlows()
  }, [])

  const loadFlows = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setFlows(data.flows)
      }
    } catch (error) {
      toast.error('Erro ao carregar fluxos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateFlow = async (method: 'manual' | 'magic') => {
    if (!newFlowName.trim()) {
      toast.error('Dê um nome para o seu fluxo')
      return
    }

    setIsCreating(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newFlowName,
          description: newFlowDescription,
          flowData: {
            rootMenuId: 'menu_1',
            menus: {
              menu_1: {
                id: 'menu_1',
                title: 'Início',
                message: 'Olá! Como posso ajudar?',
                options: []
              }
            }
          }
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setShowCreateModal(false)
        setNewFlowName('')
        setNewFlowDescription('')
        
        if (method === 'magic') {
          navigate(`/flow-editor/${data.id}?openGenerator=true`)
        } else {
          navigate(`/flow-editor/${data.id}`)
        }
      }
    } catch (error) {
      toast.error('Erro ao criar fluxo')
    } finally {
      setIsCreating(false)
    }
  }

  const handleActivate = async (id: number, isActive: boolean) => {
    if (isActive) {
      toast.info('Este fluxo já está ativo')
      return
    }
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${id}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        toast.success('Fluxo ativado! Os outros foram desativados.')
        loadFlows()
      }
    } catch (error) {
      toast.error('Erro ao ativar fluxo')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este fluxo?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        toast.success('Fluxo excluído')
        loadFlows()
      }
    } catch (error) {
      toast.error('Erro ao excluir')
    }
  }

  const filteredFlows = flows.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans safe-top safe-bottom">
      <Sidebar />
      
      {/* Modal de Criação de Elite */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCreateModal(false)}></div>
          
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 sm:p-10 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight">Novo Fluxo</h2>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Comece sua automação</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Nome do Fluxo</label>
                    <input 
                      type="text"
                      value={newFlowName}
                      onChange={(e) => setNewFlowName(e.target.value)}
                      placeholder="Ex: Atendimento Comercial"
                      className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 font-black focus:border-primary outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Descrição (Opcional)</label>
                    <input 
                      type="text"
                      value={newFlowDescription}
                      onChange={(e) => setNewFlowDescription(e.target.value)}
                      placeholder="Ex: Fluxo para novos clientes..."
                      className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 font-black focus:border-primary outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => handleCreateFlow('magic')}
                    disabled={isCreating || !newFlowName}
                    className="group relative bg-primary/10 hover:bg-primary border border-primary/20 p-6 rounded-[2rem] text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                      <Wand2 className="w-6 h-6 text-primary group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-black text-primary group-hover:text-white mb-1">Gerador Mágico</h3>
                    <p className="text-[10px] font-bold text-zinc-500 group-hover:text-white/70 uppercase tracking-tighter">Use um roteiro pronto</p>
                    <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-primary group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                  </button>

                  <button 
                    onClick={() => handleCreateFlow('manual')}
                    disabled={isCreating || !newFlowName}
                    className="group relative bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 p-6 rounded-[2rem] text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="w-12 h-12 bg-zinc-700 rounded-2xl flex items-center justify-center mb-4">
                      <MousePointer2 className="w-6 h-6 text-zinc-400 group-hover:text-white" />
                    </div>
                    <h3 className="text-lg font-black text-white mb-1">Editor Visual</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Criar do zero passo a passo</p>
                    <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-zinc-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-72 px-4 pt-8 pb-12 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Header de Elite */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.2em]">
                <Zap className="w-4 h-4 fill-primary" />
                <span>Automação Inteligente</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">Meus Fluxos</h1>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Gerencie seus menus de atendimento</p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 bg-primary text-black rounded-[1.5rem] font-black text-sm shadow-2xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Plus className="w-5 h-5" /> NOVO FLUXO
            </button>
          </header>

          {/* Search Bar de Elite */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-primary transition-all" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-5 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl focus:border-primary outline-none font-black text-base shadow-inner transition-all placeholder:text-zinc-700"
              />
            </div>
          </div>

          {/* Flows Grid */}
          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
              <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest">Sincronizando dados...</p>
            </div>
          ) : filteredFlows.length === 0 ? (
            <div className="bg-zinc-900/40 border-2 border-dashed border-zinc-800 rounded-[3rem] p-16 text-center space-y-8">
              <div className="w-24 h-24 bg-zinc-800/50 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                <MessageSquare className="w-10 h-10 text-zinc-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">Tudo pronto para começar</h3>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Crie seu primeiro fluxo de atendimento agora.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="px-10 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-black text-sm transition-all active:scale-95"
              >
                CRIAR PRIMEIRO FLUXO
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredFlows.map(flow => (
                <div key={flow.id} className="group bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] p-8 hover:border-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/5 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 transition-opacity ${flow.isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-2xl transition-all duration-500 ${flow.isActive ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black tracking-tight group-hover:text-primary transition-colors truncate max-w-[180px]">{flow.name}</h3>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-tighter line-clamp-1">{flow.description || 'Sem descrição'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => navigate(`/flow-editor/${flow.id}`)}
                        className="p-3 bg-zinc-800/50 hover:bg-primary/20 text-zinc-500 hover:text-primary rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(flow.id)}
                        className="p-3 bg-zinc-800/50 hover:bg-red-500/20 text-zinc-500 hover:text-red-500 rounded-xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-8 mt-8 border-t border-zinc-800/50 relative z-10">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleActivate(flow.id, flow.isActive)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                          flow.isActive
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:border-primary/50 hover:text-primary'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {flow.isActive ? 'Ativo' : 'Ativar'}
                      </button>
                    </div>
                    <button 
                      onClick={() => navigate(`/flow-editor/${flow.id}?preview=true`)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 hover:text-white transition-all"
                    >
                      TESTAR <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
