import React, { useState } from 'react'
import { Wand2, X, AlertCircle, CheckCircle2, HelpCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface MenuOption {
  id: string
  number: number
  text: string
  nextMenuId?: string
  response?: string
  attachmentName?: string
  attachmentData?: string
}

interface MenuNode {
  id: string
  title: string
  message: string
  options: MenuOption[]
}

interface MenuFlowData {
  rootMenuId: string
  menus: Record<string, MenuNode>
}

interface FlowGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (flowData: MenuFlowData) => void
}

export default function FlowGenerator({ isOpen, onClose, onGenerate }: FlowGeneratorProps) {
  const [script, setScript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<{ name: string, data: string } | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx 2MB)')
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setAttachment({
          name: file.name,
          data: result
        })
        
        // Extrair o conteúdo de texto puro do DataURL para preencher o roteiro
        try {
          const base64Content = result.split(',')[1]
          const binaryString = atob(base64Content)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          
          // Tentar decodificar como UTF-8 primeiro
          let decodedText = new TextDecoder('utf-8').decode(bytes)
          
          // Se contiver caracteres estranhos (indicando ISO-8859-1), tentar decodificar novamente
          if (decodedText.includes('') || /[\u0080-\u00ff]/.test(decodedText)) {
            try {
              const isoText = new TextDecoder('iso-8859-1').decode(bytes)
              if (!isoText.includes('')) {
                decodedText = isoText
              }
            } catch (e) {}
          }
          
          setScript(decodedText)
          toast.success('Roteiro carregado com sucesso!')
        } catch (e) {
          console.error('Erro ao decodificar arquivo:', e)
          toast.error('Erro ao ler conteúdo do arquivo')
        }
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isOpen) return null

  const parseScript = () => {
    try {
      setError(null)
      if (!script.trim()) {
        setError('Por favor, insira o roteiro do fluxo.')
        return
      }

      // Normalizar quebras de linha
      const normalizedScript = script.replace(/\r\n/g, '\n')
      
      // Separar seções usando uma regex mais flexível para o separador ---
      // Aceita qualquer quantidade de hífens (mínimo 3), com espaços opcionais, 
      // garantindo que esteja em uma linha própria.
      const sections = normalizedScript.split(/\n\s*-{3,}\s*\n/).map(s => s.trim()).filter(Boolean)
      
      if (sections.length === 0) {
        setError('Roteiro inválido. Use "---" para separar as seções.')
        return
      }

      const menus: Record<string, MenuNode> = {}
      const menuMapping: Record<number, string> = {} // Map section index to menu ID
      const titleToMenuId: Record<string, string> = {
        'menu principal': 'menu_0'
      }

      // Helper para limpar títulos e opções
      const cleanString = (str: string) => {
        return str
          .replace(/[0-9]️⃣|[0-9][\.\)\-\s]?/g, '') // Remove números e emojis de números
          .replace(/^(se responder|se escolher|se o cliente responder)\s+/i, '') // Remove gatilhos
          .trim()
          .toLowerCase()
      }

      // First pass: Create menu nodes and handle reusability
      sections.forEach((section, index) => {
        const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) return

        const firstLine = lines[0]
        const isTriggerSection = firstLine.toLowerCase().startsWith('se responder') || 
                               firstLine.toLowerCase().startsWith('se escolher') ||
                               firstLine.toLowerCase().startsWith('se o cliente responder')
        
        const rawTitle = firstLine.replace(/^[🤖\s]+/, '')
        const cleanTitle = cleanString(rawTitle)

        // Se este título já foi definido como um menu, reutilizamos o ID para o mapeamento
        // MAS apenas se não for a primeira seção (que sempre deve ser o menu raiz)
        if (index !== 0 && titleToMenuId[cleanTitle]) {
          menuMapping[index] = titleToMenuId[cleanTitle]
          return
        }

        const menuId = index === 0 ? 'menu_0' : `menu_${Date.now()}_${index}`
        menuMapping[index] = menuId
        
        // Registrar este título para reuso futuro
        if (cleanTitle) {
          titleToMenuId[cleanTitle] = menuId
        }

        const messageLines: string[] = []
        const options: MenuOption[] = []
        const startLine = isTriggerSection ? 1 : (index === 0 ? 0 : 0)
        
        // Se for o primeiro menu e a primeira linha for um título (emoji de robô), pular
        let actualStart = 0
        if (index === 0 && firstLine.includes('🤖')) actualStart = 1
        else if (isTriggerSection) actualStart = 1

        for (let i = actualStart; i < lines.length; i++) {
          const line = lines[i]
          // Suporte a 1️⃣, 1., 1), 1- ou apenas 1 no início da linha
          const optionMatch = line.match(/^([0-9]️⃣|[0-9][\.\)\-\s]?)\s*(.*)/)
          
          if (optionMatch) {
            const numStr = optionMatch[1].replace(/[^0-9]/g, '')
            const num = parseInt(numStr)
            if (!isNaN(num)) {
              options.push({
                id: `opt_${Date.now()}_${index}_${num}_${Math.random().toString(36).substr(2, 4)}`,
                number: num,
                text: optionMatch[2].trim(),
                response: ''
              })
            } else {
              messageLines.push(line)
            }
          } else {
            messageLines.push(line)
          }
        }

        menus[menuId] = {
          id: menuId,
          title: rawTitle,
          message: messageLines.join('\n'),
          options: options
        }
      })

      // Second pass: Link menus
      sections.forEach((section, index) => {
        const menuId = menuMapping[index]
        if (!menuId || !menus[menuId]) return

        const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
        const firstLine = lines[0].toLowerCase()
        const isTriggerSection = firstLine.includes('se responder') || 
                               firstLine.includes('se escolher') ||
                               firstLine.includes('se o cliente responder')
        
        if (isTriggerSection) {
          const cleanTrigger = cleanString(lines[0])
          const numMatch = /(?:se responder|se escolher|se o cliente responder)[^\d]*([0-9]️⃣|[0-9])/.exec(firstLine)
          const targetNum = numMatch ? parseInt(numMatch[1].replace(/[^0-9]/g, "")) : null

          let linked = false
          
          // 1. Procurar opção correspondente em TODOS os menus
          for (const mId in menus) {
            const menu = menus[mId]
            // Evitar auto-link (um menu apontar para si mesmo via trigger, a menos que seja intencional)
            if (mId === menuId) continue 

            const option = menu.options.find(o => {
              const optTextClean = cleanString(o.text)
              // Match por texto exato ou se o gatilho está contido na opção
              return optTextClean === cleanTrigger || (cleanTrigger.length > 3 && optTextClean.includes(cleanTrigger))
            })

            if (option) {
              option.nextMenuId = menuId
              
              // Se a seção do gatilho contém marcadores de mídia, preparamos o placeholder
              const sectionLower = section.toLowerCase()
              if (sectionLower.includes('[foto]')) {
                option.attachmentName = 'foto_automacao.jpg'
                option.attachmentData = 'PENDING_MEDIA_UPLOAD'
              } else if (sectionLower.includes('[audio]')) {
                option.attachmentName = 'audio_automacao.mp3'
                option.attachmentData = 'PENDING_MEDIA_UPLOAD'
              } else if (sectionLower.includes('[video]')) {
                option.attachmentName = 'video_automacao.mp4'
                option.attachmentData = 'PENDING_MEDIA_UPLOAD'
              } else if (sectionLower.includes('[anexo]')) {
                option.attachmentName = 'arquivo_automacao.pdf'
                option.attachmentData = 'PENDING_MEDIA_UPLOAD'
              }
              
              // Se houver um anexo global no Gerador, e for um placeholder, injetamos o dado real
              if (attachment && option.attachmentData === 'PENDING_MEDIA_UPLOAD') {
                option.attachmentName = attachment.name
                option.attachmentData = attachment.data
              }

              linked = true
            }

            // Se tem número no gatilho, tentar match por número também no menu anterior imediato
            if (!linked && targetNum !== null && mId === menuMapping[index - 1]) {
              const numOption = menu.options.find(o => o.number === targetNum)
              if (numOption) {
                numOption.nextMenuId = menuId
                linked = true
              }
            }
          }
        }

        // Link especial para "Voltar ao menu principal"
        menus[menuId].options.forEach(opt => {
          const t = opt.text.toLowerCase()
          if (t.includes('voltar ao menu principal') || t.includes('menu anterior') || t.includes('voltar ao início')) {
            if (t.includes('menu principal') || t.includes('início')) {
              opt.nextMenuId = 'menu_0'
            } else if (index > 0) {
              opt.nextMenuId = menuMapping[index - 1]
            }
          }
        })
      })

      console.log('[MOTA-FLOW] Fluxo gerado com sucesso:', { rootMenuId: 'menu_0', menusCount: Object.keys(menus).length })
      onGenerate({
        rootMenuId: 'menu_0',
        menus
      })
      onClose()
    } catch (err: any) {
      console.error('[MOTA-FLOW] Erro detalhado no parser:', err)
      setError(`Erro ao processar o roteiro: ${err.message || 'Verifique a formatação.'}`)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Wand2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Gerador Mágico</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Crie fluxos instantâneos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-all">
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <HelpCircle className="w-3 h-3" /> Cole seu roteiro estruturado abaixo
              </label>
              
              <div className="flex items-center gap-2">
                {attachment ? (
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-black truncate max-w-[100px]">{attachment.name}</span>
                    <button onClick={() => setAttachment(null)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl font-black text-[10px] hover:bg-primary hover:text-white cursor-pointer transition-all">
                    <FileText className="w-4 h-4" /> ANEXAR .TXT GLOBAL
                    <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                )}
              </div>
            </div>
            
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="🤖 Nome do Fluxo&#10;&#10;Olá! Escolha uma opção:&#10;1️⃣ Opção A&#10;2️⃣ Opção B&#10;&#10;---&#10;&#10;Se responder 1️⃣&#10;[FOTO]&#10;Aqui está a foto do produto!&#10;&#10;---&#10;&#10;Se responder 2️⃣&#10;[AUDIO]&#10;Vou te explicar como funciona..."
              className="w-full h-64 p-4 bg-background border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-500">{error}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dicas de Formatação
              </h4>
              <ul className="text-[11px] font-bold text-muted-foreground space-y-1.5">
                <li>• Use <code className="bg-primary/10 px-1 rounded">---</code> para separar as telas</li>
                <li>• Use <code className="bg-primary/10 px-1 rounded">Se responder 1️⃣</code> para conectar</li>
                <li>• Use <code className="bg-primary/10 px-1 rounded">[FOTO]</code>, <code className="bg-primary/10 px-1 rounded">[AUDIO]</code> ou <code className="bg-primary/10 px-1 rounded">[VIDEO]</code> no início da resposta</li>
                <li>• O robô enviará a mídia se o arquivo global estiver anexado</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Exemplo Rápido
              </h4>
              <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto">
{`🤖 Menu Principal
Olá! Escolha:
1️⃣ Comprar
2️⃣ Suporte

---

Se responder Comprar
Temos Netflix e Disney...`}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-muted/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-muted text-muted-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted/50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={parseScript}
            className="flex-2 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Gerar Fluxo Mágico
          </button>
        </div>
      </div>
    </div>
  )
}
