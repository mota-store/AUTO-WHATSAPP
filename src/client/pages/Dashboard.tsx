import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Plus, Eye, Edit2, Trash2, RefreshCw, Wifi, WifiOff, Smartphone, QrCode, Copy, ExternalLink } from 'lucide-react'
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
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Código copiado!')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary"></div>
          <Wifi className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary w-6 h-6 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background gradient-bg">
      {/* Header */}
      <header className="header-sticky px-responsive">
        <div className="max-w-7xl mx-auto py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl animate-float shadow-primary">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black gradient-text-whatsapp">MOTA-FLOW</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-destructive transition-smooth btn-touch"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline font-bold">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-responsive py-responsive">
        {/* WhatsApp Instance Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-black text-foreground">Conexão WhatsApp</h2>
          </div>
          
          <div className="glass-card rounded-3xl p-6 sm:p-8">
            {instance ? (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${
                      instance.status === 'connected' ? 'bg-green-500/20' : 
                      instance.status === 'connecting' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                    }`}>
                      {instance.status === 'connected' ? (
                        <Wifi className="w-8 h-8 text-green-500" />
                      ) : instance.status === 'connecting' ? (
                        <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin" />
                      ) : (
                        <WifiOff className="w-8 h-8 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black">Status do Sistema</h3>
                        {instance.status === 'connected' ? (
                          <span className="badge-success">Ativo</span>
                        ) : instance.status === 'connecting' ? (
                          <span className="badge-warning">Conectando</span>
                        ) : (
                          <span className="badge-error">Inativo</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {instance.status === 'connected' ? 'Seu bot está online e respondendo.' : 
                         instance.status === 'connecting' ? 'Aguardando autenticação do dispositivo.' : 
                         'O bot está pausado. Conecte seu WhatsApp.'}
                      </p>
                    </div>
                  </div>
                  
                  {(instance.status === 'connected' || instance.status === 'connecting') && (
                    <button
                      onClick={handleDisconnect}
                      className="px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-smooth font-bold shadow-lg shadow-red-500/20 btn-touch"
                    >
                      Desconectar Conta
                    </button>
                  )}
                </div>

                {instance.status === 'connected' && instance.phoneNumber && (
                  <div className="p-6 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Smartphone className="w-6 h-6 text-primary" />
                      <div>
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Número Conectado</p>
                        <p className="text-xl font-black text-foreground">+{instance.phoneNumber}</p>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-primary/20 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {instance.status === 'connecting' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                    {/* QR Code Display */}
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-3xl border border-border/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-smooth">
                        <QrCode className="w-32 h-32" />
                      </div>
                      <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-primary" /> 1. Escanear QR Code
                      </h3>
                      <div className="bg-white p-6 rounded-3xl shadow-2xl relative z-10">
                        {instance.qrCode ? (
                          <img src={instance.qrCode} alt="QR Code" className="w-56 h-56" />
                        ) : (
                          <div className="w-56 h-56 flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <RefreshCw className="w-10 h-10 animate-spin text-primary/30" />
                            <p className="text-xs font-bold uppercase tracking-tighter">Gerando código real...</p>
                          </div>
                        )}
                      </div>
                      <p className="mt-6 text-xs text-muted-foreground text-center max-w-[200px]">
                        Abra o WhatsApp &gt; Configurações &gt; Dispositivos Conectados
                      </p>
                    </div>

                    {/* Pairing Code Display */}
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-3xl border border-border/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-smooth">
                        <Smartphone className="w-32 h-32" />
                      </div>
                      <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-primary" /> 2. Código de Pareamento
                      </h3>
                      {!pairingCode ? (
                        <div className="w-full space-y-4 relative z-10">
                          <div>
                            <label className="block text-[10px] font-black text-muted-foreground uppercase mb-2 ml-1">Número com DDD</label>
                            <input
                              type="text"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="Ex: 5511999999999"
                              className="w-full px-5 py-4 bg-background border border-border rounded-2xl text-lg font-bold input-focus"
                            />
                          </div>
                          <button
                            onClick={() => handleConnect(true)}
                            disabled={isConnecting}
                            className="w-full py-4 btn-primary disabled:opacity-50"
                          >
                            {isConnecting ? (
                              <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                            ) : (
                              'Gerar Código de Pareamento'
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center space-y-6 w-full relative z-10">
                          <div className="relative group cursor-pointer" onClick={() => copyToClipboard(pairingCode)}>
                            <div className="text-5xl font-mono font-black text-primary tracking-[0.2em] bg-primary/10 py-8 rounded-3xl border-2 border-primary/20 shadow-inner">
                              {pairingCode}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth bg-primary/5 rounded-3xl">
                              <Copy className="w-8 h-8 text-primary" />
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed bg-card/50 p-4 rounded-xl">
                            No WhatsApp: <span className="text-foreground font-bold">Dispositivos Conectados</span> &gt; <span className="text-foreground font-bold">Conectar Dispositivo</span> &gt; <span className="text-foreground font-bold text-primary">Conectar com número de telefone</span>
                          </p>
                          <button 
                            onClick={() => setPairingCode('')}
                            className="text-sm text-primary font-black hover:underline uppercase tracking-widest"
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
                      className="btn-primary px-10 py-4 flex items-center gap-3 text-lg"
                    >
                      <RefreshCw className="w-6 h-6" />
                      Reconectar Agora
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-8">
                <div className="relative inline-block">
                  <div className="bg-primary/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Wifi className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-lg shadow-xl">
                    <Plus className="w-6 h-6" />
                  </div>
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-2xl font-black mb-2">Bem-vindo ao MOTA-FLOW</h3>
                  <p className="text-muted-foreground">Sua jornada de automação começa aqui. Conecte seu WhatsApp para criar fluxos inteligentes e automáticos.</p>
                </div>
                <button
                  onClick={() => handleConnect(false)}
                  className="btn-primary px-10 py-5 text-xl rounded-2xl flex items-center gap-3 mx-auto"
                >
                  <Plus className="w-7 h-7" />
                  Criar Minha Instância
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Menu Flows Section */}
        <section>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-primary rounded-full"></div>
              <h2 className="text-2xl font-black text-foreground">Meus Fluxos</h2>
            </div>
            <button
              onClick={() => navigate('/flow-editor')}
              className="btn-primary flex items-center gap-2 px-6"
            >
              <Plus className="w-5 h-5" />
              Novo Fluxo
            </button>
          </div>

          {flows.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center border-dashed border-2 border-primary/20">
              <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Edit2 className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg mb-8 font-medium">Você ainda não criou nenhum fluxo de atendimento.</p>
              <button
                onClick={() => navigate('/flow-editor')}
                className="btn-secondary px-8 py-4 text-lg"
              >
                Criar Primeiro Fluxo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flows.map((flow) => (
                <div key={flow.id} className="glass-card rounded-3xl p-6 card-hover group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/10 p-3 rounded-2xl group-hover:bg-primary group-hover:text-white transition-smooth">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/flow-editor/${flow.id}`)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-smooth"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFlow(flow.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-smooth"
                        title="Deletar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-foreground mb-2 group-hover:text-primary transition-smooth">{flow.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-6 h-10">
                    {flow.description || 'Sem descrição definida para este fluxo.'}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      {new Date(flow.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <button
                      onClick={() => navigate(`/flow-preview/${flow.id}`)}
                      className="flex items-center gap-1 text-xs font-black text-primary hover:underline uppercase tracking-tighter"
                    >
                      Testar Fluxo <ExternalLink className="w-3 h-3" />
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
