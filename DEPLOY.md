# Implementação na Vercel

O projeto está pronto para ser implantado na Vercel. Siga estes passos:

## 1. Preparação (Já Feita)
- [x] Backend migrado para Supabase
- [x] Dependências limpas (Express/PG removidos)
- [x] `vercel.json` criado para rotas SPA
- [x] `.env` seguro (não suba este arquivo para o Git!)

## 2. Deploy via GitHub (Recomendado)
1.  Faça o commit e push das alterações para o GitHub:
    ```bash
    git add .
    git commit -m "Preparando para deploy na Vercel"
    git push origin main
    ```
    *Nota: Certifique-se de estar na pasta correta (`d:\Projetos\AppDelivery\Delivery`). Se este for um subdiretório do repositório, configure o "Root Directory" na Vercel como `Delivery`.*

2.  Acesse o [Dashboard da Vercel](https://vercel.com/dashboard).
3.  Clique em **Add New Project** -> **Import** (selecione seu repositório `Delivery`).
4.  **Configurações de Build**:
    - **Framework Preset**: Vite
    - **Root Directory**: `Delivery` (se o repositório contiver a pasta raiz `AppDelivery`) ou `./` se você fez push apenas do conteúdo da pasta `Delivery`.
    - **Build Command**: `npm run build`
    - **Output Directory**: `dist`
5.  **Variáveis de Ambiente**:
    Copie os valores do seu arquivo `.env` e adicione na seção "Environment Variables" da Vercel:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
6.  Clique em **Deploy**.

## 3. Deploy via CLI
Se preferir usar a linha de comando:
```bash
npx vercel deploy
```
Siga as instruções na tela.

---
**Observação Importante:**
O arquivo `AcessToken.txt` e `.env` foram adicionados ao `.gitignore` para sua segurança. **Não** remova-os de lá.
