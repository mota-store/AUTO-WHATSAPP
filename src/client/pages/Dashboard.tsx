import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Plus, Eye, Edit2, Trash2, RefreshCw, Wifi, WifiOff, Smartphone, QrCode, Copy, ExternalLink, X, Check, AlertTriangle } from 'lucide-react'
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

type ConnectionMethod = 'qr' | 'pairing' | null

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
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(null)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<ConnectionLog[]>([])
  const [connectionError, setConnectionError] = useState('')
  const [connectionActive, setConnectionActive] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string>('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Monitor status changes ONLY when connection is actively being attempted
  useEffect(() => {
    if (!instance || !connectionActive) return

    const currentStatus = instance.status
    const prevStatus = prevStatusRef.current

    // QR Code foi gerado — avançar progresso
    if (connectionMethod === 'qr' && currentStatus === 'connecting' && instance.qrCode && progress < 40) {
      setProgress(40)
      addLog('QR Code gerado! Escaneie agora.', 'info')
    }

    // Pairing Code foi gerado — avançar progresso
    if (connectionMethod === 'pairing' && pairingCode && progress < 40) {
      setProgress(40)
      addLog(`Código gerado: ${pairingCode}`, 'info')
    }

    // Conectado com sucesso
    if (currentStatus === 'connected') {
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

    // Erro na conexão (disconnected durante tentativa ativa)
    if (currentStatus === 'disconnected' && prevStatus === 'connecting' && connectionActive) {
      setConnectionError('A conexão foi interrompida pelo servidor do WhatsApp.')
      addLog('Erro: Conexão interrompida', 'error')
      setConnectionActive(false)
      setProgress(0)
    }

    prevStatusRef.current = currentStatus
  }, [instance, pairingCode, connectionActive, connectionMethod, progress])

  // Auto-scroll logs
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
      toast.error('Digite o número do telefone com DDD (ex: 5511999999999)')
      return
    }

    setIsConnecting(true)
    setPairingCode('')
    setConnectionActive(true)
    setConnectionMethod(usePairingCode ? 'pairing' : 'qr')
    setShowConnectionScreen(true) // Abrir tela IMEDIATAMENTE ao clicar
    setProgress(10)
    setConnectionError('')
    setLogs([])
    addLog('Iniciando conexão segura...', 'info')
    addLog(usePairingCode ? 'Solicitando código de pareamento...' : 'Gerando QR Code...', 'info')

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
          addLog(`Código gerado: ${data.pairingCode}`, 'info')
          setProgress(40)
        } else {
          addLog('Aguardando geração do QR Code...', 'info')
          setProgress(25)
        }
      } else {
        setConnectionError(data.message || 'Erro ao conectar')
        addLog(`Erro: ${data.message || 'Falha na API'}`, 'error')
        setConnectionActive(false)
      }
    } catch (error) {
      setConnectionError('Erro de rede ao conectar ao servidor')
      addLog('Erro: Falha na comunicação com o servidor', 'error')
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
        setPairingCode('')
        setConnectionActive(false)
        setShowConnectionScreen(false)
        setConnectionMethod(null)
        setProgress(0)
        setLogs([])
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

  const closeConnectionScreen = () => {
    setConnectionActive(false)
    setShowConnectionScreen(false)
    setConnectionMethod(null)
    setProgress(0)
    setLogs([])
    setConnectionError('')
  }

  // Connection Screen Overlay — só aparece quando connectionActive é true
  if (showConnectionScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="w-full max-w-lg mx-4 glass-card rounded-3xl p-8 relative">
          {/* Close button */}
          <button
            onClick={closeConnectionScreen}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-smooth"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              connectionError ? 'bg-red-500/20' : 'bg-primary/20'
            }`}>
              {connectionError ? (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              ) : progress >= 100 ? (
                <Check className="w-8 h-8 text-green-500" />
              ) : (
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              )}
            </div>
            <h2 className="text-2xl font-black">
              {connectionError
                ? 'Erro na Conexão'
                : progress >= 100
                  ? 'Conectado!'
                  : 'Conectando ao WhatsApp'}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {connectionError
                ? 'Tente novamente ou envie o erro para suporte.'
                : connectionMethod === 'qr'
                  ? 'Abra o WhatsApp e escaneie o QR Code'
                  : 'Insira o código no seu celular'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
              <span>{progress >= 100 ? 'Concluído' : `${progress}%`}</span>
              <span>{connectionMethod === 'qr' ? 'QR Code' : 'Pairing Code'}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  connectionError ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* QR Code or Pairing Code Display */}
          {connectionMethod === 'qr' && instance?.qrCode && !connectionError && (
            <div className="bg-white p-4 rounded-2xl mx-auto w-fit mb-6 shadow-lg">
              <img src={instance.qrCode} alt="QR Code" className="w-48 h-48" />
            </div>
          )}

          {connectionMethod === 'pairing' && pairingCode && !connectionError && (
            <div className="text-center mb-6">
              <div className="text-4xl font-mono font-black text-primary tracking-[0.2em] bg-primary/10 py-6 rounded-2xl border-2 border-primary/20 inline-block cursor-pointer" onClick={() => copyToClipboard(pairingCode)}>
                {pairingCode}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Toque para copiar</p>
            </div>
          )}

          {/* Error Display */}
          {connectionError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-red-400 font-bold">{connectionError}</p>
              <button
                onClick={() => {
                  closeConnectionScreen()
                }}
                className="mt-4 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-smooth btn-touch"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Live Logs */}
          <div className="bg-muted/50 rounded-2xl p-4 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Logs de Conexão</p>
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aguardando início...</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">{log.time}</span>
                    <span className={`font-medium ${
                      log.status === 'success' ? 'text-green-400' :
                      log.status === 'error' ? 'text-red-400' :
                      log.status === 'warning' ? 'text-yellow-400' : 'text-foreground'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
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
                            <p className="text-xs font-bold uppercase tracking-tighter">Gerando código...</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setShowConnectionScreen(true)
                          setConnectionActive(true)
                          setConnectionMethod('qr')
                          setProgress(40)
                          addLog('Monitorando conexão via QR Code...', 'info')
                        }}
                        className="mt-6 btn-primary px-6 py-3 flex items-center gap-2"
                      >
                        <RefreshCw className="w-5 h-5" />
                        Monitorar Conexão
                      </button>
                    </div>

                    {/* Pairing Code Navigation */}
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-3xl border border-border/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-smooth">
                        <Smartphone className="w-32 h-32" />
                      </div>
                      <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-primary" /> 2. Código de Pareamento
                      </h3>
                      <p className="text-sm text-muted-foreground text-center mb-8">
                        Prefere conectar usando o número de telefone? Clique no botão abaixo para gerar um código de 8 dígitos.
                      </p>
                      <button
                        onClick={() => navigate('/pairing')}
                        className="w-full py-4 bg-whatsapp text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 btn-touch transition-all hover:opacity-90"
                      >
                        <Phone className="w-5 h-5" />
                        Conectar via Número
                      </button>
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
