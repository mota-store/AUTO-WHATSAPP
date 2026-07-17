import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Plus, Eye, Edit2, Trash2, RefreshCw, Wifi, WifiOff, Smartphone, QrCode } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

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
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000) // Poll for updates
    return () => clearInterval(interval)
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

  const handleConnect = async (usePairingCode = false) => {
    if (usePairingCode && !phoneNumber) {
      toast.error('Digite o número do telefone com DDD (ex: 5511999999999)')
      return
    }

    setIsConnecting(true)
    setPairingCode('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ phoneNumber, usePairingCode })
      })

      const data = await response.json()
      if (response.ok) {
        if (data.pairingCode) {
          setPairingCode(data.pairingCode)
          toast.success('Código de pareamento gerado!')
        } else {
          toast.success('Iniciando geração do QR Code...')
          setShowQR(true)
        }
        loadData()
      } else {
        toast.error(data.message || 'Erro ao conectar')
      }
    } catch (error) {
      toast.error('Erro ao conectar ao servidor')
    } finally {
      setIsConnecting(false)
    }
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
        setPairingCode('')
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
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-white p-1 rounded-lg">
              <Wifi className="w-6 h-6" />
            </span>
            <span className="hidden sm:inline">AUTO-WHATSAPP</span>
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* WhatsApp Instance Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Conexão WhatsApp</h2>
          <div className="bg-card rounded-xl border border-border p-6">
            {instance ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {instance.status === 'connected' ? (
                      <>
                        <Wifi className="w-6 h-6 text-green-500" />
                        <span className="text-green-600 font-bold">Conectado</span>
                      </>
                    ) : instance.status === 'connecting' ? (
                      <>
                        <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />
                        <span className="text-yellow-600 font-medium">Aguardando Conexão...</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-6 h-6 text-red-500" />
                        <span className="text-red-600 font-medium">Desconectado</span>
                      </>
                    )}
                  </div>
                  {(instance.status === 'connected' || instance.status === 'connecting') && (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition font-medium"
                    >
                      Desconectar
                    </button>
                  )}
                </div>

                {instance.status === 'connected' && instance.phoneNumber && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-muted-foreground">
                      Conectado como: <span className="text-foreground font-bold">+{instance.phoneNumber}</span>
                    </p>
                  </div>
                )}

                {instance.status === 'connecting' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    {/* QR Code Display */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border border-border">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <QrCode className="w-4 h-4" /> Opção 1: Escanear QR Code
                      </h3>
                      {instance.qrCode ? (
                        <div className="bg-white p-4 rounded-lg shadow-inner">
                          <img src={instance.qrCode} alt="QR Code" className="w-48 h-48" />
                        </div>
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-muted-foreground italic text-xs text-center">
                          Gerando QR Code real...
                        </div>
                      )}
                    </div>

                    {/* Pairing Code Display */}
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border border-border">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Opção 2: Código de Pareamento
                      </h3>
                      {!pairingCode ? (
                        <div className="w-full space-y-3">
                          <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="Número: 5511999999999"
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                          />
                          <button
                            onClick={() => handleConnect(true)}
                            disabled={isConnecting}
                            className="w-full py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50"
                          >
                            {isConnecting ? 'Gerando...' : 'Receber Código por SMS/WhatsApp'}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center space-y-4 w-full">
                          <div className="text-4xl font-mono font-black text-primary tracking-[0.2em] bg-primary/10 py-4 rounded-lg border border-primary/20">
                            {pairingCode}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            No WhatsApp: Dispositivos Conectados &gt; Conectar Dispositivo &gt; Conectar com número de telefone
                          </p>
                          <button 
                            onClick={() => setPairingCode('')}
                            className="text-xs text-primary hover:underline"
                          >
                            Tentar outro número
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {instance.status === 'disconnected' && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => handleConnect(false)}
                      className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Tentar Conectar Novamente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Wifi className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Inicie sua Automação</h3>
                  <p className="text-muted-foreground text-sm">Crie uma instância para conectar seu WhatsApp ao sistema.</p>
                </div>
                <button
                  onClick={() => handleConnect(false)}
                  className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 transition mx-auto font-bold shadow-xl transform hover:scale-105"
                >
                  <Plus className="w-6 h-6" />
                  Criar Minha Primeira Instância
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Menu Flows Section */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Meus Fluxos</h2>
            <button
              onClick={() => navigate('/flow-editor')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              Novo Fluxo
            </button>
          </div>

          {flows.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">Você ainda não criou nenhum fluxo de atendimento.</p>
              <button
                onClick={() => navigate('/flow-editor')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition font-bold"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Fluxo
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {flows.map((flow) => (
                <div key={flow.id} className="bg-card rounded-xl border border-border p-4 flex justify-between items-center hover:border-primary/50 transition">
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">{flow.name}</h3>
                    {flow.description && (
                      <p className="text-muted-foreground text-sm line-clamp-1">{flow.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
                      Criado em {new Date(flow.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigate(`/flow-preview/${flow.id}`)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition"
                      title="Visualizar"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/flow-editor/${flow.id}`)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
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
