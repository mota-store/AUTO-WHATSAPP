# Relatório de Recomendações Técnicas: MOTA-FLOW (AUTO-WHATSAPP)

Após a resolução dos problemas imediatos no **Dashboard** e no **Gerador Mágico**, realizei uma auditoria técnica na base de código atual. Embora o sistema seja funcional e bem estruturado, existem pontos críticos que podem comprometer a segurança e a escalabilidade conforme a base de usuários crescer.

Abaixo, apresento as melhorias recomendadas, organizadas por prioridade e impacto.

---

## 1. Segurança e Controle de Acesso (Alta Prioridade)

Atualmente, o backend possui vulnerabilidades de **IDOR (Insecure Direct Object Reference)** em rotas críticas.

| Vulnerabilidade Identificada | Impacto | Sugestão de Correção |
| :--- | :--- | :--- |
| **Acesso a Fluxos sem Escopo** | Um usuário autenticado pode ler, editar ou excluir fluxos de outros usuários apenas alterando o `flowId` na URL. | No `src/server/db.ts`, todas as queries de `getMenuFlow`, `updateMenuFlow` e `deleteMenuFlow` devem incluir o `userId` na cláusula `where`. |
| **JWT Secret Fallback** | O uso de um valor padrão `'your-secret-key'` no código (`utils.ts`) facilita ataques de força bruta se a variável de ambiente não estiver setada. | Remover o fallback e lançar um erro fatal no boot do servidor caso `JWT_SECRET` não esteja definido. |
| **Persistência de PII no Frontend** | Dados sensíveis do usuário e o avatar (base64 pesado) são salvos no `localStorage`. | Utilizar cookies `HttpOnly` para o token e centralizar o estado do usuário em um Contexto React ou Store (Zustand/Redux), evitando persistir dados pesados no disco do navegador. |

---

## 2. Resiliência do WhatsApp e Baileys (Média Prioridade)

A gestão de sessões é o coração do projeto e pode ser tornada mais robusta.

*   **Gestão de Memória (Memory Leaks)**: Atualmente, o servidor armazena sockets em um `Map` (`sessions`). Se o servidor for reiniciado ou sofrer crash, as referências se perdem, mas os processos do Baileys podem ficar órfãos. Recomenda-se implementar um **Graceful Shutdown** que feche todos os sockets antes de encerrar o processo.
*   **Armazenamento de Sessões**: O uso de `useMultiFileAuthState` em disco local é funcional, mas dificulta o escalonamento horizontal (múltiplas instâncias do servidor). Para o futuro, considere migrar o estado de autenticação para o banco de dados (MySQL/TiDB) ou um bucket S3.
*   **Cooldown de Mensagens**: O cooldown atual de 24h para usuários finalizados é rígido. Sugere-se tornar esse valor configurável por fluxo ou por usuário.

---

## 3. Experiência do Usuário (UX) e Frontend

*   **Validação de Sessão no Boot**: O `ProtectedRoute` atual apenas checa a existência do token no `localStorage`. Se o token expirar, o usuário verá telas vazias ou erros de API. O ideal é validar o token contra o endpoint `/api/auth/me` assim que o app carregar.
*   **Feedback de Erros no Gerador Mágico**: Implementamos logs detalhados, mas a experiência pode ser melhorada com um "Modo Preview" em tempo real enquanto o usuário cola o roteiro, mostrando visualmente como as telas estão se conectando antes de gerar o fluxo.
*   **Otimização de Imagens**: O upload de avatar envia strings base64 gigantes. Recomenda-se o uso de um serviço de storage (como o S3 já disponível no stack) para armazenar imagens e salvar apenas a URL no banco.

---

## 4. Monitoramento e Diagnóstico

*   **Logs Estruturados**: O projeto já usa `pino`, mas muitos logs ainda usam `console.log`. Padronizar todos os logs para o `pino` permitirá uma melhor integração com ferramentas de análise de logs (como Logtail ou Datadog) em produção.
*   **Dashboard de Métricas**: Adicionar métricas simples no dashboard, como:
    *   Total de mensagens processadas nas últimas 24h.
    *   Taxa de conversão (quantos usuários chegaram ao nó final do fluxo).
    *   Status de saúde da conexão (latência do socket).

---

## Próximos Passos Sugeridos

Se desejar prosseguir com essas melhorias, recomendo a seguinte ordem:
1.  **Correção de IDOR** no backend (Segurança).
2.  **Validação real de sessão** no `ProtectedRoute` (UX/Segurança).
3.  **Refatoração do storage de imagens** para S3 (Performance).

Estou à disposição para implementar qualquer uma dessas melhorias imediatamente.
