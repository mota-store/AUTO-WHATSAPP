import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react'
import slide1 from '../assets/tutorial/slide-1.png'
import slide2 from '../assets/tutorial/slide-2.png'
import slide3 from '../assets/tutorial/slide-3.png'
import slide4 from '../assets/tutorial/slide-4.png'
import slide5 from '../assets/tutorial/slide-5.png'
import slide6 from '../assets/tutorial/slide-6.png'

interface TutorialSlide {
  title: string
  description: string
  image: string
  tips?: string[]
}

const tutorialSlides: TutorialSlide[] = [
  {
    title: '👋 Bem-vindo ao MOTA-FLOW',
    description: 'Sua plataforma de automação WhatsApp está pronta para revolucionar seu atendimento. Vamos aprender o básico em 5 passos simples.',
    image: slide1,
    tips: ['Este é um tutorial interativo', 'Use as setas para navegar', 'Você pode fechar a qualquer momento']
  },
  {
    title: '📱 Passo 1: Conectar WhatsApp',
    description: 'Acesse o Dashboard e clique em "Conectar via QR Code" ou "Conectar via Número". Escaneie o código com seu celular ou use o código de pareamento.',
    image: slide2,
    tips: ['Mantenha seu celular próximo', 'O código expira em 60 segundos', 'Você pode reconectar a qualquer momento']
  },
  {
    title: '🤖 Passo 2: Criar um Fluxo',
    description: 'Vá para "Meus Fluxos" e clique em "Novo Fluxo". Um fluxo é uma sequência de mensagens automáticas que seu robô enviará.',
    image: slide3,
    tips: ['Comece com um fluxo simples', 'Você pode editar depois', 'Cada fluxo pode ter múltiplos níveis']
  },
  {
    title: '✏️ Passo 3: Editar Mensagens',
    description: 'No editor, customize o título, a mensagem inicial e adicione opções numeradas. Cada opção pode levar a uma nova mensagem.',
    image: slide4,
    tips: ['Use números para as opções (1, 2, 3...)', 'Adicione respostas automáticas', 'Crie sub-menus para aprofundar']
  },
  {
    title: '⚡ Passo 4: Ativar o Fluxo',
    description: 'Volte para "Meus Fluxos" e clique no ícone de energia para ativar seu fluxo. Apenas 1 fluxo pode estar ativo por vez.',
    image: slide5,
    tips: ['Fluxo ativo = robô respondendo', 'Você pode trocar de fluxo a qualquer hora', 'Desative para pausar o robô']
  },
  {
    title: '🎉 Pronto! Você está Pronto!',
    description: 'Seu robô agora está respondendo automaticamente no WhatsApp. Qualquer pessoa que enviar uma mensagem receberá suas respostas automáticas.',
    image: slide6,
    tips: ['Monitore as conversas', 'Ajuste os fluxos conforme necessário', 'Use o preview para testar antes de ativar']
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
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto pb-10">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{slide.title}</h2>
            </div>
            <p className="text-zinc-500 text-sm font-medium">Passo {currentSlide + 1} de {tutorialSlides.length}</p>
          </div>

          {/* Image */}
          <div className="relative w-full bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-2xl border-2 border-primary/30 flex items-center justify-center overflow-hidden">
            <img 
              src={slide.image} 
              alt={slide.title}
              className="w-full h-auto max-h-[50vh] object-contain"
            />
          </div>

          {/* Description */}
          <div className="space-y-4">
            <p className="text-zinc-300 text-base leading-relaxed font-medium">{slide.description}</p>
            
            {/* Tips */}
            {slide.tips && slide.tips.length > 0 && (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2">
                <p className="text-xs font-black text-primary uppercase tracking-widest">💡 Dicas</p>
                <ul className="space-y-1">
                  {slide.tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                      <span className="text-primary font-black mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary to-emerald-500 h-full transition-all duration-300"
              style={{ width: `${((currentSlide + 1) / tutorialSlides.length) * 100}%` }}
            ></div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <button 
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className="flex-1 px-6 py-3 bg-zinc-800/50 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            
            <div className="flex gap-1">
              {tutorialSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentSlide ? 'bg-primary w-6' : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>

            <button 
              onClick={currentSlide === tutorialSlides.length - 1 ? onClose : handleNext}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-95"
            >
              {currentSlide === tutorialSlides.length - 1 ? 'Finalizar' : 'Próximo'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
