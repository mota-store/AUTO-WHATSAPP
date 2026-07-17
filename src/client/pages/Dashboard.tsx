import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Plus, Edit2, Trash2, RefreshCw, Wifi, Smartphone, QrCode, ExternalLink, X, Check, AlertTriangle, Phone } from 'lucide-react'
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

interface ConnectionLog {
  message: string
  status: 'info' | 'success' | 'error' | 'warning'
  time: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WhatsappInstance | null>(null)
  const [flows, setFlows] = useState<MenuFlow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Connection Screen state
  const [showConnectionScreen, setShowConnectionScreen] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing' | null>(null)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<ConnectionLog[]>([])
  const [connectionError, setConnectionError] = useState('')
  const [connectionActive, setConnectionActive] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
    // Aumentar a frequência de busca quando estiver conectando para o QR aparecer mais rápido
    const intervalTime = (instance?.status === 'connecting') ? 2000 : 5000;
    const interval = setInterval(loadData, intervalTime)
    return () => clearInterval(interval)
  }, [instance?.status])

  useEffect(() => {
    if (!instance || !connectionActive) return

    if (instance.status === 'connected') {
      setProgress(100)
      addLog('WhatsApp conectado com sucesso!', 'success')
      setConnectionActive(false)
      setTimeout(() => {
        setShowConnectionScreen(false)
        setConnectionMethod(null)
        setProgress(0)
        setLogs([])
        loadData()
      }, 2000)
    }
  }, [instance, connectionActive])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (message: string, status: ConnectionLog['status']) => {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    setLogs(prev => [...prev, { message, status, time }])
  }

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
      toast.error('Digite o número do telefone com DDD')
      return
    }

    setIsConnecting(true)
    setPairingCode('')
    setConnectionActive(true)
    setConnectionMethod(usePairingCode ? 'pairing' : 'qr')
    setShowConnectionScreen(true)
    setProgress(10)
    setConnectionError('')
    setLogs([])
    addLog('Iniciando conexão...', 'info')

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
          addLog(`Código gerado: ${data.pairingCode}`, 'success')
          setProgress(50)
        } else {
          addLog('Aguardando QR Code...', 'info')
          setProgress(25)
        }
      } else {
        setConnectionError(data.message || 'Erro ao conectar')
        addLog(`Erro: ${data.message}`, 'error')
        setConnectionActive(false)
      }
    } catch (error) {
      setConnectionError('Erro de rede')
      setConnectionActive(false)
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
        loadData()
      }
    } catch (error) {
      toast.error('Erro ao desconectar')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-bold animate-pulse">Carregando MOTA-FLOW...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background gradient-bg pb-20">
      <header className="header-sticky px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black gradient-text-whatsapp">MOTA-FLOW</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-destructive transition-all font-bold">
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        {/* WhatsApp Connection Section */}
        <section>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-black">Conexão WhatsApp</h2>
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 sm:p-12 overflow-hidden relative">
            {instance?.status === 'connected' ? (
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-whatsapp/20 rounded-3xl flex items-center justify-center shadow-inner">
                    <Check className="w-10 h-10 text-whatsapp animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-whatsapp mb-1">WhatsApp Conectado</h3>
                    <p className="text-muted-foreground font-medium">Sua automação está operando normalmente.</p>
                  </div>
                </div>
                <button onClick={handleDisconnect} className="px-8 py-4 bg-destructive/10 text-destructive rounded-2xl font-bold hover:bg-destructive hover:text-white transition-all btn-touch">
                  Desconectar WhatsApp
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* QR Code Option */}
                <div className="flex flex-col items-center text-center p-8 bg-muted/30 rounded-[2rem] border border-border/50 relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                    <QrCode className="w-24 h-24" />
                  </div>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <QrCode className="w-6 h-6 text-primary" /> Opção 1: QR Code
                  </h3>
                  <div className="bg-white p-4 rounded-3xl shadow-xl mb-8 min-h-[224px] flex items-center justify-center">
                    {instance?.qrCode ? (
                      <img src={instance.qrCode} alt="QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-xs font-bold text-muted-foreground uppercase">Gerando QR...</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setShowConnectionScreen(true); setConnectionMethod('qr'); setConnectionActive(true); }} className="w-full btn-primary py-4 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5" /> Ampliar QR Code
                  </button>
                </div>

                {/* Pairing Code Option */}
                <div className="flex flex-col items-center text-center p-8 bg-muted/30 rounded-[2rem] border border-border/50 relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                    <Smartphone className="w-24 h-24" />
                  </div>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Smartphone className="w-6 h-6 text-primary" /> Opção 2: Via Número
                  </h3>
                  <div className="w-full space-y-6 mb-8">
                    <p className="text-sm text-muted-foreground font-medium">Conecte digitando o número do seu WhatsApp abaixo:</p>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ex: 559185892191"
                      className="w-full px-6 py-5 bg-background border border-border rounded-2xl text-center text-xl font-mono focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <button onClick={() => handleConnect(true)} disabled={isConnecting} className="w-full py-4 bg-whatsapp text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-whatsapp/20 hover:opacity-90 transition-all">
                    {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                    Gerar Código de 8 Dígitos
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Flows Section */}
        <section>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-primary rounded-full"></div>
              <h2 className="text-2xl font-black">Meus Fluxos</h2>
            </div>
            <button onClick={() => navigate('/flow-editor')} className="btn-primary px-6 py-3 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Novo Fluxo
            </button>
          </div>

          {flows.length === 0 ? (
            <div className="glass-card rounded-[2.5rem] p-16 text-center border-dashed border-2 border-primary/20">
              <p className="text-muted-foreground text-lg mb-8">Você ainda não criou nenhum fluxo de atendimento.</p>
              <button onClick={() => navigate('/flow-editor')} className="btn-secondary px-8 py-4">Criar Primeiro Fluxo</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flows.map(flow => (
                <div key={flow.id} className="glass-card rounded-3xl p-6 card-hover group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/10 p-3 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => navigate(`/flow-editor/${flow.id}`)} className="p-2 text-muted-foreground hover:text-primary transition-all"><Edit2 className="w-5 h-5" /></button>
                      <button onClick={async () => { if(confirm('Deletar?')) { const token = localStorage.getItem('token'); await fetch(`/api/flows/${flow.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); loadData(); } }} className="p-2 text-muted-foreground hover:text-destructive transition-all"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  <h3 className="text-xl font-black mb-2">{flow.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-6">{flow.description || 'Sem descrição.'}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{new Date(flow.createdAt).toLocaleDateString()}</span>
                    <button onClick={() => navigate(`/flow-preview/${flow.id}`)} className="text-xs font-black text-primary flex items-center gap-1 uppercase tracking-tighter">Testar <ExternalLink className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Connection Modal Overlay */}
      {showConnectionScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-card rounded-[2.5rem] p-8 sm:p-12 relative shadow-2xl">
            <button onClick={() => { setShowConnectionScreen(false); setConnectionActive(false); }} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-10">
              <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center ${connectionError ? 'bg-red-500/20' : 'bg-primary/20'}`}>
                {connectionError ? <AlertTriangle className="w-10 h-10 text-red-500" /> : progress >= 100 ? <Check className="w-10 h-10 text-green-500" /> : <RefreshCw className="w-10 h-10 text-primary animate-spin" />}
              </div>
              <h2 className="text-3xl font-black mb-2">{connectionError ? 'Erro na Conexão' : progress >= 100 ? 'Conectado!' : 'Conectando...'}</h2>
              <p className="text-muted-foreground font-medium">{connectionMethod === 'qr' ? 'Escaneie o QR Code no seu WhatsApp' : 'Digite o código abaixo no seu celular'}</p>
            </div>

            {connectionMethod === 'qr' && instance?.qrCode && !connectionError && (
              <div className="bg-white p-6 rounded-3xl mx-auto w-fit mb-10 shadow-xl border-8 border-white">
                <img src={instance.qrCode} alt="QR Code" className="w-56 h-56" />
              </div>
            )}

            {connectionMethod === 'pairing' && pairingCode && !connectionError && (
              <div className="text-center mb-10">
                <div className="text-5xl font-mono font-black text-primary tracking-[0.2em] bg-primary/5 py-8 rounded-3xl border-2 border-primary/20 inline-block px-8">
                  {pairingCode}
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-bold uppercase tracking-widest">Código de 8 dígitos</p>
              </div>
            )}

            {connectionError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 mb-10 text-center">
                <p className="text-red-500 font-bold mb-4">{connectionError}</p>
                <button onClick={() => { setShowConnectionScreen(false); setConnectionActive(false); }} className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">Fechar e Tentar Novamente</button>
              </div>
            )}

            <div className="bg-muted/50 rounded-3xl p-6 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Logs em tempo real</p>
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs font-medium">
                    <span className="text-muted-foreground font-mono">{log.time}</span>
                    <span className={log.status === 'success' ? 'text-green-500' : log.status === 'error' ? 'text-red-500' : 'text-foreground'}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
