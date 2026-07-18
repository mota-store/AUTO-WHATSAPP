import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  X, 
  Check, 
  Phone,
  Zap,
  MessageSquare,
  ChevronRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header Section */}
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
              <Zap className="w-4 h-4" />
              <span>Visão Geral</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">Painel de Controle</h1>
            <p className="text-muted-foreground font-medium">Monitore sua conexão e gerencie suas automações.</p>
          </header>

          {/* Connection Status Card */}
          <section>
            <div className="glass-card rounded-[2.5rem] p-8 sm:p-12 overflow-hidden relative border border-border/50">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              
              {instance?.status === 'connected' ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-whatsapp/20 rounded-[2rem] flex items-center justify-center shadow-inner border border-whatsapp/20">
                      <Wifi className="w-12 h-12 text-whatsapp animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 bg-whatsapp rounded-full animate-ping"></span>
                        <h3 className="text-2xl font-black text-whatsapp">Conectado</h3>
                      </div>
                      <p className="text-muted-foreground font-medium">Sua instância está ativa e respondendo.</p>
                      <p className="text-xs font-bold mt-2 py-1 px-3 bg-muted rounded-full inline-block">Número: {instance.phoneNumber || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={handleDisconnect} className="px-10 py-5 bg-destructive/10 text-destructive rounded-2xl font-black text-lg hover:bg-destructive hover:text-white transition-all btn-touch shadow-xl shadow-destructive/10">
                    Desconectar Instância
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                  {/* QR Code Option */}
                  <div className="flex flex-col items-center text-center p-8 bg-muted/30 rounded-[2.5rem] border border-border/50 group hover:border-primary/30 transition-all duration-500">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                      <QrCode className="w-6 h-6 text-primary" /> Conectar via QR Code
                    </h3>
                    <div className="bg-white p-5 rounded-[2rem] shadow-2xl mb-8 min-h-[224px] flex items-center justify-center border-4 border-muted">
                      {instance?.qrCode ? (
                        <img src={instance.qrCode} alt="QR Code" className="w-48 h-48" />
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Gerando QR Code...</p>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => { setShowConnectionScreen(true); setConnectionMethod('qr'); setConnectionActive(true); }} 
                      className="w-full btn-primary py-5 text-lg font-black"
                    >
                      Ampliar QR Code
                    </button>
                  </div>

                  {/* Pairing Code Option */}
                  <div className="flex flex-col items-center text-center p-8 bg-muted/30 rounded-[2.5rem] border border-border/50 group hover:border-whatsapp/30 transition-all duration-500">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                      <Smartphone className="w-6 h-6 text-whatsapp" /> Conectar via Número
                    </h3>
                    <div className="w-full space-y-6 mb-8">
                      <p className="text-sm text-muted-foreground font-medium">Digite o número do WhatsApp com DDD:</p>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-whatsapp transition-all" />
                        <input
                          type="text"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="Ex: 559185892191"
                          className="w-full pl-14 pr-4 py-5 bg-background border border-border rounded-2xl text-center text-2xl font-black tracking-widest focus:ring-4 focus:ring-whatsapp/10 transition-all"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => handleConnect(true)} 
                      disabled={isConnecting} 
                      className="w-full py-5 bg-whatsapp text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-whatsapp/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isConnecting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Smartphone className="w-6 h-6" />}
                      Gerar Código de Pareamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Quick Access Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card rounded-[2.5rem] p-8 border border-border/50 group hover:border-primary/30 transition-all duration-500 cursor-pointer" onClick={() => navigate('/flows')}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:translate-x-2 transition-all" />
              </div>
              <h3 className="text-2xl font-black mb-2">Gerenciar Fluxos</h3>
              <p className="text-muted-foreground font-medium">Você tem {flows.length} fluxos configurados.</p>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-border/50 group hover:border-primary/30 transition-all duration-500 cursor-pointer" onClick={() => navigate('/settings')}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                  <Zap className="w-8 h-8" />
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:translate-x-2 transition-all" />
              </div>
              <h3 className="text-2xl font-black mb-2">Configurações</h3>
              <p className="text-muted-foreground font-medium">Ajuste seu perfil e segurança da conta.</p>
            </div>
          </section>
        </div>
      </main>

      {/* Connection Modal Overlay (Mantido para compatibilidade de fluxo) */}
      {showConnectionScreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-card rounded-[2.5rem] p-8 sm:p-12 relative shadow-2xl border border-border/50">
            <button onClick={() => { setShowConnectionScreen(false); setConnectionActive(false); }} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
              <X className="w-8 h-8" />
            </button>
            
            <div className="text-center space-y-8">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                {connectionMethod === 'qr' ? <QrCode className="w-10 h-10 text-primary" /> : <Smartphone className="w-10 h-10 text-whatsapp" />}
              </div>
              
              <div>
                <h2 className="text-3xl font-black tracking-tight">
                  {connectionMethod === 'qr' ? 'Escaneie o QR Code' : 'Digite o Código'}
                </h2>
                <p className="text-muted-foreground font-medium mt-2">Siga as instruções no seu WhatsApp.</p>
              </div>

              {connectionMethod === 'qr' ? (
                <div className="bg-white p-6 rounded-[2rem] shadow-2xl inline-block border-4 border-muted">
                  {instance?.qrCode ? (
                    <img src={instance.qrCode} alt="QR Code" className="w-56 h-56" />
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center gap-4">
                      <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                      <p className="text-xs font-black text-muted-foreground uppercase">Gerando...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {pairingCode ? (
                    <div className="bg-muted/50 p-8 rounded-[2rem] border-2 border-dashed border-whatsapp/30">
                      <span className="text-5xl font-black tracking-[0.5em] text-whatsapp ml-4">{pairingCode}</span>
                    </div>
                  ) : (
                    <div className="py-10">
                      <RefreshCw className="w-12 h-12 text-whatsapp animate-spin mx-auto" />
                      <p className="text-sm font-bold text-muted-foreground mt-4">Solicitando código...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <span>Status da Conexão</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out rounded-full shadow-lg shadow-primary/30"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Terminal-like Logs */}
              <div className="bg-black/90 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[10px] text-left border border-white/10 shadow-inner custom-scrollbar">
                {logs.map((log, i) => (
                  <div key={i} className={`mb-1 ${
                    log.status === 'success' ? 'text-whatsapp' : 
                    log.status === 'error' ? 'text-destructive' : 
                    log.status === 'warning' ? 'text-yellow-400' : 'text-primary/70'
                  }`}>
                    <span className="opacity-50">[{log.time}]</span> {log.message}
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
