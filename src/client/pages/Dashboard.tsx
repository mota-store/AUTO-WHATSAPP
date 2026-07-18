import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Zap, 
  ShieldCheck, 
  MessageSquare, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Copy, 
  CheckCircle2, 
  Wifi,
  WifiOff,
  History,
  ArrowRight,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import Sidebar from '../components/Sidebar'

interface WhatsappInstance {
  id: number
  status: 'connected' | 'disconnected' | 'connecting'
  phoneNumber?: string
  qrCode?: string
  pairingCode?: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WhatsappInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectMethod, setConnectMethod] = useState<'qr' | 'pairing'>(() => {
    return (localStorage.getItem('mota_connect_method') as 'qr' | 'pairing') || 'qr'
  })

  useEffect(() => {
    localStorage.setItem('mota_connect_method', connectMethod)
  }, [connectMethod])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPairingLoading, setShowPairingLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setInstance(data.instance)
        // Se o pairing code chegou, parar o loading imediatamente
        if (data.instance?.pairingCode && showPairingLoading) {
          setShowPairingLoading(false)
        }
        // Se conectou, fechar modal e parar loading
        if (data.instance?.status === 'connected') {
          setShowConnectModal(false)
          setShowPairingLoading(false)
          stopFastPolling()
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  // Start fast polling when modal is open (every 2s instead of 5s)
  const startFastPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    loadDashboard() // Executa imediatamente
    pollRef.current = setInterval(loadDashboard, 2000)
  }

  const stopFastPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const handleConnect = async (usePairing = false) => {
    if (usePairing && !phoneNumber) {
      toast.error('Digite o número do WhatsApp')
      return
    }
    setIsConnecting(true)

    if (usePairing) {
      setShowPairingLoading(true)
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          phoneNumber: usePairing ? phoneNumber : undefined,
          usePairingCode: usePairing 
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.message || 'Erro ao conectar')
        if (usePairing) setShowPairingLoading(false)
        return
      }

      // Conectou com sucesso, iniciar polling rápido
      startFastPolling()

      if (usePairing) {
        // Para pairing, esperar um pouco e fazer refresh para pegar o código
        setTimeout(() => {
          loadDashboard()
        }, 3000)
        // Se após 15s não tiver código, mostrar erro
        setTimeout(() => {
          if (usePairing && !instance?.pairingCode) {
            loadDashboard() // última tentativa
            // Check via state if still no code
          }
        }, 15000)
      }
    } catch (error) {
      toast.error('Erro de conexão')
      if (usePairing) setShowPairingLoading(false)
    } finally {
      setIsConnecting(false)
    }
  }

  // Stop fast polling when modal closes
  useEffect(() => {
    if (!showConnectModal) {
      stopFastPolling()
      setShowPairingLoading(false)
    }
  }, [showConnectModal])

  const handleDisconnect = async () => {
    if (!instance) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/whatsapp/${instance.id}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success('Instância desconectada')
      setInstance(null)
    } catch (error) {
      toast.error('Erro ao desconectar')
    }
  }

  const handleReset = async () => {
    if (!instance) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/whatsapp/${instance.id}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      // Limpar estados locais
      setInstance({ ...instance, qrCode: undefined, pairingCode: undefined })
      setPhoneNumber('')
      setShowPairingLoading(false)
    } catch (error) {
      console.error('Erro ao resetar')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Código copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Monitorar status da instância para fechar o modal
  useEffect(() => {
    if (instance?.status === 'connected' && showConnectModal) {
      setShowConnectModal(false)
      setShowPairingLoading(false)
      stopFastPolling()
      toast.success('WhatsApp conectado com sucesso!')
    }
  }, [instance?.status, showConnectModal])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans selection:bg-primary/30 safe-top safe-bottom">
      <Sidebar />
      
      {/* Modal de Conexão */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConnectModal(false)}></div>
          
            <div className="relative w-full max-w-lg bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto pb-10">
            <button 
              onClick={() => setShowConnectModal(false)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2 pt-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Vincular WhatsApp</h2>
                <p className="text-zinc-500 text-sm font-medium">Escolha como deseja conectar</p>
              </div>

              <div className="flex p-1 bg-black/40 rounded-xl border border-zinc-800/50">
                <button 
                  onClick={() => { 
                    setConnectMethod('qr'); 
                    handleReset();
                  }}
                  className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${connectMethod === 'qr' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
                >
                  QR CODE
                </button>
                <button 
                  onClick={() => { 
                    setConnectMethod('pairing'); 
                    handleReset();
                  }}
                  className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${connectMethod === 'pairing' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
                >
                  NÚMERO
                </button>
              </div>

              <div className="space-y-6">
                {connectMethod === 'qr' ? (
                  <div className="space-y-6 text-center">
                    <div className="relative aspect-square max-w-[200px] mx-auto bg-white p-4 rounded-2xl shadow-xl shadow-primary/10">
                      {instance?.qrCode ? (
                        <img src={instance.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                          {!instance?.pairingCode ? (
                            <>
                              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gerando QR...</p>
                              <p className="text-[9px] text-zinc-500">Aguarde alguns segundos</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">MODO NÚMERO ATIVO</p>
                              <p className="text-[9px] text-zinc-500">Use o código abaixo</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                        1. Abra o WhatsApp no celular<br/>
                        2. Vá em <span className="text-white">Aparelhos Conectados</span><br/>
                        3. Aponte a câmera para o código
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {instance?.pairingCode ? (
                      // CÓDIGO GERADO
                      <div className="space-y-6 text-center py-2">
                        <p className="text-xs font-black text-primary uppercase tracking-widest">Seu Código</p>
                        
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-4xl font-black tracking-[0.15em] text-white font-mono">{instance.pairingCode.replace(/^(.{4})(.{4})$/, '$1-$2')}</span>
                          <button 
                            onClick={() => copyToClipboard(instance.pairingCode!)}
                            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        
	                        <div className="flex justify-center">
	                          <button 
	                            onClick={handleReset}
	                            className="px-8 py-3 bg-red-600 text-white text-[11px] font-black rounded-xl shadow-lg shadow-red-600/20 transition-all uppercase tracking-widest active:scale-95"
	                          >
	                            Trocar de Número
	                          </button>
	                        </div>

                        <div className="bg-black/30 p-5 rounded-2xl border border-zinc-800/50 text-left space-y-3">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Passo a passo:</p>
                          <ol className="text-sm text-zinc-300 space-y-2 font-medium">
                            <li className="flex gap-2">
                              <span className="text-primary font-black">1.</span>
                              Abra o WhatsApp no seu celular
                            </li>
                            <li className="flex gap-2">
                              <span className="text-primary font-black">2.</span>
                              Toque em Configurações &gt; Aparelhos Conectados
                            </li>
                            <li className="flex gap-2">
                              <span className="text-primary font-black">3.</span>
                              Toque em Conectar um aparelho &gt; Conectar com número
                            </li>
                            <li className="flex gap-2">
                              <span className="text-primary font-black">4.</span>
                              Digite o código acima
                            </li>
                          </ol>
                        </div>
                      </div>
                    ) : (
                      // INPUT DE NÚMERO
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Número do WhatsApp</label>
                          <input 
                            type="tel" 
                            placeholder="Ex: 5591988887777"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-5 py-4 bg-black/40 border border-zinc-800 rounded-xl font-bold focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none text-base"
                          />
                        </div>
                        <div className="space-y-3">
                          <button 
                            onClick={() => handleConnect(true)}
                            disabled={isConnecting || !phoneNumber}
                            className="w-full py-4 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {isConnecting ? (
                              <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Zap className="w-5 h-5" />
                                Gerar Código
                              </>
                            )}
                          </button>
	                          {(instance?.pairingCode || instance?.phoneNumber) && (
	                            <button 
	                              onClick={handleReset}
	                              className="w-full py-3 bg-red-600/10 text-red-500 border border-red-600/20 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600/20 transition-all active:scale-95"
	                            >
	                              Limpar Conexão Pendente
	                            </button>
	                          )}
	                          <p className="text-[10px] text-zinc-500 text-center font-medium animate-pulse">
	                            Aguarde, a notificação chegará em instantes no seu celular
	                          </p>
	                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-72 px-4 pt-6 pb-8 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-2xl mx-auto w-full space-y-5">
          
          {/* Header */}
          <header className="flex flex-col items-center text-center gap-3">
            <div className="space-y-1 -translate-x-[5px]">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
                Olá, Bem-vindo
              </h1>
              <p className="text-zinc-500 text-sm font-medium flex items-center justify-center gap-2">
                Sua automação está pronta <Zap className="w-3 h-3 text-primary" />
              </p>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-2 rounded-xl border border-zinc-800/50 backdrop-blur-xl">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                instance?.status === 'connected' 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : 'bg-zinc-800 text-zinc-500'
              }`}>
                {instance?.status === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {instance?.status === 'connected' ? 'Online' : 'Offline'}
              </div>
              {instance?.status === 'connected' && (
                <button 
                  onClick={handleDisconnect}
                  className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                  title="Desconectar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </header>

	          {/* Conteúdo Principal */}
	          {!instance || instance.status !== 'connected' ? (
	            <div className="relative group">
	              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-emerald-500/10 rounded-[2rem] blur-xl opacity-40"></div>
	              <div className="relative bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-[2rem] p-6 sm:p-8 text-center space-y-6">
	                <div className="w-16 h-16 bg-gradient-to-br from-primary to-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-primary/20">
	                  <Smartphone className="w-8 h-8 text-white" />
	                </div>
	                <div className="space-y-3">
	                  <h2 className="text-xl font-black tracking-tight">Configure sua Conexão</h2>
	                  <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
	                    Vincule seu WhatsApp ao MOTA-FLOW para começar a automatizar.
	                  </p>
	                </div>
	                <div className="flex flex-col gap-3 pt-2">
	                  <button 
	                    onClick={() => { 
	                      setConnectMethod('qr'); 
	                      setShowConnectModal(true);
	                      handleConnect(false); // Inicia conexão QR imediatamente
	                    }}
	                    className="w-full py-4 bg-white text-black rounded-xl font-black text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95"
	                  >
	                    <Zap className="w-4 h-4" /> Conectar via QR Code
	                  </button>
	                  <button 
	                    onClick={() => { setConnectMethod('pairing'); setShowConnectModal(true); }}
	                    className="w-full py-4 bg-zinc-800/50 text-white rounded-xl font-black text-sm border border-zinc-700 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 active:scale-95"
	                  >
	                    <Smartphone className="w-4 h-4" /> Conectar via Número
	                  </button>
	                </div>
	              </div>
	            </div>
	          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Número Ativo</p>
                    <h3 className="text-lg font-black">+{instance.phoneNumber}</h3>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Respostas</p>
                    <h3 className="text-lg font-black">1.240</h3>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-5 space-y-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Atividade</p>
                    <h3 className="text-lg font-black">Agora</h3>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-lg font-black">Tudo pronto!</h3>
                  <p className="text-zinc-500 text-sm font-medium">Seu WhatsApp está conectado 24/7.</p>
                </div>
                <button 
                  onClick={() => navigate('/flows')}
                  className="w-full sm:w-auto px-8 py-3 bg-white text-black rounded-xl font-black text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  Ver Meus Fluxos <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
