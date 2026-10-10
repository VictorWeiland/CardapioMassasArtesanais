// TypeScript client for Padeiro - Massas & Pães Artesanais Admin Dashboard
import { Product, Category, Order, ReportSummary, TopProduct, CategorySales, SalesByDate } from '../types';

declare const Toastify: any;
declare const Chart: any;

class AdminDashboard {
  private token: string | null = null;
  private currentAdminUsername = 'admin';

  private categories: Category[] = [];
  private products: Product[] = [];
  private orders: Order[] = [];
  private selectedOrderStatus = 'Todos';
  private selectedReportPeriod = '30days';

  // Charts references
  private timelineChart: any = null;
  private categoriesChart: any = null;

  // Manual Order Items in Counter Sale modal
  private manualOrderItems: { productId: number; name: string; price: number; quantity: number }[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupAuthForms();
    this.setupTabs();
    this.setupModals();
    this.setupEventListeners();

    const isAuthenticated = await this.checkAuth();
    if (isAuthenticated) {
      // Check URL hash for initial tab
      const hash = window.location.hash;
      if (hash === '#reports') {
        this.switchTab('reports');
      } else if (hash === '#orders') {
        this.switchTab('orders');
      } else {
        this.switchTab('products');
      }

      await this.fetchCategories();
      await this.fetchProducts();
      await this.fetchOrders();
      await this.fetchReports();
    }
  }

  // ==========================================
  // AUTHENTICATION & ACCESS CONTROL
  // ==========================================
  private getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async checkAuth(): Promise<boolean> {
    this.token = localStorage.getItem('padeiro_admin_token');
    if (!this.token) {
      this.showLogin();
      return false;
    }

    try {
      const res = await fetch('/api/auth/verify', {
        headers: this.getAuthHeaders()
      });

      if (!res.ok) {
        this.logout();
        return false;
      }

      const data = await res.json();
      this.currentAdminUsername = data.user?.username || 'admin';
      const userDisplay = document.getElementById('admin-user-display');
      if (userDisplay) userDisplay.textContent = this.currentAdminUsername;

      this.showDashboard();
      return true;
    } catch (e) {
      this.logout();
      return false;
    }
  }

  private showLogin(): void {
    const loginView = document.getElementById('view-login');
    const dashView = document.getElementById('view-dashboard');
    if (loginView) {
      loginView.classList.remove('hidden');
      loginView.classList.add('flex');
    }
    if (dashView) {
      dashView.classList.add('hidden');
      dashView.classList.remove('flex');
    }
  }

  private showDashboard(): void {
    const loginView = document.getElementById('view-login');
    const dashView = document.getElementById('view-dashboard');
    if (loginView) {
      loginView.classList.add('hidden');
      loginView.classList.remove('flex');
    }
    if (dashView) {
      dashView.classList.remove('hidden');
      dashView.classList.add('flex');
    }
  }

  private logout(): void {
    if (this.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      }).catch(() => {});
    }
    this.token = null;
    localStorage.removeItem('padeiro_admin_token');
    this.showLogin();
  }

  private setupAuthForms(): void {
    // Form de Login
    const formLogin = document.getElementById('form-login') as HTMLFormElement | null;
    const btnSubmitLogin = document.getElementById('btn-submit-login') as HTMLButtonElement | null;
    const alertError = document.getElementById('login-error-alert');
    const textError = document.getElementById('login-error-text');

    formLogin?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userInput = (document.getElementById('login-username') as HTMLInputElement)?.value.trim();
      const passInput = (document.getElementById('login-password') as HTMLInputElement)?.value;

      if (!userInput || !passInput) return;

      try {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = true;
          btnSubmitLogin.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Entrando...';
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userInput, password: passInput })
        });

        const data = await res.json();

        if (!res.ok) {
          if (alertError && textError) {
            textError.textContent = data.error || 'Credenciais inválidas.';
            alertError.classList.remove('hidden');
          }
          return;
        }

        this.token = data.token;
        localStorage.setItem('padeiro_admin_token', data.token);
        this.currentAdminUsername = data.username;
        const userDisplay = document.getElementById('admin-user-display');
        if (userDisplay) userDisplay.textContent = this.currentAdminUsername;

        if (alertError) alertError.classList.add('hidden');
        this.showDashboard();
        this.notify(`Bem-vindo, ${data.username}!`, 'success');

        await this.fetchCategories();
        await this.fetchProducts();
        await this.fetchOrders();
        await this.fetchReports();
      } catch (err: any) {
        if (alertError && textError) {
          textError.textContent = 'Erro ao comunicar com o servidor.';
          alertError.classList.remove('hidden');
        }
      } finally {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.innerHTML = '<i class="fa fa-arrow-right-to-bracket"></i> <span>Entrar no Painel</span>';
        }
      }
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Deseja realmente sair do painel administrativo?')) {
        this.logout();
        this.notify('Sessão encerrada com segurança.', 'info');
      }
    });

    // Alterar Senha
    const modalPass = document.getElementById('modal-change-password');
    const btnOpenPass = document.getElementById('btn-open-change-password');
    const btnClosePass = document.getElementById('btn-close-modal-password');
    const btnCancelPass = document.getElementById('btn-cancel-modal-password');
    const formPass = document.getElementById('form-change-password') as HTMLFormElement | null;

    btnOpenPass?.addEventListener('click', () => {
      formPass?.reset();
      if (modalPass) {
        modalPass.classList.remove('hidden');
        modalPass.style.display = 'flex';
      }
    });

    const closePassModal = () => {
      if (modalPass) {
        modalPass.classList.add('hidden');
        modalPass.style.display = 'none';
      }
    };
    btnClosePass?.addEventListener('click', closePassModal);
    btnCancelPass?.addEventListener('click', closePassModal);
    modalPass?.addEventListener('click', (e) => {
      if (e.target === modalPass) closePassModal();
    });

    formPass?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = (document.getElementById('input-current-password') as HTMLInputElement)?.value;
      const newPassword = (document.getElementById('input-new-password') as HTMLInputElement)?.value;

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');

        this.notify('Senha alterada com sucesso!', 'success');
        closePassModal();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  // ==========================================
  // NAVIGATION TABS
  // ==========================================
  private setupTabs(): void {
    const tabProducts = document.getElementById('tab-btn-products');
    const tabOrders = document.getElementById('tab-btn-orders');
    const tabReports = document.getElementById('tab-btn-reports');

    tabProducts?.addEventListener('click', () => this.switchTab('products'));
    tabOrders?.addEventListener('click', () => this.switchTab('orders'));
    tabReports?.addEventListener('click', () => this.switchTab('reports'));
  }

  private switchTab(tab: 'products' | 'orders' | 'reports'): void {
    const secProducts = document.getElementById('section-products');
    const secOrders = document.getElementById('section-orders');
    const secReports = document.getElementById('section-reports');

    const btnProducts = document.getElementById('tab-btn-products');
    const btnOrders = document.getElementById('tab-btn-orders');
    const btnReports = document.getElementById('tab-btn-reports');

    [btnProducts, btnOrders, btnReports].forEach(btn => btn?.classList.remove('active'));
    [secProducts, secOrders, secReports].forEach(sec => {
      if (sec) {
        sec.classList.remove('block');
        sec.classList.add('hidden');
      }
    });

    if (tab === 'products') {
      btnProducts?.classList.add('active');
      secProducts?.classList.remove('hidden');
      secProducts?.classList.add('block');
      window.location.hash = '#products';
    } else if (tab === 'orders') {
      btnOrders?.classList.add('active');
      secOrders?.classList.remove('hidden');
      secOrders?.classList.add('block');
      window.location.hash = '#orders';
      this.fetchOrders();
    } else if (tab === 'reports') {
      btnReports?.classList.add('active');
      secReports?.classList.remove('hidden');
      secReports?.classList.add('block');
      window.location.hash = '#reports';
      this.fetchReports();
    }
  }

  // ==========================================
  // MODALS AND FORMS
  // ==========================================
  private setupModals(): void {
    // Product Modal
    const modalProduct = document.getElementById('modal-product');
    const btnOpenCreate = document.getElementById('btn-open-create-product');
    const btnCloseProduct = document.getElementById('btn-close-modal-product');
    const btnCancelProduct = document.getElementById('btn-cancel-modal-product');
    const formProduct = document.getElementById('form-product') as HTMLFormElement | null;
    const inputFile = document.getElementById('product-image-file') as HTMLInputElement | null;
    const previewImg = document.getElementById('product-image-preview') as HTMLImageElement | null;
    const fileNameEl = document.getElementById('product-file-name');
    const inputUrl = document.getElementById('product-image-url') as HTMLInputElement | null;

    btnOpenCreate?.addEventListener('click', () => {
      this.openProductModal();
    });

    const closeProductModal = () => {
      if (modalProduct) {
        modalProduct.classList.add('hidden');
        modalProduct.style.display = 'none';
      }
    };

    btnCloseProduct?.addEventListener('click', closeProductModal);
    btnCancelProduct?.addEventListener('click', closeProductModal);
    modalProduct?.addEventListener('click', (e) => {
      if (e.target === modalProduct) closeProductModal();
    });

    // Instant Photo Preview on file select
    inputFile?.addEventListener('change', () => {
      if (inputFile.files && inputFile.files[0]) {
        const file = inputFile.files[0];
        if (fileNameEl) fileNameEl.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
          if (previewImg && e.target?.result) {
            previewImg.src = e.target.result as string;
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Preview on direct URL input
    inputUrl?.addEventListener('input', () => {
      if (inputUrl.value.trim() !== '' && previewImg) {
        previewImg.src = inputUrl.value.trim();
      }
    });

    // Product Form Submit
    formProduct?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveProduct();
    });

    // Portion Chip Shortcuts in Product Modal
    const portionInput = document.getElementById('product-portion') as HTMLInputElement | null;
    document.querySelectorAll('.btn-portion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pVal = chip.getAttribute('data-portion');
        if (!pVal || !portionInput) return;
        const current = portionInput.value.trim();
        if (!current) {
          portionInput.value = pVal;
        } else {
          const existingList = current.split(',').map(s => s.trim().split(':')[0].trim());
          if (!existingList.includes(pVal)) {
            portionInput.value = `${current}, ${pVal}`;
          }
        }
        portionInput.focus();
      });
    });

    // Category Modal Setup
    const modalCategory = document.getElementById('modal-category');
    const btnOpenCategoryModal = document.getElementById('btn-open-manage-categories');
    const btnCloseCategoryModal = document.getElementById('btn-close-modal-category');
    const btnDoneCategoryModal = document.getElementById('btn-done-modal-category');
    const formCreateCategory = document.getElementById('form-create-category') as HTMLFormElement | null;

    btnOpenCategoryModal?.addEventListener('click', () => {
      this.openCategoriesModal();
    });

    const closeCategoryModal = () => {
      if (modalCategory) {
        modalCategory.classList.add('hidden');
        modalCategory.style.display = 'none';
      }
    };

    btnCloseCategoryModal?.addEventListener('click', closeCategoryModal);
    btnDoneCategoryModal?.addEventListener('click', closeCategoryModal);

    modalCategory?.addEventListener('click', (e) => {
      if (e.target === modalCategory) closeCategoryModal();
    });

    formCreateCategory?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateCategory();
    });

    // Order (Counter Sale) Modal
    const modalOrder = document.getElementById('modal-create-order');
    const btnOpenOrders = document.querySelectorAll('.btn-open-counter-sale, #btn-open-create-order, #btn-header-quick-sale');
    const btnCloseOrder = document.getElementById('btn-close-modal-order');
    const btnCancelOrder = document.getElementById('btn-cancel-modal-order');
    const formOrder = document.getElementById('form-create-order') as HTMLFormElement | null;
    const btnAddItem = document.getElementById('btn-add-item-to-order');

    btnOpenOrders.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openCounterSaleModal();
      });
    });

    const closeOrderModal = () => {
      if (modalOrder) {
        modalOrder.classList.add('hidden');
        modalOrder.style.display = 'none';
      }
    };

    btnCloseOrder?.addEventListener('click', closeOrderModal);
    btnCancelOrder?.addEventListener('click', closeOrderModal);

    modalOrder?.addEventListener('click', (e) => {
      if (e.target === modalOrder) closeOrderModal();
    });

    btnAddItem?.addEventListener('click', (e) => {
      e.preventDefault();
      this.addItemToManualOrder();
    });

    formOrder?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveManualOrder();
    });
  }

  private setupEventListeners(): void {
    // Search product
    const searchInput = document.getElementById('search-product-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.renderProductsTable();
    });

    // Filter product category
    const catSelect = document.getElementById('filter-category-select') as HTMLSelectElement | null;
    catSelect?.addEventListener('change', () => {
      this.renderProductsTable();
    });

    // Order status filter buttons
    const statusBtns = document.querySelectorAll('.order-filter-btn');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusBtns.forEach(b => {
          b.classList.remove('bg-stone-900', 'text-white');
          b.classList.add('bg-gray-100', 'text-gray-700');
        });
        btn.classList.remove('bg-gray-100', 'text-gray-700');
        btn.classList.add('bg-stone-900', 'text-white');

        this.selectedOrderStatus = btn.getAttribute('data-status') || 'Todos';
        this.renderOrders();
      });
    });

    // Refresh orders
    document.getElementById('btn-refresh-orders')?.addEventListener('click', () => {
      this.fetchOrders();
    });

    // Reports period select
    const periodSelect = document.getElementById('reports-period-select') as HTMLSelectElement | null;
    periodSelect?.addEventListener('change', () => {
      this.selectedReportPeriod = periodSelect.value;
      this.fetchReports();
    });

    // Print reports button
    document.getElementById('btn-print-reports')?.addEventListener('click', () => {
      window.print();
    });
  }

  // ==========================================
  // CATEGORIES
  // ==========================================
  private async fetchCategories(): Promise<void> {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Erro ao buscar categorias');
      this.categories = await res.json();

      const filterSelect = document.getElementById('filter-category-select') as HTMLSelectElement | null;
      const modalSelect = document.getElementById('product-category') as HTMLSelectElement | null;

      if (filterSelect) {
        const currentFilter = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Todas as Categorias</option>';
        this.categories.forEach(c => {
          filterSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        filterSelect.value = currentFilter;
      }

      if (modalSelect) {
        const currentSelected = modalSelect.value;
        modalSelect.innerHTML = '';
        this.categories.forEach(c => {
          modalSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        if (currentSelected) modalSelect.value = currentSelected;
      }

      this.renderCategoriesModalList();
    } catch (e) {
      console.error(e);
    }
  }

  private openCategoriesModal(): void {
    const modal = document.getElementById('modal-category');
    const inputName = document.getElementById('category-name-input') as HTMLInputElement | null;
    if (inputName) inputName.value = '';
    this.renderCategoriesModalList();
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    inputName?.focus();
  }

  private renderCategoriesModalList(): void {
    const listEl = document.getElementById('categories-modal-list');
    const badgeEl = document.getElementById('categories-count-badge');
    if (!listEl) return;

    if (badgeEl) {
      badgeEl.textContent = `${this.categories.length} ${this.categories.length === 1 ? 'categoria' : 'categorias'}`;
    }

    if (this.categories.length === 0) {
      listEl.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">Nenhuma categoria cadastrada</div>`;
      return;
    }

    listEl.innerHTML = this.categories.map(c => {
      const count = c.product_count ?? 0;
      return `
        <div class="px-4 py-3 flex items-center justify-between hover:bg-gray-50/70 transition">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
              <i class="fa fa-tag text-[11px]"></i>
            </span>
            <div>
              <p class="font-bold text-sm text-gray-900 leading-tight">${c.name}</p>
              <p class="text-[11px] text-gray-400 font-mono">slug: ${c.slug}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${count > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-gray-100 text-gray-500'}">
              ${count} ${count === 1 ? 'produto' : 'produtos'}
            </span>
            <button 
              type="button" 
              class="btn-delete-category p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" 
              data-id="${c.id}" 
              data-name="${c.name}"
              data-count="${count}"
              title="Excluir categoria"
            >
              <i class="fa fa-trash-can text-sm"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-delete-category').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const name = btn.getAttribute('data-name') || '';
        const count = Number(btn.getAttribute('data-count') || 0);
        this.confirmDeleteCategory(id, name, count);
      });
    });
  }

  private async handleCreateCategory(): Promise<void> {
    const inputName = document.getElementById('category-name-input') as HTMLInputElement | null;
    const btnSubmit = document.getElementById('btn-submit-category') as HTMLButtonElement | null;
    const name = inputName?.value.trim();

    if (!name) {
      this.notify('Informe o nome da categoria.', 'warning');
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
      }

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name })
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar categoria');
      }

      this.notify(`Categoria "${data.name}" criada com sucesso!`, 'success');
      if (inputName) inputName.value = '';

      await this.fetchCategories();
      await this.fetchProducts();
    } catch (error: any) {
      console.error(error);
      this.notify(error.message || 'Erro ao criar categoria', 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa fa-plus"></i> <span>Adicionar</span>';
      }
    }
  }

  private async confirmDeleteCategory(id: number, name: string, productCount: number): Promise<void> {
    if (productCount > 0) {
      alert(`A categoria "${name}" possui ${productCount} produto(s) associado(s). Para excluí-la, altere a categoria desses produtos ou exclua-os primeiro.`);
      return;
    }

    const confirmed = confirm(`Tem certeza que deseja excluir a categoria "${name}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir categoria');
      }

      this.notify(`Categoria "${name}" excluída com sucesso!`, 'success');
      await this.fetchCategories();
      await this.fetchProducts();
    } catch (error: any) {
      console.error(error);
      this.notify(error.message || 'Erro ao excluir categoria', 'error');
    }
  }

  // ==========================================
  // PRODUCTS MANAGEMENT (CRUD)
  // ==========================================
  private async fetchProducts(): Promise<void> {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Erro ao buscar produtos');
      this.products = await res.json();
      this.renderProductsTable();
      this.updateProductsForOrderSelect();
    } catch (e) {
      console.error('Erro ao buscar produtos:', e);
      this.notify('Falha ao carregar lista de produtos', 'error');
    }
  }

  private renderProductsTable(): void {
    const tbody = document.getElementById('products-table-body');
    const badge = document.getElementById('products-count-badge');
    const searchVal = (document.getElementById('search-product-input') as HTMLInputElement)?.value.toLowerCase().trim() || '';
    const catVal = (document.getElementById('filter-category-select') as HTMLSelectElement)?.value || '';

    if (!tbody) return;

    let filtered = this.products;

    if (searchVal) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchVal) || 
        (p.description && p.description.toLowerCase().includes(searchVal))
      );
    }

    if (catVal) {
      filtered = filtered.filter(p => p.category_id === Number(catVal));
    }

    if (badge) {
      badge.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'}`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-12 text-center text-gray-400">
            <i class="fa fa-box-open text-3xl mb-2 text-gray-300"></i>
            <p class="font-medium">Nenhum produto encontrado.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const formattedPrice = p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const statusBadge = p.active === 1
        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo
           </span>`
        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
             <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Inativo
           </span>`;

      return `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-xs flex items-center justify-center">
              <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.src='/assets/padeiro/paes.png'">
            </div>
          </td>
          <td class="px-6 py-4">
            <div class="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              <span>${p.name}</span>
              ${p.portion ? (p.portion.includes(',') 
                ? `<span class="bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200" title="${p.portion}"><i class="fa fa-scale-balanced text-[9px] mr-1"></i>${p.portion.split(',').length} tamanhos</span>` 
                : `<span class="bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200">${p.portion}</span>`
              ) : ''}
              ${p.flavors ? `<span class="bg-purple-100 text-purple-900 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-200" title="Opções: ${p.flavors}"><i class="fa fa-utensils text-[9px] mr-1"></i>${p.flavors.split(',').length} opções</span>` : ''}
            </div>
            <div class="text-xs text-gray-500 line-clamp-1 max-w-xs mt-0.5">${p.description || '-'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="bg-amber-100/80 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold">
              ${p.category_name || 'Outros'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap font-black text-gray-900">
            ${formattedPrice}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <button class="btn-toggle-status cursor-pointer" data-id="${p.id}" title="Clique para alternar visibilidade no cardápio">
              ${statusBadge}
            </button>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right space-x-2">
            <button class="btn-edit-product p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" data-id="${p.id}" title="Editar Produto">
              <i class="fa fa-pen-to-square"></i>
            </button>
            <button class="btn-delete-product p-2 text-red-600 hover:bg-red-50 rounded-lg transition" data-id="${p.id}" title="Excluir Produto">
              <i class="fa fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.openProductModal(id);
      });
    });

    tbody.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.confirmDeleteProduct(id);
      });
    });

    tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.toggleProductStatus(id);
      });
    });
  }

  private openProductModal(productId?: number): void {
    const modal = document.getElementById('modal-product');
    const modalTitle = document.getElementById('modal-product-title');
    const inputId = document.getElementById('product-id') as HTMLInputElement;
    const inputName = document.getElementById('product-name') as HTMLInputElement;
    const inputCat = document.getElementById('product-category') as HTMLSelectElement;
    const inputPortion = document.getElementById('product-portion') as HTMLInputElement | null;
    const inputFlavors = document.getElementById('product-flavors') as HTMLInputElement | null;
    const inputPrice = document.getElementById('product-price') as HTMLInputElement;
    const inputDesc = document.getElementById('product-description') as HTMLTextAreaElement;
    const inputUrl = document.getElementById('product-image-url') as HTMLInputElement;
    const inputFile = document.getElementById('product-image-file') as HTMLInputElement;
    const previewImg = document.getElementById('product-image-preview') as HTMLImageElement;
    const fileNameEl = document.getElementById('product-file-name');

    if (!modal) return;

    if (inputFile) inputFile.value = '';
    if (fileNameEl) fileNameEl.textContent = 'Nenhum novo arquivo selecionado';

    if (productId) {
      const product = this.products.find(p => p.id === productId);
      if (!product) return;

      if (modalTitle) modalTitle.innerHTML = '<i class="fa fa-pen-to-square text-[#b45309]"></i> <span>Editar Produto</span>';
      if (inputId) inputId.value = product.id.toString();
      if (inputName) inputName.value = product.name;
      if (inputCat) inputCat.value = product.category_id.toString();
      if (inputPrice) inputPrice.value = product.price.toString();
      if (inputDesc) inputDesc.value = product.description || '';
      if (inputFlavors) inputFlavors.value = product.flavors || '';
      if (inputUrl) inputUrl.value = product.image_url;
      if (previewImg) previewImg.src = product.image_url;

      let portionVal = product.portion || '';
      if (!portionVal) {
        const match = product.name.match(/\((.*?)\)/);
        if (match) portionVal = match[1].trim();
      }
      if (inputPortion) inputPortion.value = portionVal;
    } else {
      if (modalTitle) modalTitle.innerHTML = '<i class="fa fa-plus-circle text-[#b45309]"></i> <span>Cadastrar Novo Produto</span>';
      if (inputId) inputId.value = '';
      if (inputName) inputName.value = '';
      if (inputPrice) inputPrice.value = '';
      if (inputPortion) inputPortion.value = '';
      if (inputFlavors) inputFlavors.value = '';
      if (inputDesc) inputDesc.value = '';
      if (inputUrl) inputUrl.value = '';
      if (previewImg) previewImg.src = '/assets/padeiro/paes.png';
      if (inputCat && this.categories.length > 0) inputCat.value = this.categories[0].id.toString();
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  private async handleSaveProduct(): Promise<void> {
    const inputId = (document.getElementById('product-id') as HTMLInputElement)?.value;
    const inputName = (document.getElementById('product-name') as HTMLInputElement)?.value.trim();
    const inputCat = (document.getElementById('product-category') as HTMLSelectElement)?.value;
    const inputPortion = (document.getElementById('product-portion') as HTMLInputElement)?.value.trim() || '';
    const inputFlavors = (document.getElementById('product-flavors') as HTMLInputElement)?.value.trim() || '';
    const inputPrice = (document.getElementById('product-price') as HTMLInputElement)?.value;
    const inputDesc = (document.getElementById('product-description') as HTMLTextAreaElement)?.value.trim();
    const inputUrl = (document.getElementById('product-image-url') as HTMLInputElement)?.value.trim();
    const inputFile = (document.getElementById('product-image-file') as HTMLInputElement)?.files?.[0];
    const submitBtn = document.getElementById('btn-submit-product') as HTMLButtonElement | null;

    if (!inputName || !inputPrice || !inputCat) {
      alert('Preencha os campos obrigatórios (Nome, Preço e Categoria).');
      return;
    }

    const formData = new FormData();
    formData.append('name', inputName);
    formData.append('price', inputPrice);
    formData.append('category_id', inputCat);
    formData.append('portion', inputPortion);
    formData.append('flavors', inputFlavors);
    formData.append('description', inputDesc);

    if (inputFile) {
      formData.append('image', inputFile);
    } else if (inputUrl) {
      formData.append('image_url', inputUrl);
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
      }

      const isEdit = Boolean(inputId);
      const url = isEdit ? `/api/products/${inputId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: formData
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar produto');
      }

      this.notify(isEdit ? 'Produto atualizado com sucesso!' : 'Novo produto cadastrado!', 'success');
      document.getElementById('modal-product')?.classList.add('hidden');

      await this.fetchProducts();
      await this.fetchReports();
    } catch (error: any) {
      console.error(error);
      this.notify(error.message || 'Erro ao salvar produto', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa fa-save"></i> <span>Salvar Produto</span>';
      }
    }
  }

  private async toggleProductStatus(id: number): Promise<void> {
    try {
      const res = await fetch(`/api/products/${id}/toggle`, {
        method: 'PATCH',
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Erro ao alterar status');
      const data = await res.json();
      const product = this.products.find(p => p.id === id);
      if (product) {
        product.active = data.active;
        this.renderProductsTable();
        this.notify(`Produto agora está ${data.active === 1 ? 'visível' : 'oculto'} no cardápio`, 'info');
      }
    } catch (e) {
      console.error(e);
      this.notify('Não foi possível alterar o status do produto', 'error');
    }
  }

  private async confirmDeleteProduct(id: number): Promise<void> {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    const confirmed = confirm(`Tem certeza que deseja excluir "${product.name}"? Esta ação removerá o produto do cardápio.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Erro ao excluir produto');

      this.notify('Produto excluído com sucesso!', 'success');
      await this.fetchProducts();
      await this.fetchReports();
    } catch (error: any) {
      console.error(error);
      this.notify('Erro ao excluir produto', 'error');
    }
  }

  // ==========================================
  // ORDERS MANAGEMENT
  // ==========================================
  private async fetchOrders(): Promise<void> {
    try {
      const res = await fetch('/api/orders', {
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Erro ao buscar pedidos');
      this.orders = await res.json();

      const pendingCount = this.orders.filter(o => o.status === 'Pendente' || o.status === 'Preparando').length;
      const badge = document.getElementById('badge-pending-orders');
      if (badge) {
        if (pendingCount > 0) {
          badge.textContent = pendingCount.toString();
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      this.renderOrders();
    } catch (e) {
      console.error('Erro ao buscar pedidos:', e);
    }
  }

  private renderOrders(): void {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    let filtered = this.orders;
    if (this.selectedOrderStatus !== 'Todos') {
      filtered = filtered.filter(o => o.status === this.selectedOrderStatus);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          <i class="fa fa-receipt text-4xl mb-3 text-amber-300"></i>
          <p class="font-medium text-base">Nenhum pedido encontrado nesta categoria.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => {
      const formattedTotal = order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const orderDate = new Date(order.created_at);
      const dateStr = orderDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

      let statusColor = 'bg-yellow-50 text-yellow-800 border-yellow-200';
      if (order.status === 'Preparando') statusColor = 'bg-blue-50 text-blue-800 border-blue-200';
      if (order.status === 'Concluído') statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      if (order.status === 'Cancelado') statusColor = 'bg-red-50 text-red-800 border-red-200';

      const itemsHtml = (order.items || []).map(item => `
        <div class="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
          <span class="text-gray-700"><strong>${item.quantity}x</strong> ${item.product_name}</span>
          <span class="font-semibold text-gray-900">R$ ${item.subtotal.toFixed(2)}</span>
        </div>
      `).join('');

      return `
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div class="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div>
                <span class="font-black text-gray-900 text-base font-serif-title">Pedido #${order.id}</span>
                <p class="text-xs text-gray-400">${dateStr}</p>
              </div>

              <select class="order-status-select text-xs font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${statusColor}" data-id="${order.id}">
                <option value="Pendente" ${order.status === 'Pendente' ? 'selected' : ''}>🟡 Pendente</option>
                <option value="Preparando" ${order.status === 'Preparando' ? 'selected' : ''}>🔵 Preparando</option>
                <option value="Concluído" ${order.status === 'Concluído' ? 'selected' : ''}>🟢 Concluído</option>
                <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>🔴 Cancelado</option>
              </select>
            </div>

            <div class="space-y-1.5 mb-3 text-xs text-gray-600">
              <p><i class="fa fa-user text-gray-400 mr-1.5 w-4"></i> <strong>Cliente:</strong> ${order.customer_name || 'Balcão'}</p>
              <p><i class="fa fa-location-dot text-gray-400 mr-1.5 w-4"></i> <strong>Endereço:</strong> ${order.delivery_address}</p>
              <p><i class="fa fa-credit-card text-gray-400 mr-1.5 w-4"></i> <strong>Pagamento:</strong> ${order.payment_method}</p>
            </div>

            <div class="bg-amber-50/40 rounded-xl p-3 mb-3 border border-amber-100">
              <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Itens:</p>
              ${itemsHtml}
            </div>
          </div>

          <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span class="font-black text-base text-[#b45309]">${formattedTotal}</span>
            <button class="btn-delete-order text-gray-400 hover:text-red-600 transition p-1.5 text-sm" data-id="${order.id}" title="Excluir Registro">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const target = e.target as HTMLSelectElement;
        const id = Number(target.getAttribute('data-id'));
        const newStatus = target.value;
        await this.updateOrderStatus(id, newStatus);
      });
    });

    container.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-id'));
        if (confirm(`Deseja remover o registro do pedido #${id}?`)) {
          await this.deleteOrder(id);
        }
      });
    });
  }

  private async updateOrderStatus(id: number, status: string): Promise<void> {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status })
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Erro ao atualizar status');
      this.notify(`Pedido #${id} alterado para "${status}"`, 'success');
      await this.fetchOrders();
      await this.fetchReports();
    } catch (e) {
      console.error(e);
      this.notify('Falha ao atualizar status do pedido', 'error');
    }
  }

  private async deleteOrder(id: number): Promise<void> {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (res.status === 401) {
        this.logout();
        return;
      }

      if (!res.ok) throw new Error('Erro ao excluir pedido');
      this.notify(`Pedido #${id} excluído`, 'info');
      await this.fetchOrders();
      await this.fetchReports();
    } catch (e) {
      console.error(e);
      this.notify('Falha ao excluir pedido', 'error');
    }
  }

  // ==========================================
  // MANUAL COUNTER SALE (Venda Balcão)
  // ==========================================
  private updateProductsForOrderSelect(): void {
    const select = document.getElementById('order-select-product') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '';
    const activeProducts = this.products.filter(p => p.active !== 0);
    const prodsToRender = activeProducts.length > 0 ? activeProducts : this.products;

    if (prodsToRender.length === 0) {
      select.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
      return;
    }

    prodsToRender.forEach(p => {
      // Se tiver porções definidas com preço (ex: 300g: 22, 600g: 42)
      if (p.portion && p.portion.includes(',')) {
        const parts = p.portion.split(',').map(s => s.trim()).filter(Boolean);
        parts.forEach(part => {
          const [label, priceStr] = part.split(':').map(s => s.trim());
          const optPrice = priceStr ? parseFloat(priceStr.replace(',', '.')) : p.price;
          const finalPrice = isNaN(optPrice) ? p.price : optPrice;
          const optName = `${p.name} (${label})`;
          select.innerHTML += `<option value="${p.id}" data-name="${optName}" data-price="${finalPrice}">${optName} - R$ ${finalPrice.toFixed(2)}</option>`;
        });
      } else {
        const optName = p.portion && !p.name.includes(p.portion) ? `${p.name} (${p.portion})` : p.name;
        select.innerHTML += `<option value="${p.id}" data-name="${optName}" data-price="${p.price}">${optName} - R$ ${p.price.toFixed(2)}</option>`;
      }
    });
  }

  private openCounterSaleModal(): void {
    const modal = document.getElementById('modal-create-order');
    if (!modal) return;

    this.manualOrderItems = [];
    this.updateProductsForOrderSelect();
    this.renderManualOrderItems();

    const customerInput = document.getElementById('order-customer-name') as HTMLInputElement | null;
    if (customerInput) customerInput.value = 'Cliente Balcão';

    const qtyInput = document.getElementById('order-product-qty') as HTMLInputElement | null;
    if (qtyInput) qtyInput.value = '1';

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  private addItemToManualOrder(): boolean {
    const select = document.getElementById('order-select-product') as HTMLSelectElement | null;
    const qtyInput = document.getElementById('order-product-qty') as HTMLInputElement | null;

    if (!select || !qtyInput || select.selectedIndex < 0 || select.options.length === 0) return false;

    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) return false;

    const productId = Number(selectedOption.value);
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const name = selectedOption.getAttribute('data-name') || selectedOption.text;
    const price = parseFloat(selectedOption.getAttribute('data-price') || '0');

    const existing = this.manualOrderItems.find(i => i.name === name);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.manualOrderItems.push({ productId, name, price, quantity: qty });
    }

    qtyInput.value = '1';
    this.renderManualOrderItems();
    return true;
  }

  private renderManualOrderItems(): void {
    const container = document.getElementById('order-items-table');
    const totalDisplay = document.getElementById('order-total-display');

    if (!container || !totalDisplay) return;

    let total = 0;
    if (this.manualOrderItems.length === 0) {
      container.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Nenhum produto adicionado ainda</p>';
    } else {
      container.innerHTML = this.manualOrderItems.map((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
          <div class="flex items-center justify-between text-xs py-1.5 border-b border-gray-200 last:border-0">
            <div>
              <strong class="text-gray-900">${item.quantity}x</strong> <span class="font-medium text-gray-800">${item.name}</span>
              <span class="text-gray-400 ml-1 font-semibold">(R$ ${subtotal.toFixed(2)})</span>
            </div>
            <button type="button" class="btn-remove-manual-item text-red-500 hover:text-red-700 p-1" data-index="${index}" title="Remover item">
              <i class="fa fa-times"></i>
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-remove-manual-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const idx = Number(btn.getAttribute('data-index'));
          this.manualOrderItems.splice(idx, 1);
          this.renderManualOrderItems();
        });
      });
    }

    totalDisplay.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private async handleSaveManualOrder(): Promise<void> {
    // Se o operador não clicou no botão "Adicionar", adiciona o produto selecionado automaticamente!
    if (this.manualOrderItems.length === 0) {
      this.addItemToManualOrder();
    }

    if (this.manualOrderItems.length === 0) {
      this.notify('Selecione um produto para registrar a venda.', 'warning');
      return;
    }

    const btnSubmit = document.querySelector('#form-create-order button[type="submit"]') as HTMLButtonElement | null;
    const originalBtnHtml = btnSubmit ? btnSubmit.innerHTML : '';

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Registrando...';
      }

      const customerName = (document.getElementById('order-customer-name') as HTMLInputElement)?.value.trim() || 'Cliente Balcão';
      const paymentMethod = (document.getElementById('order-payment-method') as HTMLSelectElement)?.value || 'Dinheiro';

      const orderPayload = {
        customer_name: customerName,
        customer_phone: '',
        delivery_address: 'Venda Balcão / Retirada',
        payment_method: paymentMethod,
        status: 'Concluído',
        items: this.manualOrderItems.map(i => ({
          product_id: i.productId,
          product_name: i.name,
          unit_price: i.price,
          quantity: i.quantity
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao registrar venda balcão');
      }

      const createdOrder = await res.json();
      const totalStr = (createdOrder.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      this.notify(`Venda no balcão de ${totalStr} registrada com sucesso!`, 'success');

      const modal = document.getElementById('modal-create-order');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }

      this.manualOrderItems = [];
      await this.fetchOrders();
      await this.fetchReports();
    } catch (e: any) {
      console.error(e);
      this.notify(e.message || 'Falha ao registrar venda', 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnHtml;
      }
    }
  }

  // ==========================================
  // REPORTS AND ANALYTICS (Relatórios de Vendas)
  // ==========================================
  private async fetchReports(): Promise<void> {
    const period = this.selectedReportPeriod;

    try {
      const headers = this.getAuthHeaders();

      // 1. KPI summary
      const sumRes = await fetch(`/api/reports/summary?period=${period}`, { headers });
      if (sumRes.status === 401) {
        this.logout();
        return;
      }
      if (sumRes.ok) {
        const summary: ReportSummary = await sumRes.json();
        this.renderKpiSummary(summary);
      }

      // 2. Timeline Chart
      const timeRes = await fetch(`/api/reports/sales-by-date?period=${period}`, { headers });
      if (timeRes.ok) {
        const timeline: SalesByDate[] = await timeRes.json();
        this.renderTimelineChart(timeline);
      }

      // 3. Category Pie Chart
      const catRes = await fetch(`/api/reports/by-category?period=${period}`, { headers });
      if (catRes.ok) {
        const catSales: CategorySales[] = await catRes.json();
        this.renderCategoriesChart(catSales);
      }

      // 4. Top selling products
      const topRes = await fetch(`/api/reports/top-products?period=${period}&limit=10`, { headers });
      if (topRes.ok) {
        const topProducts: TopProduct[] = await topRes.json();
        this.renderTopProductsTable(topProducts);
      }
    } catch (e) {
      console.error('Erro ao buscar relatórios:', e);
    }
  }

  private renderKpiSummary(summary: ReportSummary): void {
    const revEl = document.getElementById('kpi-total-revenue');
    const compEl = document.getElementById('kpi-completed-orders');
    const tickEl = document.getElementById('kpi-average-ticket');
    const pendEl = document.getElementById('kpi-pending-orders');

    if (revEl) revEl.textContent = summary.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (compEl) compEl.textContent = summary.completedOrders.toString();
    if (tickEl) tickEl.textContent = summary.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (pendEl) pendEl.textContent = summary.pendingOrders.toString();
  }

  private renderTimelineChart(data: SalesByDate[]): void {
    const canvas = document.getElementById('chart-sales-timeline') as HTMLCanvasElement | null;
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    const labels = data.map(d => {
      const parts = d.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    const revenues = data.map(d => d.revenue);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Sem dados'],
        datasets: [{
          label: 'Faturamento (R$)',
          data: revenues.length > 0 ? revenues : [0],
          borderColor: '#b45309',
          backgroundColor: 'rgba(180, 83, 9, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#b45309',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `R$ ${Number(ctx.raw).toFixed(2)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val: any) => `R$ ${val}`
            }
          }
        }
      }
    });
  }

  private renderCategoriesChart(data: CategorySales[]): void {
    const canvas = document.getElementById('chart-categories-pie') as HTMLCanvasElement | null;
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.categoriesChart) {
      this.categoriesChart.destroy();
    }

    const labels = data.map(d => d.category_name);
    const totals = data.map(d => d.total_revenue);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.categoriesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['Sem dados'],
        datasets: [{
          data: totals.length > 0 ? totals : [1],
          backgroundColor: ['#b45309', '#d97706', '#059669', '#2563eb', '#7c3aed'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  private renderTopProductsTable(products: TopProduct[]): void {
    const tbody = document.getElementById('top-products-table-body');
    if (!tbody) return;

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-8 text-center text-gray-400">
            Nenhuma venda registrada para este período.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map((item, index) => {
      const formattedTotal = item.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const rankBadge = index === 0 
        ? '<span class="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs shadow-xs">1</span>'
        : index === 1
        ? '<span class="w-6 h-6 rounded-full bg-gray-300 text-gray-800 font-black flex items-center justify-center text-xs">2</span>'
        : index === 2
        ? '<span class="w-6 h-6 rounded-full bg-amber-700 text-white font-black flex items-center justify-center text-xs">3</span>'
        : `<span class="text-gray-400 font-semibold px-2">${index + 1}</span>`;

      return `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="px-6 py-3.5 whitespace-nowrap">${rankBadge}</td>
          <td class="px-6 py-3.5 whitespace-nowrap">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                <img src="${item.image_url}" alt="${item.product_name}" class="w-full h-full object-cover" onerror="this.src='/assets/padeiro/paes.png'">
              </div>
              <span class="font-bold text-gray-900">${item.product_name}</span>
            </div>
          </td>
          <td class="px-6 py-3.5 whitespace-nowrap text-xs font-semibold text-gray-500">
            ${item.category_name || '-'}
          </td>
          <td class="px-6 py-3.5 whitespace-nowrap text-center font-bold text-gray-900">
            ${item.total_quantity} un
          </td>
          <td class="px-6 py-3.5 whitespace-nowrap text-right font-black text-[#b45309]">
            ${formattedTotal}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  private notify(text: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    if (typeof Toastify === 'undefined') {
      alert(text);
      return;
    }

    let background = '#3b82f6';
    if (type === 'success') background = 'linear-gradient(to right, #059669, #10b981)';
    if (type === 'error') background = 'linear-gradient(to right, #dc2626, #ef4444)';
    if (type === 'warning') background = 'linear-gradient(to right, #d97706, #f59e0b)';

    Toastify({
      text,
      duration: 3000,
      close: false,
      gravity: 'top',
      position: 'right',
      style: { background, borderRadius: '8px', fontSize: '13px', fontWeight: '600' }
    }).showToast();
  }
}

// Inicializar na carga do documento com fallback defensivo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
  });
} else {
  new AdminDashboard();
}
