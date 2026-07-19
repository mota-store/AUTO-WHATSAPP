import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react'
import slide1 from '../assets/tutorial/slide-1.png'
import slide2 from '../assets/tutorial/slide-2.png'
import slide3 from '../assets/tutorial/slide-3.png'
import slide4 from '../assets/tutorial/slide-4.png'

interface TutorialSlide {
  title: string
  description: string
  image: string
  tips?: string[]
}

const tutorialSlides: TutorialSlide[] = [
  {
    title: '👋 Bem-vindo ao MOTA-FLOW',
    description: 'Sua plataforma de automação WhatsApp está pronta. Vamos aprender a configurar tudo de forma rápida e simples.',
    image: slide1,
    tips: ['Tutorial 100% visual', 'Use os botões para navegar', 'Feche quando quiser']
  },
  {
    title: '📊 Dashboard Intuitivo',
    description: 'Aqui você controla tudo. Veja o status da sua conexão e acesse seus fluxos de atendimento com um toque.',
    image: slide2,
    tips: ['Status em tempo real', 'Acesso rápido aos fluxos', 'Design otimizado para Android']
  },
  {
    title: '⚙️ Configuração de Perfil',
    description: 'Personalize seu robô! Altere o nome, avatar e gerencie sua conta de forma simplificada.',
    image: slide3,
    tips: ['Foto do robô personalizada', 'Dados sempre atualizados', 'Segurança em primeiro lugar']
  },
  {
    title: '✏️ Editor de Fluxos',
    description: 'Crie conversas inteligentes. Escreva as mensagens e defina as opções de resposta para seus clientes.',
    image: slide4,
    tips: ['Interface enxuta', 'Fácil de editar no celular', 'Salve suas alterações na hora']
  }
]

interface TutorialProps {
  isOpen: boolean
  onClose: () => void
}

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleNext = () => {
    if (currentSlide < tutorialSlides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  if (!isOpen) return null

  const slide = tutorialSlides[currentSlide]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Header */}
          <div className="space-y-1 pt-1">
            <h2 className="text-lg font-black tracking-tight">{slide.title}</h2>
            <p className="text-zinc-500 text-xs font-medium">Passo {currentSlide + 1} de {tutorialSlides.length}</p>
          </div>

          {/* Image - Compacta */}
          <div className="relative w-full bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-lg border border-primary/30 flex items-center justify-center overflow-hidden">
            <img 
              src={slide.image} 
              alt={slide.title}
              className="w-full h-auto max-h-[35vh] object-contain"
            />
          </div>

          {/* Description - Menor */}
          <p className="text-zinc-300 text-sm leading-snug font-medium">{slide.description}</p>
          
          {/* Tips - Compacto */}
          {slide.tips && slide.tips.length > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-2.5 space-y-1">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">💡 Dicas</p>
              <ul className="space-y-0.5">
                {slide.tips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-zinc-300 flex items-start gap-1.5">
                    <span className="text-primary font-black mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-800 h-0.5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-primary to-emerald-500 h-full transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / tutorialSlides.length) * 100}%` }}
          ></div>
        </div>

        {/* Navigation - Fixo no Rodapé */}
        <div className="flex items-center justify-between gap-2 p-3 border-t border-zinc-800 bg-zinc-900/50">
          <button 
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="px-3 py-1.5 bg-zinc-800/50 text-white rounded-lg font-black text-xs flex items-center justify-center gap-1 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <ChevronLeft className="w-3 h-3" /> Anterior
          </button>
          
          <div className="flex gap-0.5">
            {tutorialSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentSlide ? 'bg-primary w-4' : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>

          <button 
            onClick={currentSlide === tutorialSlides.length - 1 ? onClose : handleNext}
            className="px-3 py-1.5 bg-primary text-white rounded-lg font-black text-xs flex items-center justify-center gap-1 hover:bg-primary/90 transition-all active:scale-95"
          >
            {currentSlide === tutorialSlides.length - 1 ? 'Fechar' : 'Próximo'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
