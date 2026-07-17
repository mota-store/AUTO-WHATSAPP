import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Copy, Check, ArrowLeft, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import ThemeToggle from '../components/ThemeToggle'

export default function Pairing() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const navigate = useNavigate()

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10))
  }

  const handleRequestCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Informe um número válido com DDD')
      return
    }

    setLoading(true)
    addLog(`Solicitando código para ${phoneNumber}...`)
    
    try {
      const response = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phoneNumber })
      })

      const data = await response.json()
      if (response.ok) {
        setCode(data.code)
        addLog('Código gerado com sucesso!')
        toast.success('Código gerado! Insira-o no seu WhatsApp.')
      } else {
        toast.error(data.message || 'Erro ao gerar código')
        addLog(`Erro: ${data.message}`)
      }
    } catch (error) {
      toast.error('Erro de conexão')
      addLog('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Código copiado!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Polling para verificar status da conexão
  useEffect(() => {
    if (!code) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/dashboard', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const data = await response.json()
        if (data.instance?.status === 'connected') {
          addLog('✅ WhatsApp conectado!')
          toast.success('WhatsApp conectado com sucesso!')
          setTimeout(() => navigate('/dashboard'), 2000)
        }
      } catch (e) {}
    }, 5000)

    return () => clearInterval(interval)
  }, [code, navigate])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-white dark:hover:bg-slate-900 rounded-full transition-all shadow-sm"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <ThemeToggle />
        </div>

        <div className="glass-card p-8 space-y-6 text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-10 h-10 text-whatsapp" />
          </div>
          
          <h1 className="text-2xl font-bold gradient-text-whatsapp">Conectar via Número</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Receba um código de 8 dígitos para conectar seu WhatsApp sem precisar escanear o QR Code.
          </p>

          {!code ? (
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: 5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-whatsapp transition-all text-center text-lg font-medium"
                />
              </div>
              <button
                onClick={handleRequestCode}
                disabled={loading}
                className="btn-touch w-full bg-whatsapp text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Código de Conexão'}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-3xl border-2 border-dashed border-whatsapp/30">
                <span className="text-4xl font-mono font-black tracking-widest text-whatsapp block mb-4">
                  {code}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 mx-auto text-sm font-bold text-whatsapp hover:opacity-80 transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'COPIADO!' : 'COPIAR CÓDIGO'}
                </button>
              </div>

              <div className="text-left space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Passo a passo:</p>
                <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Vá em <b>Aparelhos Conectados</b></li>
                  <li>Toque em <b>Conectar um aparelho</b></li>
                  <li>Toque em <b>Conectar com número de telefone</b></li>
                  <li>Insira o código acima</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Logs em Tempo Real */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logs da Instância</h2>
          </div>
          <div className="space-y-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 h-32 overflow-y-auto">
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} className="border-l-2 border-slate-200 dark:border-slate-800 pl-3 py-1">
                {log}
              </div>
            )) : (
              <p className="italic">Aguardando atividades...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
