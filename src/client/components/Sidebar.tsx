import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Wifi, 
  Zap,
  ChevronRight
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Fluxos de Resposta', icon: MessageSquare, path: '/flows' },
    { name: 'Configurações', icon: Settings, path: '/settings' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-background border border-border rounded-2xl shadow-xl text-primary"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-[70] h-full w-72 bg-background border-r border-border transition-all duration-500 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full p-6">
          {/* Logo Section */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="bg-whatsapp p-2.5 rounded-2xl shadow-lg shadow-whatsapp/20">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black tracking-tighter gradient-text-whatsapp">MOTA-FLOW</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:text-primary transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 ml-2">Menu Principal</p>
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-all duration-300 group
                  ${isActive(item.path) 
                    ? 'bg-primary/10 text-primary shadow-inner' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${isActive(item.path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary transition-all'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive(item.path) && <ChevronRight className="w-4 h-4 animate-in slide-in-from-left-2" />}
              </button>
            ))}
          </nav>

          {/* Bottom Section */}
          <div className="mt-auto space-y-4 pt-6 border-t border-border">
            <div className="bg-muted/30 p-4 rounded-3xl border border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tighter">Plano Premium</p>
                  <p className="text-[10px] text-muted-foreground">Status: Ativo</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-primary rounded-full"></div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <ThemeToggle />
              <button 
                onClick={handleLogout}
                className="p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                title="Sair da conta"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center">
              <p className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">Powered by Ereemby</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
