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

      const sections = script.split(/\n---\n|\n---\s*\n/).map(s => s.trim()).filter(Boolean)
      if (sections.length === 0) {
        setError('Roteiro inválido. Use "---" para separar as seções.')
        return
      }

      const menus: Record<string, MenuNode> = {}
      const menuMapping: Record<number, string> = {} // Map section index to menu ID

      // First pass: Create menu nodes
      sections.forEach((section, index) => {
        const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
        const menuId = index === 0 ? 'menu_0' : `menu_${Date.now()}_${index}`
        menuMapping[index] = menuId

        // Extract title
        let title = lines[0].replace(/^[🤖\s]+/, '')
        if (lines[0].toLowerCase().startsWith('se responder') || lines[0].toLowerCase().startsWith('se escolher')) {
          title = lines[0]
        }

        const messageLines: string[] = []
        const options: MenuOption[] = []
        const startLine = (index === 0) ? 0 : 1
        
        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i]
          // Suporte a 1️⃣, 1., 1), 1- ou apenas 1
          const optionMatch = line.match(/^([0-9]️⃣|[0-9][\.\)\-\s]?)\s*(.*)/)
          
          if (optionMatch) {
            const numStr = optionMatch[1].replace(/[^0-9]/g, '')
            const num = parseInt(numStr)
            options.push({
              id: `opt_${Date.now()}_${index}_${num}`,
              number: num,
              text: optionMatch[2].trim(),
              response: ''
            })
          } else {
            messageLines.push(line)
          }
        }

        menus[menuId] = {
          id: menuId,
          title: title,
          message: messageLines.join('\n'),
          options: options
        }
      })

      // Second pass: Link menus based on "Se responder X" logic
      sections.forEach((section, index) => {
        const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
        const firstLine = lines[0].toLowerCase()
        
        if (firstLine.includes('se responder') || firstLine.includes('se escolher')) {
          // Extract number from trigger line, e.g., "Se responder 1️⃣ - Individual"
          const numMatch = /(?:se responder|se escolher)[^\d]*([0-9]️⃣|[0-9])/.exec(firstLine)
          if (numMatch) {
            const targetNum = parseInt(numMatch[1].replace(/[^0-9]/g, ""))
            
            let linked = false
            // Look through all previously defined menus to find the option to link
            for (let i = 0; i < index; i++) { 
              const prevMenuId = menuMapping[i]
              const option = menus[prevMenuId].options.find(o => o.number === targetNum)
              if (option && !option.nextMenuId) {
                option.nextMenuId = menuMapping[index]
                linked = true
                break
              }
            }
            // If not linked to a specific number, try to link to the previous menu's options
            if (!linked) {
              const prevMenuId = menuMapping[index - 1]
              if (prevMenuId) {
                menus[prevMenuId].options.forEach(opt => {
                  if (!opt.nextMenuId) opt.nextMenuId = menuMapping[index]
                })
              }
            }
          } else if (firstLine.includes('qualquer uma') || firstLine.includes('após escolher')) {
            // Link all options from the previous section to this one if they don't have a nextMenuId
            const prevMenuId = menuMapping[index - 1]
            if (prevMenuId) {
              menus[prevMenuId].options.forEach(opt => {
                if (!opt.nextMenuId) opt.nextMenuId = menuMapping[index]
              })
            }
          }
        }

        // Handle "Voltar ao menu principal" option linking to rootMenuId
        if (menus[menuMapping[index]]) {
          menus[menuMapping[index]].options.forEach(opt => {
            if (opt.number === 0 && opt.text.toLowerCase().includes('voltar ao menu principal')) {
              opt.nextMenuId = 'menu_0'
            }
          })
        }
      })

      // Final pass: Apply global attachment to all leaf options (options without nextMenuId)
      if (attachment) {
        Object.values(menus).forEach(menu => {
          menu.options.forEach(opt => {
            if (!opt.nextMenuId) {
              opt.attachmentName = attachment.name
              opt.attachmentData = attachment.data
            }
          })
        })
      }

      console.log('[MOTA-FLOW] Fluxo gerado com sucesso:', { rootMenuId: 'menu_0', menus })
      onGenerate({
        rootMenuId: 'menu_0',
        menus
      })
      onClose()
    } catch (err) {
      console.error('[MOTA-FLOW] Erro no parser:', err)
      setError('Erro ao processar o roteiro. Verifique a formatação.')
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
              placeholder="🤖 Nome do Fluxo&#10;&#10;Olá! Escolha uma opção:&#10;1️⃣ Opção A&#10;2️⃣ Opção B&#10;&#10;---&#10;&#10;Se responder 1️⃣&#10;Texto para opção 1..."
              className="w-full h-64 p-4 bg-background border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dicas de Formatação
              </h4>
              <ul className="text-[11px] font-bold text-muted-foreground space-y-1.5">
                <li>• Use <code className="bg-primary/10 px-1 rounded">---</code> para separar as telas</li>
                <li>• Use <code className="bg-primary/10 px-1 rounded">1️⃣</code>, <code className="bg-primary/10 px-1 rounded">2️⃣</code> para opções</li>
                <li>• Use <code className="bg-primary/10 px-1 rounded">Se responder 1️⃣</code> para conectar</li>
                <li>• O robô ignora o título nas mensagens</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/30 rounded-2xl border border-border/50">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Exemplo Rápido
              </h4>
              <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto">
{`Olá! Como ajudar?
1️⃣ Comprar
2️⃣ Suporte

---

Se responder 1️⃣
Qual produto deseja?`}
              </pre>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2 text-destructive text-xs font-bold">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-muted/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-border rounded-xl font-black text-xs uppercase tracking-widest hover:bg-muted transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={parseScript}
            className="flex-[2] px-4 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Gerar Fluxo Mágico
          </button>
        </div>
      </div>
    </div>
  )
}
