import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Copy, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
        toast.success('Código gerado!')
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

  useEffect(() => {
    if (!code) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/dashboard', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const data = await response.json()
        if (data.instance?.status === 'connected') {
          addLog('WhatsApp conectado!')
          toast.success('WhatsApp conectado!')
          setTimeout(() => navigate('/dashboard'), 2000)
        }
      } catch (e) {}
    }, 5000)

    return () => clearInterval(interval)
  }, [code, navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 p-4 transition-colors duration-300 safe-top safe-bottom">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="glass-card p-6 space-y-5 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Phone className="w-8 h-8 text-primary" />
          </div>
          
          <h1 className="text-xl font-black gradient-text-whatsapp">Conectar via Número</h1>
          <p className="text-zinc-500 text-sm">
            Receba um código de 8 dígitos para conectar seu WhatsApp.
          </p>

          {!code ? (
            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3.5 px-4 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-center text-lg font-bold outline-none"
              />
              <button
                onClick={handleRequestCode}
                disabled={loading}
                className="btn-touch w-full bg-primary text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar Código'}
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="bg-zinc-900/50 p-5 rounded-2xl border-2 border-dashed border-primary/30">
                <span className="text-3xl font-mono font-black tracking-widest text-primary block mb-4">
                  {code}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 mx-auto text-sm font-bold text-primary hover:opacity-80 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'COPIADO!' : 'COPIAR CÓDIGO'}
                </button>
              </div>

              <div className="text-left space-y-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Passo a passo:</p>
                <ol className="text-sm text-zinc-400 space-y-1.5 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular</li>
                  <li>Vá em <b>Aparelhos Conectados</b></li>
                  <li>Toque em <b>Conectar um aparelho</b></li>
                  <li>Toque em <b>Conectar com número</b></li>
                  <li>Insira o código acima</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Logs</h2>
          </div>
          <div className="space-y-1 font-mono text-[10px] text-zinc-500 h-24 overflow-y-auto">
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} className="border-l-2 border-zinc-800 pl-2 py-0.5">
                {log}
              </div>
            )) : (
              <p className="italic">Aguardando...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
