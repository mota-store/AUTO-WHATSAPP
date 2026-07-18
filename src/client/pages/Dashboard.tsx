import { useState, useEffect } from 'react'
import { 
  Zap, 
  ShieldCheck, 
  MessageSquare, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ArrowRight,
  Wifi,
  WifiOff,
  History,
  Settings,
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
  const [instance, setInstance] = useState<WhatsappInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [connectMethod, setConnectMethod] = useState<'qr' | 'pairing'>('qr')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [copied, setCopied] = useState(false)

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
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (usePairing = false) => {
    if (usePairing && !phoneNumber) {
      toast.error('Digite o número do WhatsApp')
      return
    }

    setIsConnecting(true)
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/whatsapp/connect', {
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
      toast.success('Iniciando conexão...')
      if (usePairing) setConnectMethod('pairing')
    } catch (error) {
      toast.error('Erro ao conectar')
    } finally {
      setIsConnecting(false)
    }
  }

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Código copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans selection:bg-primary/30">
      <Sidebar />
      
      {/* Modal de Conexão Sofisticado */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowConnectModal(false)}></div>
          
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowConnectModal(false)}
              className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="p-10 md:p-16 space-y-10">
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Vincular WhatsApp</h2>
                <p className="text-zinc-500 font-medium">Escolha como deseja conectar sua conta</p>
              </div>

              <div className="flex p-1 bg-black/40 rounded-2xl border border-zinc-800/50">
                <button 
                  onClick={() => setConnectMethod('qr')}
                  className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${connectMethod === 'qr' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  QR CODE
                </button>
                <button 
                  onClick={() => setConnectMethod('pairing')}
                  className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${connectMethod === 'pairing' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  NÚMERO DE TELEFONE
                </button>
              </div>

              <div className="space-y-8">
                {connectMethod === 'qr' ? (
                  <div className="space-y-8 text-center">
                    <div className="relative aspect-square max-w-[240px] mx-auto bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-primary/10">
                      {instance?.qrCode ? (
                        <img src={instance.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                          <RefreshCw className="w-10 h-10 text-zinc-200 animate-spin" />
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gerando...</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                        1. Abra o WhatsApp no seu celular<br/>
                        2. Vá em <span className="text-white">Aparelhos Conectados</span><br/>
                        3. Aponte a câmera para este código
                      </p>
                      <button 
                        onClick={() => handleConnect(false)}
                        className="text-xs font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                      >
                        <RefreshCw className="w-3 h-3" /> Reiniciar Geração
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {instance?.pairingCode ? (
                      <div className="space-y-8 text-center">
                        <div className="space-y-2">
                          <p className="text-xs font-black text-primary uppercase tracking-widest">Seu Código</p>
                          <div className="flex items-center justify-center gap-4">
                            <span className="text-5xl font-black tracking-[0.2em] text-white font-mono">{instance.pairingCode}</span>
                            <button 
                              onClick={() => copyToClipboard(instance.pairingCode!)}
                              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-all"
                            >
                              {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                          Digite este código no seu celular após selecionar <br/>
                          <span className="text-white">"Conectar com número de telefone"</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Número do WhatsApp</label>
                          <input 
                            type="text" 
                            placeholder="Ex: 5591988887777"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-6 py-5 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => handleConnect(true)}
                          disabled={isConnecting}
                          className="w-full py-5 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                          {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                          Gerar Código de Acesso
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

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Header Sofisticado */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
                Olá, Bem-vindo
              </h1>
              <p className="text-zinc-500 font-medium flex items-center gap-2">
                Gerencie sua automação inteligente <ArrowRight className="w-4 h-4 text-primary" />
              </p>
            </div>

            <div className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/50 backdrop-blur-xl">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                instance?.status === 'connected' 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : 'bg-zinc-800 text-zinc-500'
              }`}>
                {instance?.status === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {instance?.status === 'connected' ? 'Sistema Online' : 'Sistema Offline'}
              </div>
              {instance?.status === 'connected' && (
                <button 
                  onClick={handleDisconnect}
                  className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-xl transition-all"
                  title="Desconectar"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>

          {/* Conteúdo Principal */}
          {!instance || instance.status === 'disconnected' ? (
            /* EMPTY STATE - SOFISTICADO */
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-emerald-500/20 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[3rem] p-12 lg:p-20 text-center space-y-8">
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/20 transform group-hover:scale-110 transition-transform duration-500">
                  <Smartphone className="w-12 h-12 text-white" />
                </div>
                <div className="max-w-md mx-auto space-y-4">
                  <h2 className="text-3xl font-black tracking-tight">Configure sua Conexão</h2>
                  <p className="text-zinc-500 font-medium leading-relaxed">
                    Para começar a automatizar suas mensagens, você precisa vincular sua conta do WhatsApp ao MOTA-FLOW. É rápido, seguro e criptografado.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <button 
                    onClick={() => { setConnectMethod('qr'); setShowConnectModal(true); handleConnect(false); }}
                    className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-black text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-5 h-5" /> Conectar via QR Code
                  </button>
                  <button 
                    onClick={() => { setConnectMethod('pairing'); setShowConnectModal(true); }}
                    className="w-full sm:w-auto px-10 py-5 bg-zinc-800/50 text-white rounded-2xl font-black text-sm border border-zinc-700 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-5 h-5" /> Conectar via Número
                  </button>
                </div>
              </div>
            </div>
          ) : instance.status === 'connecting' ? (
            /* TELA DE CONEXÃO ATIVA */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[3rem] p-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Vincular Dispositivo</h3>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Escolha o método preferido</p>
                  </div>
                </div>

                <div className="flex p-1 bg-black/40 rounded-2xl border border-zinc-800/50">
                  <button 
                    onClick={() => setConnectMethod('qr')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${connectMethod === 'qr' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    QR CODE
                  </button>
                  <button 
                    onClick={() => setConnectMethod('pairing')}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${connectMethod === 'pairing' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    NÚMERO DE TELEFONE
                  </button>
                </div>

                <div className="space-y-6">
                  {connectMethod === 'qr' ? (
                    <div className="space-y-6">
                      <div className="relative aspect-square max-w-[280px] mx-auto bg-white p-6 rounded-[2.5rem] shadow-2xl shadow-primary/10 group">
                        {instance.qrCode ? (
                          <img src={instance.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                            <RefreshCw className="w-10 h-10 text-zinc-200 animate-spin" />
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gerando Código...</p>
                          </div>
                        )}
                        <div className="absolute inset-0 border-4 border-primary/20 rounded-[2.5rem] group-hover:border-primary/40 transition-colors pointer-events-none"></div>
                      </div>
                      <p className="text-center text-sm text-zinc-500 font-medium">
                        Abra o WhatsApp {'>'} Configurações {'>'} Aparelhos Conectados
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {instance.pairingCode ? (
                        <div className="space-y-8 text-center py-4">
                          <div className="space-y-2">
                            <p className="text-xs font-black text-primary uppercase tracking-widest">Seu Código de Acesso</p>
                            <div className="flex items-center justify-center gap-3">
                              <span className="text-5xl font-black tracking-[0.2em] text-white font-mono">{instance.pairingCode}</span>
                              <button 
                                onClick={() => copyToClipboard(instance.pairingCode!)}
                                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-all"
                              >
                                {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                          <div className="bg-black/40 p-6 rounded-3xl border border-zinc-800/50 text-left space-y-3">
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Como usar:</p>
                            <ol className="text-sm text-zinc-300 space-y-2 font-medium list-decimal list-inside">
                              <li>Abra o WhatsApp no seu celular</li>
                              <li>Vá em Aparelhos Conectados</li>
                              <li>Clique em Conectar com número de telefone</li>
                              <li>Digite o código acima no seu celular</li>
                            </ol>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Número do WhatsApp</label>
                            <input 
                              type="text" 
                              placeholder="Ex: 5591988887777"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full px-6 py-5 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                            />
                          </div>
                          <button 
                            onClick={() => handleConnect(true)}
                            disabled={isConnecting}
                            className="w-full py-5 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                          >
                            {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                            Gerar Código de Acesso
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[3rem] p-10">
                  <h3 className="text-xl font-black mb-6">Status da Instância</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-zinc-800/30">
                      <span className="text-zinc-500 text-sm font-medium">Estado Atual</span>
                      <span className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                        <span className="w-2 h-2 bg-primary rounded-full animate-ping"></span>
                        Aguardando...
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-zinc-800/30">
                      <span className="text-zinc-500 text-sm font-medium">Segurança</span>
                      <span className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        Ativa
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-primary/10 to-emerald-500/10 border border-primary/20 rounded-[3rem] p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <MessageSquare className="w-32 h-32 text-primary" />
                  </div>
                  <div className="relative space-y-4">
                    <h4 className="text-lg font-black">Dica de Especialista</h4>
                    <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                      Mantenha seu celular conectado à internet para garantir que o robô responda instantaneamente. O MOTA-FLOW processa tudo em tempo real.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TELA DE CONECTADO - DASHBOARD REAL */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[2.5rem] p-8 space-y-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Número Ativo</p>
                  <h3 className="text-2xl font-black">+{instance.phoneNumber}</h3>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[2.5rem] p-8 space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Total de Respostas</p>
                  <h3 className="text-2xl font-black">1.240</h3>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[2.5rem] p-8 space-y-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Última Atividade</p>
                  <h3 className="text-2xl font-black">Agora mesmo</h3>
                </div>
              </div>

              <div className="md:col-span-3 bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-3xl rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-2xl font-black">Tudo pronto para escalar!</h3>
                  <p className="text-zinc-500 font-medium">Seu WhatsApp está conectado e os fluxos estão operando 24/7.</p>
                </div>
                <button 
                  onClick={() => navigate('/flows')}
                  className="px-10 py-5 bg-white text-black rounded-2xl font-black text-sm hover:bg-zinc-200 transition-all flex items-center gap-2"
                >
                  Ver Meus Fluxos <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
