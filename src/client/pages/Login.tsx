import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, Lock, Eye, EyeOff, Wifi, ArrowRight } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        toast.success('Login realizado com sucesso!')
        navigate('/dashboard')
      } else {
        toast.error(data.message || 'Erro ao fazer login')
      }
    } catch (error) {
      toast.error('Erro ao conectar ao servidor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-primary rounded-3xl shadow-primary animate-float mb-6">
            <Wifi className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black gradient-text-whatsapp mb-2 tracking-tighter">MOTA-FLOW</h1>
          <p className="text-muted-foreground font-medium">Acesse sua central de automação</p>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-smooth" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-background/50 border border-border rounded-2xl input-focus font-medium"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1 mb-1">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Senha</label>
                <a href="#" className="text-[10px] font-black text-primary hover:underline uppercase tracking-tighter">Esqueceu a senha?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-smooth" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-4 bg-background/50 border border-border rounded-2xl input-focus font-medium"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-primary transition-smooth btn-touch z-20"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-4 text-lg rounded-2xl flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar na Plataforma
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-smooth" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-muted-foreground font-medium text-sm">
              Ainda não tem uma conta?{' '}
              <Link to="/register" className="text-primary font-black hover:underline ml-1">
                Crie sua conta grátis
              </Link>
            </p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
          &copy; 2026 MOTA-FLOW &bull; PREMIUM AUTOMATION
        </p>
      </div>
    </div>
  )
}
