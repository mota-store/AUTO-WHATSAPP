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
      
      <main className="flex-1 lg:ml-64 px-4 pt-6 pb-8 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                <MessageSquare className="w-3 h-3" />
                <span>Automação</span>
              </div>
              <h1 className="text-2xl font-black tracking-tighter">Fluxos</h1>
              <p className="text-zinc-500 text-sm font-medium">Menus automáticos do WhatsApp.</p>
            </div>
            <button 
              onClick={() => navigate('/flow-editor')}
              className="btn-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Novo Fluxo
            </button>
          </header>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-all" />
            <input 
              type="text" 
              placeholder="Buscar fluxos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-zinc-900/30 border border-zinc-800 rounded-xl input-focus font-medium text-base"
            />
          </div>

          {/* Flows Grid */}
          {isLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 font-bold text-sm">Carregando...</p>
            </div>
          ) : filteredFlows.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center border-dashed border-2 border-primary/20">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-black mb-1">Nenhum fluxo</h3>
              <p className="text-zinc-500 text-sm mb-6 font-medium">Crie seu primeiro fluxo de atendimento.</p>
              <button 
                onClick={() => navigate('/flow-editor')}
                className="btn-secondary px-6 py-3 rounded-xl text-sm"
              >
                Criar Primeiro Fluxo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredFlows.map(flow => (
                <div key={flow.id} className="glass-card rounded-xl p-4 card-hover group relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-lg group-hover:bg-primary transition-all duration-300">
                        <MessageSquare className="w-5 h-5 text-primary group-hover:text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black tracking-tight group-hover:text-primary transition-colors truncate">{flow.name}</h3>
                        <p className="text-zinc-500 text-xs font-medium line-clamp-1">{flow.description || 'Sem descrição'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => navigate(`/flow-editor/${flow.id}`)}
                        className="p-2 text-zinc-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(flow.id)}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/50">
                    <span className="text-[10px] font-bold text-zinc-600">{new Date(flow.createdAt).toLocaleDateString()}</span>
                    <button 
                      onClick={() => navigate(`/flow-preview/${flow.id}`)}
                      className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      Testar <ExternalLink className="w-3 h-3" />
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
