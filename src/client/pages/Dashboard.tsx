import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Plus, Eye, Edit2, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

interface WhatsappInstance {
  id: number
  phoneNumber?: string
  status: 'disconnected' | 'connecting' | 'connected'
  qrCode?: string
}

interface MenuFlow {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WhatsappInstance | null>(null)
  const [flows, setFlows] = useState<MenuFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setInstance(data.instance)
        setFlows(data.flows)
      } else if (response.status === 401) {
        navigate('/login')
      }
    } catch (error) {
      toast.error('Erro ao carregar dados')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleDisconnect = async () => {
    if (!instance) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/whatsapp/${instance.id}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        toast.success('WhatsApp desconectado')
        loadData()
      }
    } catch (error) {
      toast.error('Erro ao desconectar')
    }
  }

  const handleDeleteFlow = async (flowId: number) => {
    if (!confirm('Tem certeza que deseja deletar este fluxo?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/flows/${flowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        toast.success('Fluxo deletado')
        loadData()
      }
    } catch (error) {
      toast.error('Erro ao deletar fluxo')
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
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">AUTO-WHATSAPP</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* WhatsApp Instance Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Conexão WhatsApp</h2>
          <div className="bg-card rounded-xl border border-border p-6">
            {instance ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {instance.status === 'connected' ? (
                      <>
                        <Wifi className="w-6 h-6 text-green-500" />
                        <span className="text-green-600 font-medium">Conectado</span>
                      </>
                    ) : instance.status === 'connecting' ? (
                      <>
                        <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />
                        <span className="text-yellow-600 font-medium">Conectando...</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-6 h-6 text-red-500" />
                        <span className="text-red-600 font-medium">Desconectado</span>
                      </>
                    )}
                  </div>
                  {instance.status === 'connected' && (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      Desconectar
                    </button>
                  )}
                </div>

                {instance.phoneNumber && (
                  <p className="text-muted-foreground">
                    Telefone: <span className="text-foreground font-medium">{instance.phoneNumber}</span>
                  </p>
                )}

                {instance.status === 'connecting' && instance.qrCode && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setShowQR(!showQR)}
                      className="text-accent hover:underline"
                    >
                      {showQR ? 'Ocultar' : 'Mostrar'} QR Code
                    </button>
                    {showQR && (
                      <div className="bg-white p-4 rounded-lg w-fit">
                        <img src={instance.qrCode} alt="QR Code" className="w-64 h-64" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/flow-editor')}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition"
              >
                <Plus className="w-5 h-5" />
                Conectar WhatsApp
              </button>
            )}
          </div>
        </section>

        {/* Menu Flows Section */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Fluxos de Menu</h2>
            <button
              onClick={() => navigate('/flow-editor')}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition"
            >
              <Plus className="w-5 h-5" />
              Novo Fluxo
            </button>
          </div>

          {flows.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhum fluxo criado ainda</p>
              <button
                onClick={() => navigate('/flow-editor')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Fluxo
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {flows.map((flow) => (
                <div key={flow.id} className="bg-card rounded-xl border border-border p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">{flow.name}</h3>
                    {flow.description && (
                      <p className="text-muted-foreground text-sm">{flow.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Criado em {new Date(flow.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/flow-preview/${flow.id}`)}
                      className="p-2 text-muted-foreground hover:text-foreground transition"
                      title="Visualizar"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/flow-editor/${flow.id}`)}
                      className="p-2 text-muted-foreground hover:text-foreground transition"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="p-2 text-muted-foreground hover:text-red-500 transition"
                      title="Deletar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
