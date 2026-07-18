import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  User, 
  Lock, 
  Mail, 
  Save, 
  RefreshCw, 
  ShieldCheck,
  ChevronRight,
  LogOut
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

export default function Settings() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      return toast.error('As senhas não coincidem')
    }
    if (newPassword.length < 6) {
      return toast.error('A nova senha deve ter pelo menos 6 caracteres')
    }

    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await response.json()
      if (response.ok) {
        toast.success('Senha atualizada com sucesso!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.message || 'Erro ao atualizar senha')
      }
    } catch (error) {
      toast.error('Erro de rede')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              <span>Segurança & Perfil</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter">Configurações</h1>
            <p className="text-muted-foreground font-medium">Gerencie suas informações pessoais e segurança da conta.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Profile Info */}
            <div className="md:col-span-1 space-y-6">
              <div className="glass-card rounded-[2rem] p-8 text-center border-2 border-primary/10 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-700"></div>
                <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-black tracking-tight">{user.name || 'Usuário'}</h3>
                <p className="text-sm text-muted-foreground font-medium flex items-center justify-center gap-2 mt-1">
                  <Mail className="w-4 h-4" /> {user.email}
                </p>
                
                <button 
                  onClick={handleLogout}
                  className="mt-8 w-full py-4 bg-destructive/10 text-destructive rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-destructive hover:text-white transition-all btn-touch"
                >
                  <LogOut className="w-5 h-5" />
                  Sair da Conta
                </button>
              </div>

              <div className="bg-muted/30 rounded-[2rem] p-6 border border-border/50">
                <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Status da Conta
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Plano</span>
                    <span className="font-bold text-primary">Premium</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span className="font-bold">Ilimitado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <div className="md:col-span-2">
              <div className="glass-card rounded-[2.5rem] p-8 sm:p-10 border border-border/50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Alterar Senha</h3>
                    <p className="text-sm text-muted-foreground">Mantenha sua conta protegida.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black ml-2 uppercase tracking-tighter text-muted-foreground">Senha Atual</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-5 bg-background border border-border rounded-2xl input-focus font-medium transition-all"
                        placeholder="Digite sua senha atual"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black ml-2 uppercase tracking-tighter text-muted-foreground">Nova Senha</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-5 bg-background border border-border rounded-2xl input-focus font-medium transition-all"
                          placeholder="Mín. 6 caracteres"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black ml-2 uppercase tracking-tighter text-muted-foreground">Confirmar Senha</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-5 bg-background border border-border rounded-2xl input-focus font-medium transition-all"
                          placeholder="Repita a nova senha"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-5 bg-primary text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4"
                  >
                    {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    Atualizar Senha
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
