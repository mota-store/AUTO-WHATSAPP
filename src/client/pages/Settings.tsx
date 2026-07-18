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
        // Supondo que o backend agora retorna o avatar no objeto user ou em algum lugar
        // Vamos buscar os dados completos do usuário
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
            toast.success('Foto de perfil salva no banco de dados!')
          } else {
            toast.error('Erro ao salvar foto no servidor')
          }
        } catch (error) {
          toast.error('Erro ao conectar com o servidor')
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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex font-sans overflow-hidden">
      <Sidebar />
      
      {/* Modal de Alteração de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowPasswordModal(false)}></div>
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white transition-all">
              <X className="w-6 h-6" />
            </button>
            <div className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter">Nova Senha</h3>
                <p className="text-zinc-500 font-medium">Proteja sua conta MOTA-FLOW.</p>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Senha Atual</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl font-black focus:border-primary transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Nova Senha</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl font-black focus:border-primary transition-all outline-none"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'Confirmar Alteração'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 transition-all duration-500">
        <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[80vh] space-y-12">
          {/* Header Minimalista */}
          <header className="flex flex-col items-center text-center space-y-6">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[3rem] bg-zinc-900 border-2 border-zinc-800 overflow-hidden shadow-2xl transition-all group-hover:border-primary/50">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <User className="w-16 h-16 text-zinc-700" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-2 right-2 p-4 bg-primary text-white rounded-2xl shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all">
                <Camera className="w-6 h-6" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter">{user.name || 'Usuário'}</h1>
              <p className="text-zinc-500 text-lg font-medium flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" /> {user.email}
              </p>
            </div>
          </header>

          <div className="w-full max-w-md space-y-4">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full p-8 bg-zinc-900/50 border border-zinc-800/50 rounded-[2.5rem] flex items-center justify-between hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black tracking-tight">Segurança</h3>
                  <p className="text-zinc-500 text-sm font-medium">Alterar senha</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={handleLogout}
              className="w-full p-8 bg-destructive/5 border border-destructive/10 rounded-[2.5rem] flex items-center justify-between hover:bg-destructive/10 transition-all group"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center group-hover:bg-destructive group-hover:text-white transition-all">
                  <LogOut className="w-6 h-6 text-destructive group-hover:text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black tracking-tight text-destructive">Sair da Conta</h3>
                  <p className="text-destructive/60 text-sm font-medium">Encerrar sessão</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-destructive group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
