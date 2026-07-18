import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  User, 
  Lock, 
  Mail, 
  Save, 
  RefreshCw, 
  LogOut,
  Camera,
  X,
  ChevronRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'

export default function Settings() {
  const navigate = useNavigate()
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'))
  
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const userRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (userRes.ok) {
            const userData = await userRes.json()
            setUser(userData)
            setProfileImage(userData.avatar)
            localStorage.setItem('user', JSON.stringify(userData))
            if (userData.avatar) localStorage.setItem('profileImage', userData.avatar)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    }
  }

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
        toast.success('Senha atualizada!')
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string
        setProfileImage(base64String)
        
        try {
          const token = localStorage.getItem('token')
          const response = await fetch('/api/auth/update-avatar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ avatar: base64String })
          })

          if (response.ok) {
            localStorage.setItem('profileImage', base64String)
            toast.success('Foto salva!')
          } else {
            toast.error('Erro ao salvar foto')
          }
        } catch (error) {
          toast.error('Erro de conexão')
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('profileImage')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans safe-top safe-bottom">
      <Sidebar />
      
      {/* Modal de Alteração de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowPasswordModal(false)}></div>
          <div className="relative w-full max-w-md bg-zinc-950 border-t sm:border border-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-5 pt-2">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tighter">Nova Senha</h3>
                <p className="text-zinc-500 text-sm font-medium">Proteja sua conta.</p>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Senha Atual</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl font-bold focus:border-primary transition-all outline-none text-base"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl font-bold focus:border-primary transition-all outline-none text-base"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-64 px-4 pt-6 pb-8 transition-all duration-500 overflow-y-auto h-screen">
        <div className="max-w-lg mx-auto flex flex-col items-center space-y-8">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-2xl bg-zinc-900 border-2 border-zinc-800 overflow-hidden shadow-xl transition-all group-hover:border-primary/50">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <User className="w-12 h-12 text-zinc-700" />
                </div>
              )}
            </div>
            <label className="absolute bottom-1 right-1 p-2.5 bg-primary text-white rounded-xl shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <Camera className="w-4 h-4" />
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>

          {/* Info do usuário */}
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black tracking-tighter">{user.name || 'Usuário'}</h1>
            <p className="text-zinc-500 text-sm font-medium flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" /> {user.email}
            </p>
          </div>

          {/* Ações */}
          <div className="w-full max-w-sm space-y-3">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl flex items-center justify-between hover:bg-zinc-800 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black tracking-tight">Segurança</h3>
                  <p className="text-zinc-500 text-xs font-medium">Alterar senha</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            <button 
              onClick={handleLogout}
              className="w-full p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between hover:bg-red-500/10 transition-all group active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                  <LogOut className="w-5 h-5 text-red-500 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black tracking-tight text-red-500">Sair</h3>
                  <p className="text-red-500/60 text-xs font-medium">Encerrar sessão</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-red-500/60 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
