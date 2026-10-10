// TypeScript client for Padeiro - Massas & Pães Artesanais

interface RawProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  portion?: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  image_url: string;
  active: number;
}

interface ProductVariation {
  id: number;
  variationName: string;
  fullName: string;
  price: number;
  description: string;
  image_url: string;
}

interface GroupedProduct {
  baseName: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  description: string;
  image_url: string;
  minPrice: number;
  maxPrice: number;
  variations: ProductVariation[];
}

interface CartItem {
  id: number;
  name: string;
  baseName: string;
  variationName: string;
  price: number;
  quantity: number;
}

declare const Toastify: any;

class CardapioApp {
  private rawProducts: RawProduct[] = [];
  private groupedProducts: GroupedProduct[] = [];
  private cart: CartItem[] = [];

  // DOM Elements
  private menuContainer = document.getElementById("menu-container") as HTMLElement;
  private cartBtn = document.getElementById("cart-btn") as HTMLElement;
  private cartModal = document.getElementById("cart-modal") as HTMLElement;
  private cartItemsContainer = document.getElementById("cart-items") as HTMLElement;
  private cartTotal = document.getElementById("cart-total") as HTMLElement;
  private checkoutBtn = document.getElementById("checkout-btn") as HTMLButtonElement;
  private closeModalBtn = document.getElementById("close-modal-btn") as HTMLButtonElement;
  private cartCounter = document.getElementById("cart-count") as HTMLElement;
  private addressInput = document.getElementById("address") as HTMLInputElement;
  private addressWarn = document.getElementById("address-warn") as HTMLElement;
  private customerNameInput = document.getElementById("customer-name") as HTMLInputElement | null;
  private paymentSelect = document.getElementById("payment-method") as HTMLSelectElement | null;
  private dateSpan = document.getElementById("date-span") as HTMLElement | null;

  // Variation Modal Elements
  private varModal = document.getElementById("variation-modal") as HTMLElement;
  private varModalImg = document.getElementById("var-modal-img") as HTMLImageElement;
  private varModalTitle = document.getElementById("var-modal-title") as HTMLElement;
  private varModalDesc = document.getElementById("var-modal-desc") as HTMLElement;
  private varModalCatBadge = document.getElementById("var-modal-cat-badge") as HTMLElement;
  private varModalCartNotice = document.getElementById("var-modal-cart-notice") as HTMLElement;
  private varModalCartNoticeText = document.getElementById("var-modal-cart-notice-text") as HTMLElement;
  private varOptionsContainer = document.getElementById("var-options-container") as HTMLElement;
  private varQtyDisplay = document.getElementById("var-qty-display") as HTMLElement;
  private varModalTotalDisplay = document.getElementById("var-modal-total-display") as HTMLElement;
  private varQtyDecBtn = document.getElementById("var-qty-dec") as HTMLButtonElement;
  private varQtyIncBtn = document.getElementById("var-qty-inc") as HTMLButtonElement;
  private btnConfirmAddVar = document.getElementById("btn-confirm-add-var") as HTMLButtonElement;
  private btnCancelVarModal = document.getElementById("btn-cancel-var-modal") as HTMLButtonElement;
  private closeVarModalBtn = document.getElementById("close-var-modal-btn") as HTMLButtonElement;

  // Current Variation Modal State
  private currentModalProduct: GroupedProduct | null = null;
  private currentSelectedVariation: ProductVariation | null = null;
  private currentModalQty: number = 1;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.loadCartFromStorage();
    this.setupEventListeners();
    this.setupVariationModalEvents();
    this.checkRestaurantStatus();
    await this.fetchProducts();
    this.updateCartModal();
  }

  private loadCartFromStorage(): void {
    try {
      const saved = localStorage.getItem("devburger_cart");
      if (saved) {
        this.cart = JSON.parse(saved);
      }
    } catch (e) {
      this.cart = [];
    }
  }

  private saveCartToStorage(): void {
    try {
      localStorage.setItem("devburger_cart", JSON.stringify(this.cart));
    } catch (e) {
      console.error("Erro ao salvar carrinho no localStorage", e);
    }
  }

  private setupEventListeners(): void {
    // Abrir modal do carrinho
    if (this.cartBtn && this.cartModal) {
      this.cartBtn.addEventListener("click", () => {
        this.updateCartModal();
        this.cartModal.classList.remove("hidden");
        this.cartModal.style.display = "flex";
      });
    }

    // Fechar ao clicar fora
    if (this.cartModal) {
      this.cartModal.addEventListener("click", (event) => {
        if (event.target === this.cartModal) {
          this.closeCart();
        }
      });
    }

    // Fechar botao
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener("click", () => {
        this.closeCart();
      });
    }

    // Input de endereco
    if (this.addressInput) {
      this.addressInput.addEventListener("input", () => {
        if (this.addressInput.value.trim() !== "") {
          this.addressInput.classList.remove("border-red-500");
          if (this.addressWarn) this.addressWarn.classList.add("hidden");
        }
      });
    }

    // Finalizar pedido
    if (this.checkoutBtn) {
      this.checkoutBtn.addEventListener("click", () => this.handleCheckout());
    }

    // Atalho secreto do administrador: Ctrl + Shift + A
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        window.location.href = "/admin";
      }
    });

    // Event delegation para remocao de itens no carrinho
    if (this.cartItemsContainer) {
      this.cartItemsContainer.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const removeBtn = target.closest(".remove-from-cart-btn") as HTMLElement;
        if (removeBtn) {
          const id = Number(removeBtn.getAttribute("data-id"));
          this.removeItemCart(id);
        }

        const addQtyBtn = target.closest(".increase-qty-btn") as HTMLElement;
        if (addQtyBtn) {
          const id = Number(addQtyBtn.getAttribute("data-id"));
          this.increaseItemQty(id);
        }
      });
    }
  }

  private setupVariationModalEvents(): void {
    this.closeVarModalBtn?.addEventListener("click", () => this.closeVariationModal());
    this.btnCancelVarModal?.addEventListener("click", () => this.closeVariationModal());

    this.varModal?.addEventListener("click", (e) => {
      if (e.target === this.varModal) {
        this.closeVariationModal();
      }
    });

    this.varQtyDecBtn?.addEventListener("click", () => {
      if (this.currentModalQty > 1) {
        this.currentModalQty -= 1;
        this.updateModalCalculation();
      }
    });

    this.varQtyIncBtn?.addEventListener("click", () => {
      this.currentModalQty += 1;
      this.updateModalCalculation();
    });

    this.btnConfirmAddVar?.addEventListener("click", () => {
      if (this.currentSelectedVariation && this.currentModalProduct) {
        this.addToCart(
          this.currentSelectedVariation.id,
          this.currentModalProduct.baseName,
          this.currentSelectedVariation.variationName,
          this.currentSelectedVariation.price,
          this.currentModalQty
        );
        this.closeVariationModal();
      }
    });
  }

  private closeCart(): void {
    if (this.cartModal) {
      this.cartModal.classList.add("hidden");
      this.cartModal.style.display = "none";
    }
  }

  private closeVariationModal(): void {
    if (this.varModal) {
      this.varModal.classList.add("hidden");
      this.varModal.style.display = "none";
    }
    this.currentModalProduct = null;
    this.currentSelectedVariation = null;
  }

  private async fetchProducts(): Promise<void> {
    try {
      if (this.menuContainer) {
        this.menuContainer.innerHTML = `
          <div class="col-span-full py-16 text-center text-gray-500">
            <i class="fa fa-spinner fa-spin text-3xl mb-3 text-[#d97706]"></i>
            <p class="font-medium">Carregando as delícias do cardápio artesanal...</p>
          </div>
        `;
      }

      const res = await fetch("/api/products?active=1");
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      this.rawProducts = await res.json();
      this.groupRawProducts();
      this.renderMenu();
    } catch (error) {
      console.error(error);
      if (this.menuContainer) {
        this.menuContainer.innerHTML = `
          <div class="col-span-full py-16 text-center text-red-500">
            <i class="fa fa-exclamation-triangle text-3xl mb-3"></i>
            <p>Não foi possível carregar os produtos do cardápio no momento.</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">Tentar novamente</button>
          </div>
        `;
      }
    }
  }

  /**
   * Agrupa produtos que possuem o mesmo nome base (ex: Panqueca Caseira com 5 un ou 2 un; Rondelli com 600g ou 300g)
   */
  private groupRawProducts(): void {
    const map = new Map<string, GroupedProduct>();

    this.rawProducts.forEach(prod => {
      let baseName = prod.name.trim();
      let variationName = "Padrão";

      if (prod.portion && prod.portion.trim() !== '') {
        variationName = prod.portion.trim();
        baseName = baseName.replace(/\s*\([^)]*\)$/, '').trim();
      } else {
        const match = prod.name.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          baseName = match[1].trim();
          variationName = match[2].trim();
        }
      }

      const key = `${prod.category_id}__${baseName.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          baseName,
          category_id: prod.category_id,
          category_name: prod.category_name,
          category_slug: prod.category_slug,
          description: prod.description || "",
          image_url: prod.image_url,
          minPrice: prod.price,
          maxPrice: prod.price,
          variations: []
        });
      }

      const group = map.get(key)!;
      group.variations.push({
        id: prod.id,
        variationName,
        fullName: prod.name,
        price: prod.price,
        description: prod.description,
        image_url: prod.image_url
      });

      if (prod.price < group.minPrice) group.minPrice = prod.price;
      if (prod.price > group.maxPrice) group.maxPrice = prod.price;
    });

    // Ordenar variações (menor porção/preço primeiro)
    map.forEach(group => {
      group.variations.sort((a, b) => a.price - b.price);
    });

    this.groupedProducts = Array.from(map.values());
  }

  private renderMenu(): void {
    if (!this.menuContainer) return;

    if (this.groupedProducts.length === 0) {
      this.menuContainer.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500">
          <p class="text-lg">Nenhum produto cadastrado no momento.</p>
        </div>
      `;
      return;
    }

    // Agrupar produtos agrupados por categoria
    const categoriesMap: { [key: string]: { name: string; products: GroupedProduct[] } } = {};

    this.groupedProducts.forEach(p => {
      const catKey = p.category_slug || (p.category_name ? p.category_name.toLowerCase() : 'outros');
      const catName = p.category_name || 'Outros';

      if (!categoriesMap[catKey]) {
        categoriesMap[catKey] = {
          name: catName,
          products: []
        };
      }
      categoriesMap[catKey].products.push(p);
    });

    let html = "";

    // Ordenar categorias segundo a ordem oficial do PDF
    const categoryKeys = Object.keys(categoriesMap).sort((a, b) => {
      const order = ['massas-tradicionais', 'selecao-de-nhoques', 'padaria-artesanal', 'pizzas-e-salgados'];
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const key of categoryKeys) {
      const group = categoriesMap[key];
      html += `
        <div class="w-full mb-14">
          <div class="border-b-2 border-amber-200/60 pb-3 mb-6 flex items-center justify-between">
            <h3 class="text-2xl md:text-3xl font-extrabold text-[#2a1d17] tracking-tight flex items-center gap-2 font-serif-title">
              <span class="inline-block w-2.5 h-8 bg-[#d97706] rounded-full mr-1 shadow-sm"></span>
              ${group.name}
            </h3>
            <span class="text-xs font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              ${group.products.length} ${group.products.length === 1 ? 'prato' : 'opções'}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8">
            ${group.products.map(product => this.renderProductCard(product)).join("")}
          </div>
        </div>
      `;
    }

    this.menuContainer.innerHTML = html;
    this.attachCardEventListeners();
  }

  private renderProductCard(product: GroupedProduct): string {
    const hasMultipleVariations = product.variations.length > 1;

    // Calcular quantidade deste prato no carrinho
    const itemsInCartForThisGroup = this.cart.filter(item => 
      product.variations.some(v => v.id === item.id)
    );
    const totalQtyInCart = itemsInCartForThisGroup.reduce((sum, item) => sum + item.quantity, 0);

    // Formatar preco
    let priceText = "";
    if (hasMultipleVariations) {
      if (product.minPrice === product.maxPrice) {
        priceText = product.minPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      } else {
        priceText = `A partir de ${product.minPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      }
    } else {
      priceText = product.variations[0].price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    // Badge com detalhamento se já estiver no carrinho
    let cartBadgeHtml = "";
    if (totalQtyInCart > 0) {
      const breakdownText = itemsInCartForThisGroup
        .map(i => `${i.quantity}x ${i.variationName !== "Padrão" ? i.variationName : ""}`)
        .join(", ");

      cartBadgeHtml = `
        <div class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full mt-1.5 shadow-xs">
          <i class="fa fa-check-circle text-emerald-600"></i>
          <span>${totalQtyInCart} na cesta</span>
          ${hasMultipleVariations ? `<span class="font-medium text-emerald-700">(${breakdownText})</span>` : ""}
        </div>
      `;
    }

    // Botão de Ação
    let actionButtonHtml = "";
    if (hasMultipleVariations) {
      actionButtonHtml = `
        <button 
          class="btn-open-variation bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
          data-base-name="${product.baseName}"
          data-category-id="${product.category_id}"
        >
          <span>Escolher Porção</span>
          <i class="fa fa-sliders text-xs"></i>
        </button>
      `;
    } else {
      const singleVar = product.variations[0];
      if (totalQtyInCart > 0) {
        // Se já está no carrinho e tem 1 variação, dá controle direto de diminuir e aumentar no próprio card
        actionButtonHtml = `
          <div class="flex items-center border border-amber-400 rounded-xl overflow-hidden bg-white shadow-sm">
            <button 
              class="card-quick-dec px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${singleVar.id}" 
              title="Diminuir"
            >
              -
            </button>
            <span class="px-2 font-black text-xs text-[#b45309]">${totalQtyInCart}</span>
            <button 
              class="card-quick-inc px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${singleVar.id}" 
              title="Aumentar"
            >
              +
            </button>
          </div>
        `;
      } else {
        actionButtonHtml = `
          <button 
            class="btn-add-direct bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            data-id="${singleVar.id}"
            data-base-name="${product.baseName}"
            data-variation-name="${singleVar.variationName}"
            data-price="${singleVar.price}"
          >
            <span>Pedir</span>
            <i class="fa fa-plus text-xs"></i>
          </button>
        `;
      }
    }

    return `
      <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-amber-100 flex gap-4 items-center group relative ${totalQtyInCart > 0 ? 'ring-2 ring-[#d97706]/40' : ''}">
        
        <!-- Foto do Prato -->
        <div class="relative overflow-hidden rounded-xl w-28 h-28 md:w-32 md:h-32 flex-shrink-0 bg-stone-100 border border-amber-100 flex items-center justify-center">
          <img 
            src="${product.image_url}" 
            alt="${product.baseName}"
            class="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
            onerror="this.src='/assets/padeiro/paes.png'"
          />
        </div>

        <!-- Conteúdo -->
        <div class="flex-1 flex flex-col justify-between h-full min-w-0">
          <div>
            <h4 class="font-extrabold text-[#2a1d17] text-base md:text-lg leading-snug font-serif-title">
              ${product.baseName}
            </h4>
            <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              ${product.description || 'Preparado com ingredientes selecionados e amor artesanal.'}
            </p>
            ${cartBadgeHtml}
          </div>

          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-amber-50">
            <div>
              <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                ${hasMultipleVariations ? 'Opções de Peso/Qtd' : 'Preço'}
              </span>
              <span class="font-extrabold text-base md:text-lg text-[#b45309] leading-tight">
                ${priceText}
              </span>
            </div>

            <div>
              ${actionButtonHtml}
            </div>
          </div>
        </div>

      </div>
    `;
  }

  private attachCardEventListeners(): void {
    // Botão "Escolher Porção" abre o modal de variações
    const chooseBtns = this.menuContainer.querySelectorAll(".btn-open-variation");
    chooseBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const baseName = btn.getAttribute("data-base-name") || "";
        const catId = Number(btn.getAttribute("data-category-id"));
        const product = this.groupedProducts.find(p => p.baseName === baseName && p.category_id === catId);
        if (product) {
          this.openVariationModal(product);
        }
      });
    });

    // Botão "Pedir" direto (para produtos sem variação de porção)
    const addDirectBtns = this.menuContainer.querySelectorAll(".btn-add-direct");
    addDirectBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const baseName = btn.getAttribute("data-base-name") || "";
        const varName = btn.getAttribute("data-variation-name") || "Padrão";
        const price = parseFloat(btn.getAttribute("data-price") || "0");
        this.addToCart(id, baseName, varName, price, 1);
      });
    });

    // Botões diretos + e - no card (para pratos de 1 variação já na cesta)
    const quickIncBtns = this.menuContainer.querySelectorAll(".card-quick-inc");
    quickIncBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        this.increaseItemQty(id);
      });
    });

    const quickDecBtns = this.menuContainer.querySelectorAll(".card-quick-dec");
    quickDecBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        this.removeItemCart(id);
      });
    });
  }

  /**
   * Abre o Modal de Variações de Porção / Peso
   */
  private openVariationModal(product: GroupedProduct): void {
    this.currentModalProduct = product;
    this.currentModalQty = 1;
    this.currentSelectedVariation = product.variations[0]; // seleciona o primeiro por padrão

    if (this.varModalImg) this.varModalImg.src = product.image_url;
    if (this.varModalTitle) this.varModalTitle.textContent = product.baseName;
    if (this.varModalDesc) this.varModalDesc.textContent = product.description;
    if (this.varModalCatBadge) this.varModalCatBadge.textContent = product.category_name || "Massa Artesanal";

    // Indicador se já tem algo na cesta
    const itemsInCartForThisGroup = this.cart.filter(item => 
      product.variations.some(v => v.id === item.id)
    );
    if (itemsInCartForThisGroup.length > 0) {
      const summary = itemsInCartForThisGroup.map(i => `${i.quantity}x ${i.variationName}`).join(", ");
      if (this.varModalCartNoticeText) {
        this.varModalCartNoticeText.innerHTML = `Você já possui <strong>${summary}</strong> adicionado na sua cesta.`;
      }
      this.varModalCartNotice?.classList.remove("hidden");
    } else {
      this.varModalCartNotice?.classList.add("hidden");
    }

    // Renderizar Opções de Variação (Pills com Radio)
    this.renderVariationOptions();
    this.updateModalCalculation();

    // Abrir Modal
    if (this.varModal) {
      this.varModal.classList.remove("hidden");
      this.varModal.style.display = "flex";
    }
  }

  private renderVariationOptions(): void {
    if (!this.varOptionsContainer || !this.currentModalProduct) return;

    this.varOptionsContainer.innerHTML = this.currentModalProduct.variations.map((v, index) => {
      const isSelected = this.currentSelectedVariation?.id === v.id;
      const formattedPrice = v.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      // Verificar se essa variação específica já está no carrinho
      const cartItem = this.cart.find(i => i.id === v.id);
      const inCartNotice = cartItem ? `<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">${cartItem.quantity} já na cesta</span>` : '';

      return `
        <label 
          class="var-option-card flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#b45309] bg-amber-50/60 shadow-xs ring-1 ring-[#b45309]' : 'border-gray-200 hover:border-amber-300 bg-white'}"
          data-id="${v.id}"
        >
          <div class="flex items-center gap-3">
            <input 
              type="radio" 
              name="product-variation-choice" 
              value="${v.id}" 
              ${isSelected ? 'checked' : ''} 
              class="w-4 h-4 text-[#b45309] focus:ring-[#b45309]"
            />
            <div>
              <span class="font-extrabold text-sm text-[#2a1d17]">${v.variationName}</span>
              <div class="mt-0.5">${inCartNotice}</div>
            </div>
          </div>

          <div class="text-right">
            <span class="font-black text-base text-[#b45309]">${formattedPrice}</span>
          </div>
        </label>
      `;
    }).join("");

    // Adicionar eventos de clique nos cards de opção
    this.varOptionsContainer.querySelectorAll(".var-option-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = Number(card.getAttribute("data-id"));
        const chosen = this.currentModalProduct?.variations.find(v => v.id === id);
        if (chosen) {
          this.currentSelectedVariation = chosen;
          this.renderVariationOptions();
          this.updateModalCalculation();
        }
      });
    });
  }

  private updateModalCalculation(): void {
    if (this.varQtyDisplay) this.varQtyDisplay.textContent = this.currentModalQty.toString();

    if (this.currentSelectedVariation && this.varModalTotalDisplay) {
      const subtotal = this.currentSelectedVariation.price * this.currentModalQty;
      this.varModalTotalDisplay.textContent = subtotal.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }
  }

  /**
   * Adiciona o produto ao carrinho e aciona a NOTIFICAÇÃO NO CANTO INFERIOR DIREITO
   */
  private addToCart(id: number, baseName: string, variationName: string, price: number, quantity: number = 1): void {
    const existing = this.cart.find(item => item.id === id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      const displayName = variationName && variationName !== "Padrão" 
        ? `${baseName} (${variationName})` 
        : baseName;

      this.cart.push({
        id,
        name: displayName,
        baseName,
        variationName,
        price,
        quantity
      });
    }

    this.saveCartToStorage();
    this.updateCartModal();
    this.renderMenu(); // Atualiza os badges de quantidade nos cards em tempo real!

    // NOTIFICAÇÃO NO CANTO INFERIOR DIREITO (gravity: bottom, position: right)
    this.showBottomRightNotification(baseName, variationName, quantity);
  }

  private showBottomRightNotification(baseName: string, variationName: string, quantity: number): void {
    const itemLabel = variationName && variationName !== "Padrão" 
      ? `<strong>${quantity}x ${baseName}</strong> (${variationName})` 
      : `<strong>${quantity}x ${baseName}</strong>`;

    if (typeof Toastify !== "undefined") {
      Toastify({
        text: `🧺 ${itemLabel} adicionado ao carrinho!`,
        escapeMarkup: false,
        duration: 3500,
        close: true,
        gravity: "bottom", // Canto inferior
        position: "right", // Canto direito
        stopOnFocus: true,
        style: {
          background: "linear-gradient(135deg, #241a15 0%, #3e2b20 100%)",
          borderLeft: "5px solid #d97706",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
          borderRadius: "14px",
          padding: "14px 20px",
          color: "#fef3c7",
          fontSize: "14px",
          fontWeight: "600",
          cursor: "pointer"
        },
        onClick: () => {
          this.cartBtn?.click();
        }
      }).showToast();
    }
  }

  private updateCartModal(): void {
    if (!this.cartItemsContainer || !this.cartTotal || !this.cartCounter) return;

    this.cartItemsContainer.innerHTML = "";
    let total = 0;
    let totalQuantity = 0;

    if (this.cart.length === 0) {
      this.cartItemsContainer.innerHTML = `
        <div class="text-center py-10 text-gray-400">
          <i class="fa fa-basket-shopping text-5xl mb-3 text-amber-200"></i>
          <p class="font-bold text-gray-700 text-base">Sua cesta está vazia.</p>
          <p class="text-xs text-gray-400 mt-1">Escolha massas frescas e pães artesanais no cardápio!</p>
        </div>
      `;
    } else {
      this.cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalQuantity += item.quantity;

        const cartItemEl = document.createElement("div");
        cartItemEl.className = "flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0";
        cartItemEl.innerHTML = `
          <div class="flex-1 pr-3">
            <p class="font-extrabold text-[#2a1d17] text-sm md:text-base leading-snug">${item.name}</p>
            <p class="text-xs text-gray-400 mt-0.5">Unitário: R$ ${item.price.toFixed(2)}</p>
            <p class="font-black text-[#b45309] text-sm mt-0.5">Subtotal: R$ ${itemTotal.toFixed(2)}</p>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-xs">
              <button 
                class="remove-from-cart-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${item.id}"
                title="Diminuir"
              >
                -
              </button>
              <span class="px-2.5 font-black text-xs text-gray-900">${item.quantity}</span>
              <button 
                class="increase-qty-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${item.id}"
                title="Aumentar"
              >
                +
              </button>
            </div>
          </div>
        `;
        this.cartItemsContainer.appendChild(cartItemEl);
      });
    }

    this.cartTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

    this.cartCounter.textContent = totalQuantity.toString();
  }

  private removeItemCart(id: number): void {
    const index = this.cart.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.cart[index];
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        this.cart.splice(index, 1);
      }
      this.saveCartToStorage();
      this.updateCartModal();
      this.renderMenu(); // Atualiza em tempo real a quantidade visível nos cards
    }
  }

  private increaseItemQty(id: number): void {
    const item = this.cart.find(i => i.id === id);
    if (item) {
      item.quantity += 1;
      this.saveCartToStorage();
      this.updateCartModal();
      this.renderMenu(); // Atualiza em tempo real a quantidade visível nos cards
    }
  }

  private async handleCheckout(): Promise<void> {
    if (this.cart.length === 0) {
      alert("Sua cesta está vazia! Adicione produtos antes de finalizar.");
      return;
    }

    const address = this.addressInput ? this.addressInput.value.trim() : "";
    if (!address) {
      if (this.addressWarn) this.addressWarn.classList.remove("hidden");
      if (this.addressInput) {
        this.addressInput.classList.add("border-red-500");
        this.addressInput.focus();
      }
      return;
    }

    const customerName = this.customerNameInput && this.customerNameInput.value.trim() !== "" 
      ? this.customerNameInput.value.trim() 
      : "Cliente";
    
    const paymentMethod = this.paymentSelect ? this.paymentSelect.value : "Pix";

    // Preparar payload para o banco de dados
    const orderPayload = {
      customer_name: customerName,
      customer_phone: "",
      delivery_address: address,
      payment_method: paymentMethod,
      items: this.cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        unit_price: item.price,
        quantity: item.quantity
      }))
    };

    try {
      this.checkoutBtn.disabled = true;
      this.checkoutBtn.textContent = "Processando Pedido...";

      // Registrar pedido no banco de dados SQLite
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar pedido no sistema");
      }

      const createdOrder = await response.json();

      // Formatar mensagem do WhatsApp
      const itemsList = this.cart
        .map(item => `*${item.quantity}x* ${item.name} (R$ ${(item.price * item.quantity).toFixed(2)})`)
        .join("\n");

      const totalVal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const messageText = 
        `🍝 *NOVO PEDIDO - MASSAS & PÃES ARTESANAIS (#${createdOrder.id})*\n` +
        `🥖 *Padeiro - Sabores Feitos com Amor e Tradição*\n\n` +
        `👤 *Cliente:* ${customerName}\n` +
        `📍 *Endereço/Retirada:* ${address}\n` +
        `💳 *Pagamento:* ${paymentMethod}\n\n` +
        `🛒 *Itens Selecionados:*\n${itemsList}\n\n` +
        `💰 *Total:* R$ ${totalVal.toFixed(2)}\n\n` +
        `Agradecemos pela preferência! Aguardamos a confirmação.`;

      const encodedMessage = encodeURIComponent(messageText);
      const phone = "11970345627";

      // Abrir WhatsApp com o número oficial do catálogo
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, "_blank");

      // Limpar cesta
      this.cart = [];
      this.saveCartToStorage();
      this.updateCartModal();
      this.renderMenu();
      this.closeCart();
      if (this.addressInput) this.addressInput.value = "";

      if (typeof Toastify !== "undefined") {
        Toastify({
          text: `🎉 Pedido #${createdOrder.id} enviado com sucesso e registrado no sistema!`,
          duration: 5000,
          close: true,
          gravity: "bottom",
          position: "right",
          style: {
            background: "linear-gradient(to right, #059669, #10b981)",
            fontSize: "14px",
            fontWeight: "bold",
            borderRadius: "12px",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)"
          }
        }).showToast();
      }
    } catch (error: any) {
      console.error(error);
      alert("Houve uma falha ao registrar o pedido no banco de dados. Tente novamente.");
    } finally {
      this.checkoutBtn.disabled = false;
      this.checkoutBtn.textContent = "Enviar Pedido pelo WhatsApp";
    }
  }

  private checkRestaurantStatus(): void {
    if (!this.dateSpan) return;
    this.dateSpan.innerHTML = `
      <i class="fa fa-circle text-[10px] text-emerald-300 animate-pulse"></i>
      <span>Aberto para Pedidos e Encomendas</span>
    `;
  }
}

// Inicializar na carga do documento
document.addEventListener("DOMContentLoaded", () => {
  new CardapioApp();
});
