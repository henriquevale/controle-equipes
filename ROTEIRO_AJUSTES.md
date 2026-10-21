# 📋 Roteiro de Ajustes - Filtro de Histórico de Diários

## 🎯 Objetivo Final
Garantir que a rota `/gestor/historico-diarios` retorne **APENAS** os diários das obras vinculadas ao gestor logado, não tudo.

---

## 📌 ETAPA 1: Diagnosticar o Backend (EM ANDAMENTO ✅)

### ✅ Concluído
- Adicionado logging detalhado na rota `/gestor/historico-diarios`
- Agora o backend registra em cada passo:
  1. Parâmetros recebidos (id, cargo, etc)
  2. Se é MASTER ou GESTOR
  3. SQL final que será executado
  4. Quantos registros retornaram

### 🔧 O Que Fazer Agora
1. **Reinicie o backend**
   ```bash
   # No terminal backend
   npm start
   # ou
   node index.js
   ```

2. **Abra o navegador e vá para "Histórico e Produção"**

3. **Verifique os logs do backend** - procure por:
   ```
   ========== [DIAGNÓSTICO] /gestor/historico-diarios ==========
   [1] Parâmetros recebidos (req.query):
   [2] Cargo check:
   [3] Filtro aplicado:
   ...
   ========== [FIM DIAGNÓSTICO] ==========
   ```

4. **Cole aqui os logs completos** que aparecerem no console

---

## 📌 ETAPA 2: Validar Dados no Banco

### O Que Testar
Execute esses comandos SQL no seu banco (MySQL):

```sql
-- 1. Confirmar vínculos de gestor
SELECT * FROM gestor_obras WHERE id_usuario = 17;
-- Esperado: ver obras 3, 4, 8 (conforme você disse antes)

-- 2. Confirmar diários existem para essas obras
SELECT DISTINCT id_obra FROM diario_efetivo 
WHERE id_obra IN (3, 4, 8) 
LIMIT 5;
-- Esperado: ver alguns dos id_obra 3, 4 ou 8

-- 3. Contar total de diários por obra
SELECT id_obra, COUNT(*) as total_diarios 
FROM diario_efetivo 
GROUP BY id_obra 
ORDER BY id_obra;
-- Esperado: ver números > 0 para obras 3, 4, 8
```

---

## 📌 ETAPA 3: Testar Fluxo Completo

### Checklist Browser
- [ ] DevTools aberto (F12)
- [ ] Aba **Console** selecionada
- [ ] Aba **Network** selecionada (filtro: Fetch/XHR)
- [ ] Clique em "Histórico e Produção"
- [ ] Procure pela requisição para `/gestor/historico-diarios`
- [ ] Verifique:
  - Query string: `?id=17&cargo=GESTOR`
  - Response status: `200` (não `304`)
  - Response body: quantos registros retornou?

### Checklist Terminal Backend
- [ ] Logs [1] a [7] aparecem?
- [ ] O `id` é `17`?
- [ ] O `cargo` é `"GESTOR"`?
- [ ] Diz "Filtro GESTOR aplicado"?
- [ ] O SQL contém `AND r.id_obra IN (SELECT...)`?
- [ ] Quantos registros retornaram?

---

## 📌 ETAPA 4: Corrigir Problemas Encontrados

### Cenário A: Logs mostram `cargo="GESTOR"` mas retorna tudo
- **Causa provável**: Nenhum registro em `gestor_obras` para `id=17`
- **Ação**: Verificar SQL do banco (ETAPA 2)

### Cenário B: Logs mostram `cargo` vazio ou undefined
- **Causa provável**: Frontend não está enviando `cargo` corretamente
- **Ação**: Revisar `HistoricoDiarios.jsx` linha que chama `/gestor/historico-diarios`

### Cenário C: Recebe status 304 (Not Modified)
- **Causa**: Cache do navegador
- **Ação**: `Ctrl+F5` (força reload sem cache) ou limpar cookies

### Cenário D: Tudo perfeito mas ainda mostra tudo
- **Causa**: Possível erro na subquery SQL
- **Ação**: Executar direto na query:
  ```sql
  SELECT id_obra FROM gestor_obras WHERE id_usuario = 17;
  ```
  E depois:
  ```sql
  SELECT * FROM diario_efetivo 
  WHERE id_obra IN (3, 4, 8)
  LIMIT 10;
  ```

---

## 📝 Resumo das Mudanças Feitas

| Item | Antes | Depois |
|------|-------|--------|
| **Backend /gestor/historico-diarios** | Logs básicos | ✅ Logs detalhados em 7 pontos |
| **Frontend DiarioObraTecnico** | Sem `id_gestor` | ✅ Envia `id_gestor` ao salvar |
| **Headers** | Cache liberado | ✅ Cache desabilitado (no-cache) |
| **Validação** | Simples | ✅ Mais robusta (id, cargo obrigatórios) |

---

## 🚀 Próximos Passos

1. ✅ **AGORA**: Reinicie backend e vá para "Histórico e Produção"
2. ⏳ **Próximo**: Cole aqui os logs do backend e o resultado do browser
3. ⏳ **Depois**: Execute os SQLs do banco para validar dados
4. ⏳ **Final**: Aplico correções conforme necessário

---

**Status**: Aguardando logs da Etapa 1 ⏳
