import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'

interface MenuOption {
  id: string
  number: number
  text: string
  nextMenuId?: string
  response?: string
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

export default function FlowEditor() {
  const { flowId } = useParams()
  const navigate = useNavigate()
  const [flowName, setFlowName] = useState('')
  const [flowDescription, setFlowDescription] = useState('')
  const [flowData, setFlowData] = useState<MenuFlowData>({
    rootMenuId: 'menu_1',
    menus: {
      menu_1: {
        id: 'menu_1',
        title: 'Menu Principal',
        message: '👋 Olá! Bem-vindo. Escolha uma opção:',
        options: [
          { id: 'opt_1', number: 1, text: 'Opção 1', response: 'Você escolheu a opção 1' },
          { id: 'opt_2', number: 2, text: 'Opção 2', response: 'Você escolheu a opção 2' },
        ],
      },
    },
  })
  const [selectedMenuId, setSelectedMenuId] = useState('menu_1')
  const [isSaving, setIsSaving] = useState(false)

  const selectedMenu = flowData.menus[selectedMenuId]

  const addOption = () => {
    if (!selectedMenu) return

    const newOption: MenuOption = {
      id: `opt_${Date.now()}`,
      number: selectedMenu.options.length + 1,
      text: `Opção ${selectedMenu.options.length + 1}`,
      response: `Resposta para opção ${selectedMenu.options.length + 1}`,
    }

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: [...selectedMenu.options, newOption],
        },
      },
    })
  }

  const updateOption = (optionId: string, field: string, value: string) => {
    if (!selectedMenu) return

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.map((opt) =>
            opt.id === optionId ? { ...opt, [field]: value } : opt
          ),
        },
      },
    })
  }

  const deleteOption = (optionId: string) => {
    if (!selectedMenu) return

    setFlowData({
      ...flowData,
      menus: {
        ...flowData.menus,
        [selectedMenuId]: {
          ...selectedMenu,
          options: selectedMenu.options.filter((opt) => opt.id !== optionId),
        },
      },
    })
  }

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error('Nome do fluxo é obrigatório')
      return
    }

    setIsSaving(true)

    try {
      const token = localStorage.getItem('token')
      const method = flowId ? 'PUT' : 'POST'
      const url = flowId ? `/api/flows/${flowId}` : '/api/flows'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: flowName,
          description: flowDescription,
          flowData,
        }),
      })

      if (response.ok) {
        toast.success(flowId ? 'Fluxo atualizado!' : 'Fluxo criado!')
        navigate('/dashboard')
      } else {
        toast.error('Erro ao salvar fluxo')
      }
    } catch (error) {
      toast.error('Erro ao conectar ao servidor')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">Editor de Fluxos</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Left Panel - Flow Info */}
          <div className="col-span-1 space-y-4">
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="font-bold text-foreground mb-4">Informações</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nome do Fluxo
                  </label>
                  <input
                    type="text"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder="Ex: Menu Vendas"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={flowDescription}
                    onChange={(e) => setFlowDescription(e.target.value)}
                    placeholder="Descrição do fluxo..."
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Menu Editor */}
          <div className="col-span-2">
            {selectedMenu && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="font-bold text-foreground mb-4">{selectedMenu.title}</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Mensagem do Menu
                    </label>
                    <textarea
                      value={selectedMenu.message}
                      onChange={(e) =>
                        setFlowData({
                          ...flowData,
                          menus: {
                            ...flowData.menus,
                            [selectedMenuId]: {
                              ...selectedMenu,
                              message: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-foreground">Opções</h3>
                      <button
                        onClick={addOption}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-accent text-accent-foreground rounded hover:bg-accent/90 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>

                    <div className="space-y-3">
                      {selectedMenu.options.map((option) => (
                        <div key={option.id} className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={option.number}
                              onChange={(e) =>
                                updateOption(option.id, 'number', e.target.value)
                              }
                              className="w-16 px-2 py-1 border border-border rounded text-sm"
                              min="1"
                            />
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) =>
                                updateOption(option.id, 'text', e.target.value)
                              }
                              placeholder="Texto da opção"
                              className="flex-1 px-3 py-1 border border-border rounded-lg text-sm"
                            />
                            <button
                              onClick={() => deleteOption(option.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <textarea
                            value={option.response || ''}
                            onChange={(e) =>
                              updateOption(option.id, 'response', e.target.value)
                            }
                            placeholder="Resposta automática"
                            className="w-full px-3 py-1 border border-border rounded-lg text-sm resize-none h-16"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
