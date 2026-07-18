import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Zap
} from 'lucide-react'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const profileImage = localStorage.getItem('profileImage')

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Meus Fluxos', path: '/flows' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('profileImage')
    navigate('/login')
  }

  return (
    <>
      {/* Botão Hambúrguer - Agora na Direita */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-6 right-6 z-[110] p-4 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar - Fixa na Esquerda em Desktop, Direita em Mobile */}
      <aside className={`
        fixed top-0 bottom-0 z-[105] w-72 bg-zinc-950 border-l border-zinc-900 transition-all duration-500 ease-in-out
        ${isOpen ? 'right-0' : '-right-full lg:right-auto lg:left-0'} 
        lg:border-r lg:border-l-0
      `}>
        <div className="flex flex-col h-full p-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white">MOTA-FLOW</h2>
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Automação</span>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all duration-300
                    ${isActive 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Footer Sidebar - Limpo */}
          <div className="pt-8 border-t border-zinc-900">
            <div className="flex items-center gap-4 px-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800">
                {profileImage ? (
                  <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-primary font-black text-sm">{user.name?.[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{user.name}</p>
                <p className="text-[10px] font-bold text-zinc-500 truncate uppercase tracking-widest">Usuário Ativo</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
