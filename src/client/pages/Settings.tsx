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
  LogOut,
  Camera,
  X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

export default function Settings() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(localStorage.getItem('profileImage'))

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
        setShowPasswordModal(false)
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setProfileImage(base64String)
        localStorage.setItem('profileImage', base64String)
        toast.success('Foto de perfil atualizada!')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans">
      <Sidebar />
      
      {/* Modal de Alteração de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPasswordModal(false)}></div>
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 p-8 sm:p-10">
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
            <div className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">Alterar Senha</h3>
                <p className="text-zinc-500 text-sm font-medium">Mantenha sua conta protegida.</p>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Senha Atual</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-6 py-4 bg-black/40 border border-zinc-800 rounded-2xl font-black focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Nova Senha
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Header Minimalista */}
          <header className="flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 overflow-hidden shadow-2xl transition-all group-hover:border-primary/50">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800/50">
                    <User className="w-12 h-12 text-zinc-600" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-3 bg-primary text-white rounded-2xl shadow-xl cursor-pointer hover:scale-110 transition-all">
                <Camera className="w-5 h-5" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl font-black tracking-tight">{user.name || 'Usuário'}</h1>
              <p className="text-zinc-500 font-medium flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" /> {user.email}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full p-8 bg-zinc-900/50 border border-zinc-800/50 rounded-[2rem] flex items-center justify-between hover:bg-zinc-800/50 transition-all group"
            >
              <div className="flex items-center gap-6 text-left">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Segurança da Conta</h3>
                  <p className="text-zinc-500 text-sm font-medium">Altere sua senha de acesso</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-all">
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>

            <button 
              onClick={handleLogout}
              className="w-full p-8 bg-destructive/5 border border-destructive/10 rounded-[2rem] flex items-center justify-between hover:bg-destructive/10 transition-all group"
            >
              <div className="flex items-center gap-6 text-left">
                <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center group-hover:bg-destructive group-hover:text-white transition-all">
                  <LogOut className="w-6 h-6 text-destructive group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-destructive">Encerrar Sessão</h3>
                  <p className="text-destructive/60 text-sm font-medium">Sair da sua conta no MOTA-FLOW</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-all">
                <ChevronRight className="w-5 h-5 text-destructive" />
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
