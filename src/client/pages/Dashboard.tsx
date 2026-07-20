import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Copy, 
  CheckCircle2, 
  Wifi,
  WifiOff,
  ArrowRight,
  X,
  BookOpen,
  AlertTriangle,
  Trash2,
  Layers,
  Activity,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import Sidebar from '../components/Sidebar'
import Tutorial from '../components/Tutorial'

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
  const [flows, setFlows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
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
  const [isReconnecting, setIsReconnecting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem('token')
      
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.json()).then(userData => {
        if (userData && userData.avatar) {
          localStorage.setItem('profileImage', userData.avatar)
          localStorage.setItem('user', JSON.stringify(userData))
        }
      }).catch(() => {})

      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setInstance(data.instance)
        setFlows(data.flows || [])
        
        if (data.instance?.pairingCode) {
          setShowPairingLoading(false)
          setIsConnecting(false)
        }
        
        if (data.instance?.status === 'connected') {
          setShowConnectModal(false)
          setShowPairingLoading(false)
          setIsConnecting(false)
          stopFastPolling()
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startFastPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    loadDashboard()
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
        setIsConnecting(false)
        setShowPairingLoading(false)
        return
      }

      startFastPolling()
      
    } catch (error) {
      toast.error('Erro de conexão')
      setIsConnecting(false)
      setShowPairingLoading(false)
    }
  }

  useEffect(() => {
    if (!showConnectModal) {
      stopFastPolling()
      setShowPairingLoading(false)
    }
  }, [showConnectModal])

  const handleDisconnect = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (response.ok) {
        toast.success('WhatsApp desconectado')
        setInstance(null)
        setTimeout(() => loadDashboard(), 500)
      } else {
        throw new Error('Falha na resposta')
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error)
      toast.error('Erro ao desconectar')
    }
  }

  const handleReset = async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/whatsapp/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setInstance(null)
      setPhoneNumber('')
      setShowPairingLoading(false)
      setIsConnecting(false)
      setTimeout(() => loadDashboard(), 500)
    } catch (error) {
      console.error('Erro ao resetar:', error)
      toast.error('Erro ao resetar conexão')
    }
  }

  const handleReconnect = async () => {
    try {
      setIsReconnecting(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/whatsapp/reconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        toast.success('Dando um choque na conexão...')
        
        if (instance?.phoneNumber) {
          setPhoneNumber(instance.phoneNumber)
          setConnectMethod('pairing')
          setShowConnectModal(true)
          setShowPairingLoading(true)
        }
        
        startFastPolling()
      } else {
        const data = await response.json()
        toast.error(data.message || 'Erro ao reconectar')
      }
    } catch (error) {
      console.error('Erro ao reconectar:', error)
      toast.error('Erro ao reconectar ao WhatsApp')
    } finally {
      setIsReconnecting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Código copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

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
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <Zap className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans selection:bg-primary/30 safe-top safe-bottom">
      <Sidebar />
      
      {/* Modal de Conexão (Elite UI) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConnectModal(false)}></div>
          
            <div className="relative w-full max-w-lg bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto pb-10">
            <button 
              onClick={() => setShowConnectModal(false)}
              className="absolute top-6 right-6 p-3 text-zinc-500 hover:text-white hover:bg-white/10 rounded-2xl transition-all z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="p-8 sm:p-10 space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Vincular WhatsApp</h2>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Escolha o método de conexão</p>
              </div>

              <div className="flex p-1.5 bg-black/40 rounded-2xl border border-zinc-800/50">
                <button 
                  onClick={() => { setConnectMethod('qr'); handleReset(); }}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${connectMethod === 'qr' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500'}`}
                >
                  QR CODE
                </button>
                <button 
                  onClick={() => { setConnectMethod('pairing'); handleReset(); }}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${connectMethod === 'pairing' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500'}`}
                >
                  CÓDIGO POR NÚMERO
                </button>
              </div>

              <div className="space-y-6">
                {connectMethod === 'qr' ? (
                  <div className="space-y-8 text-center">
                    <div className="relative aspect-square max-w-[220px] mx-auto bg-white p-5 rounded-[2.5rem] shadow-2xl shadow-primary/20">
                      {instance?.qrCode ? (
                        <img src={instance.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gerando...</p>
                        </div>
                      )}
                    </div>
                    <div className="bg-black/30 p-6 rounded-[2rem] border border-zinc-800/50">
                       <p className="text-sm text-zinc-400 font-bold leading-relaxed">
                        1. Abra o WhatsApp no celular<br/>
                        2. Vá em <span className="text-white">Aparelhos Conectados</span><br/>
                        3. Aponte a câmera para o código
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {instance?.pairingCode ? (
                      <div className="space-y-8 text-center py-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Seu Código de Acesso</p>
                          <div className="flex items-center justify-center gap-4">
                            <span className="text-5xl font-black tracking-[0.2em] text-white font-mono">{instance.pairingCode.replace(/^(.{4})(.{4})$/, '$1-$2')}</span>
                            <button 
                              onClick={() => copyToClipboard(instance.pairingCode!)}
                              className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-all shadow-lg active:scale-90"
                            >
                              {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        
                        <button onClick={handleReset} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Trocar de Número</button>

                        <div className="bg-black/30 p-6 rounded-[2rem] border border-zinc-800/50 text-left space-y-4">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Passo a passo:</p>
                          <ol className="text-sm text-zinc-300 space-y-3 font-bold">
                            <li className="flex gap-3"><span className="text-primary">1.</span> Abra o WhatsApp no celular</li>
                            <li className="flex gap-3"><span className="text-primary">2.</span> Aparelhos Conectados &gt; Conectar com número</li>
                            <li className="flex gap-3"><span className="text-primary">3.</span> Digite o código acima</li>
                          </ol>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Número do WhatsApp</label>
                          <input 
                            type="tel" 
                            placeholder="Ex: 5591988887777"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-6 py-5 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-lg shadow-inner"
                          />
                        </div>
                        <button 
                          onClick={() => handleConnect(true)}
                          disabled={isConnecting || !phoneNumber}
                          className="w-full py-5 bg-primary text-black rounded-2xl font-black text-sm shadow-2xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                          {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                          GERAR CÓDIGO AGORA
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-72 px-4 pt-8 pb-12 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-3xl mx-auto w-full space-y-8">
          
          {/* Header de Elite com Trio de Botões */}
          <header className="flex flex-col items-center text-center gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                Olá, Bem-vindo
              </h1>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                Sua automação está pronta <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
              </p>
            </div>

            {/* Barra de Controle Pro */}
            <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-2xl p-2 rounded-[2rem] border border-zinc-800/50 shadow-2xl shadow-black/50">
              
              {/* Status com Glow */}
              <div className={`flex items-center gap-3 px-5 py-2.5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${
                instance?.status === 'connected' 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${instance?.status === 'connected' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`}></div>
                {instance?.status === 'connected' ? 'Online' : 'Offline'}
              </div>

              <div className="h-6 w-[1px] bg-zinc-800 mx-1"></div>

              {/* Botões de Ação Elite */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowTutorial(true)}
                  className="p-3 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all group"
                  title="Ver Tutorial"
                >
                  <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
                
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="p-3 bg-zinc-800/50 hover:bg-primary/20 text-zinc-400 hover:text-primary rounded-xl transition-all group disabled:opacity-50"
                  title="Dar Choque na Sessão (🔁)"
                >
                  <RefreshCw className={`w-5 h-5 group-hover:rotate-180 transition-all duration-500 ${isReconnecting ? 'animate-spin' : ''}`} />
                </button>

                <button 
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                  }}
                  className="p-3 bg-zinc-800/50 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-xl transition-all group"
                  title="Sair do Sistema"
                >
                  <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </header>

          {/* Conteúdo Principal (Elite Design) */}
          {!instance || instance.status !== 'connected' ? (
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-3xl rounded-[3rem] p-8 sm:p-12 text-center space-y-8 shadow-2xl">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-emerald-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl shadow-primary/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <Smartphone className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black tracking-tight">Configure sua Conexão</h2>
                  <p className="text-zinc-500 text-sm font-bold leading-relaxed max-w-xs mx-auto uppercase tracking-tighter">
                    Vincule seu WhatsApp para liberar o poder do <span className="text-white">MOTA-FLOW</span>.
                  </p>
                </div>
                <div className="flex flex-col gap-4 pt-4">
                  <button 
                    onClick={() => { setConnectMethod('qr'); setShowConnectModal(true); handleConnect(false); }}
                    className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                  >
                    <Zap className="w-5 h-5 fill-black" /> CONECTAR VIA QR CODE
                  </button>
                  <button 
                    onClick={() => { setConnectMethod('pairing'); setShowConnectModal(true); }}
                    className="w-full py-5 bg-zinc-800/50 text-white rounded-[1.5rem] font-black text-sm border border-zinc-700 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Smartphone className="w-5 h-5" /> CONECTAR VIA NÚMERO
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              
              {/* Cards de Métricas Elite */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-xl rounded-[2rem] p-6 space-y-4 hover:border-emerald-500/30 transition-all group">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Número Ativo</p>
                    <h3 className="text-xl font-black">+{instance.phoneNumber}</h3>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-xl rounded-[2rem] p-6 space-y-4 hover:border-primary/30 transition-all group">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Fluxo Ativo</p>
                    <h3 className="text-sm font-black truncate max-w-[150px]">
                      {flows.find(f => f.isActive)?.name || 'Nenhum Ativo'}
                    </h3>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-xl rounded-[2rem] p-6 space-y-4 hover:border-blue-500/30 transition-all group">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Servidor</p>
                    <h3 className="text-sm font-black text-blue-500 uppercase">Estável</h3>
                  </div>
                </div>
              </div>

              {/* Card de Ação Rápida */}
              <div className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800/50 rounded-[2.5rem] p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-2xl font-black tracking-tight">Tudo pronto!</h3>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-tighter">Seu robô está operando 24h por dia.</p>
                </div>
                <button 
                  onClick={() => navigate('/flows')}
                  className="w-full sm:w-auto px-10 py-4 bg-white text-black rounded-[1.5rem] font-black text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95"
                >
                  MEUS FLUXOS <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  )
}
