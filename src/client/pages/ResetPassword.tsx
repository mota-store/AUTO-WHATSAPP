import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, CheckCircle2 } from 'lucide-react'

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      return toast.error('As senhas não coincidem')
    }
    if (newPassword.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres')
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await response.json()
      if (response.ok) {
        setSuccess(true)
        toast.success('Senha redefinida!')
      } else {
        toast.error(data.message || 'Erro ao redefinir senha')
      }
    } catch (error) {
      toast.error('Erro de conexão')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg px-4 relative overflow-hidden safe-top safe-bottom">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="w-full max-w-md relative z-10 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black gradient-text-whatsapp tracking-tighter">Senha Redefinida!</h1>
          <p className="text-muted-foreground font-medium text-sm">Sua senha foi alterada com sucesso.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4 relative overflow-hidden safe-top safe-bottom">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-primary rounded-2xl shadow-primary animate-float mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black gradient-text-whatsapp mb-1 tracking-tighter">Nova Senha</h1>
          <p className="text-muted-foreground text-sm font-medium">Defina uma nova senha para sua conta</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-3 py-3 bg-background/50 border border-border rounded-xl input-focus font-medium text-base"
                placeholder="Mín. 6 caracteres"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Confirmar Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-3 py-3 bg-background/50 border border-border rounded-xl input-focus font-medium text-base"
                placeholder="Repita a nova senha"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3.5 text-base rounded-xl flex items-center justify-center gap-2 group active:scale-95"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Redefinir Senha'
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
          &copy; 2026 MOTA-FLOW
        </p>
      </div>
    </div>
  )
}
