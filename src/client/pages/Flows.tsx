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
  Filter,
  MoreVertical
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

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este fluxo?')) return
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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                <MessageSquare className="w-4 h-4" />
                <span>Automação Inteligente</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter">Fluxos de Resposta</h1>
              <p className="text-muted-foreground font-medium">Crie e gerencie seus menus automáticos do WhatsApp.</p>
            </div>
            <button 
              onClick={() => navigate('/flow-editor')}
              className="btn-primary px-8 py-4 rounded-2xl flex items-center justify-center gap-3 text-lg"
            >
              <Plus className="w-6 h-6" />
              Novo Fluxo
            </button>
          </header>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
              <input 
                type="text" 
                placeholder="Buscar fluxos pelo nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-muted/30 border border-border rounded-2xl input-focus font-medium"
              />
            </div>
            <button className="px-6 py-4 bg-muted/30 border border-border rounded-2xl font-bold flex items-center gap-2 hover:bg-muted/50 transition-all">
              <Filter className="w-5 h-5" />
              Filtros
            </button>
          </div>

          {/* Flows Grid */}
          {isLoading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground font-bold animate-pulse">Carregando seus fluxos...</p>
            </div>
          ) : filteredFlows.length === 0 ? (
            <div className="glass-card rounded-[3rem] p-20 text-center border-dashed border-2 border-primary/20">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-black mb-2">Nenhum fluxo encontrado</h3>
              <p className="text-muted-foreground mb-10 max-w-sm mx-auto font-medium">Você ainda não criou nenhum fluxo de atendimento ou sua busca não retornou resultados.</p>
              <button 
                onClick={() => navigate('/flow-editor')}
                className="btn-secondary px-10 py-4"
              >
                Criar Primeiro Fluxo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredFlows.map(flow => (
                <div key={flow.id} className="glass-card rounded-[2rem] p-8 card-hover group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-all duration-700"></div>
                  
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => navigate(`/flow-editor/${flow.id}`)}
                        className="p-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                        title="Editar fluxo"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(flow.id)}
                        className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                        title="Excluir fluxo"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-2 tracking-tight group-hover:text-primary transition-colors">{flow.name}</h3>
                    <p className="text-muted-foreground text-sm font-medium line-clamp-2 mb-8 min-h-[40px]">{flow.description || 'Sem descrição definida para este fluxo.'}</p>
                    
                    <div className="flex items-center justify-between pt-6 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Criado em</span>
                        <span className="text-xs font-bold">{new Date(flow.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button 
                        onClick={() => navigate(`/flow-preview/${flow.id}`)}
                        className="px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        Testar <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
