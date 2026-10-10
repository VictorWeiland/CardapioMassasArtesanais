# 🥖 Padeiro - Massas & Pães Artesanais
### Sistema de Cardápio Digital, Painel de Gestão e Relatórios

Aplicação completa desenvolvida em **TypeScript**, **Node.js/Express**, **SQLite** (banco local sem necessidade de configuração externa), **Painel de Administração com Acesso Restrito e Protegido por Senha** e **Relatórios Financeiros e de Vendas com Gráficos**.

---

## 🔒 Segurança & Acesso Restrito ao Painel Admin

Para manter o painel administrativo 100% privado e invisível aos clientes comuns:

1. **Botão Público Ocultado:** O cardápio do cliente (`/`) não exibe nenhum botão ou link para o painel administrativo.
2. **Atalho Secreto no Teclado:** No cardápio público, pressione **`Ctrl + Shift + A`** (ou acesse diretamente a URL `/admin`) para abrir o painel de administração.
3. **Tela de Login Privada com Senha:**
   - **Usuário Padrão:** `admin`
   - **Senha Padrão:** `padeiro123`
4. **Proteção de Rotas e APIs no Backend:**
   - As rotas de relatórios financeiros (`/api/reports/*`) e operações de alteração/exclusão de produtos e pedidos estão bloqueadas por tokens de autenticação criptografados via algoritmo `scrypt` nativo do Node.js.
   - O administrador pode alterar sua senha a qualquer momento através do botão **"Senha"** no cabeçalho do painel.

---

## 🚀 Funcionalidades Principais

### 1. 🛒 Cardápio Público do Cliente (`/`)
- Carregamento dinâmico dos 28 pratos e pães divididos nas 4 categorias oficiais:
  - *Massas Tradicionais* (Panquecas, Rondelli, Sofioli, Lasanha, Berinjela)
  - *Seleção de Nhoques* (Batata, Abóbora, Recheado com Queijo, Espinafre, Mandioca com Carne Seca)
  - *Padaria Artesanal* (Pão Caseiro, Brioche, Pão Recheado, Focaccias)
  - *Pizzas & Salgados* (Pizza Brotinho, Empadas, Coxinhas)
- **Modal de Variação:** Pratos com opções de peso (300g/600g) ou quantidade (2 un/5 un) aparecem como um único card; ao clicar em "Escolher Porção", um modal elegante permite selecionar a opção desejada.
- **Contador em Tempo Real:** Cada card exibe um selo indicando a quantidade que o cliente já possui na cesta.
- **Notificação no Canto Inferior Direito:** Ao adicionar itens, um toast surge no canto inferior direito informando a porção e quantidade adicionada.
- **Checkout Integrado ao WhatsApp:** Salva o pedido no banco de dados e abre o WhatsApp oficial **(11) 97034-5627** com a mensagem formatada.

### 2. ⚙️ Painel de Gestão Administrativa (`/admin`)
- **Gestão de Produtos (CRUD):**
  - Criação e edição com nome, porções, preços e descrição.
  - **Upload de Fotos:** Selecione fotos diretamente do computador com preview instantâneo.
  - Alterne visibilidade (Ativo/Inativo) ou exclua produtos com segurança.
- **Gestão de Pedidos em Tempo Real:**
  - Status: `Pendente` 🟡 -> `Preparando` 🔵 -> `Concluído` 🟢 -> `Cancelado` 🔴.
  - Botão para **Registrar Venda Balcão** manualmente.

### 3. 📊 Relatórios de Vendas & Métricas (`/admin#reports`)
- **Filtros por Período:** Hoje, Últimos 7 dias, Últimos 30 dias, Este Mês ou Todo o Histórico.
- **Indicadores (KPIs):** Faturamento Total (R$), Total de Pedidos Concluídos, Ticket Médio e Pedidos Pendentes.
- **Gráficos Interativos (Chart.js):**
  - Evolução diária do faturamento.
  - Distribuição de faturamento por categoria.
- **Ranking dos Mais Vendidos:** Tabela detalhada com foto, quantidade vendida e arrecadação.
- **Impressão / PDF:** Layout otimizado para impressão ou download em PDF.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Backend e Frontend)
- **Backend:** Node.js, Express, Multer, Better-SQLite3, Crypto (scrypt)
- **Banco de Dados:** [SQLite](https://www.sqlite.org/) (`data/cardapio.db`)
- **Frontend:** HTML5, Tailwind CSS, FontAwesome, Chart.js, Toastify JS
- **Build & Execução:** `tsx watch` e `esbuild`

---

## 💻 Comandos no Terminal

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor TypeScript em desenvolvimento com hot-reload |
| `npm run build` | Compila CSS, scripts clientes (`esbuild`) e servidor (`tsc`) |
| `npm start` | Inicia a versão de produção compilada |
