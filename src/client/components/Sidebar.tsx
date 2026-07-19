import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Zap,
  BookOpen
} from 'lucide-react'
import Tutorial from './Tutorial'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
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
      {/* Botão Hambúrguer - Otimizado para mobile */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-3 right-3 z-[110] p-2 bg-primary/90 backdrop-blur-sm text-white rounded-lg shadow-lg shadow-primary/30 hover:bg-primary active:scale-95 transition-all"
        aria-label="Menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 z-[105] w-64 bg-zinc-950 border-l border-zinc-900 transition-all duration-300 ease-in-out
        ${isOpen ? 'right-0' : '-right-full lg:right-auto lg:left-0 lg:w-64'} 
        lg:border-r lg:border-l-0
      `}>
        <div className="flex flex-col h-full p-5">
          {/* Logo - Compacto */}
          <div className="flex items-center gap-3 mb-8 px-1">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter text-white">MOTA-FLOW</h2>
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Automação</span>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 space-y-1">
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
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95
                    ${isActive 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  {item.label}
                </button>
              )
            })}
            
            {/* Tutorial Button */}
            <button
              onClick={() => {
                setShowTutorial(true)
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all duration-200 active:scale-95 mt-2 border border-zinc-800/50"
            >
              <BookOpen className="w-5 h-5" />
              Tutorial
            </button>
          </nav>

          {/* Footer Sidebar */}
          <div className="pt-4 border-t border-zinc-900">
            <div className="flex items-center gap-3 px-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800">
                {profileImage ? (
                  <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-primary font-black text-xs">{user.name?.[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{user.name}</p>
                <p className="text-[9px] font-bold text-zinc-500 truncate uppercase tracking-widest">Ativo</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Tutorial Modal */}
      <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </>
  )
}
