"use strict";(()=>{var l=class{rawProducts=[];groupedProducts=[];cart=[];menuContainer=document.getElementById("menu-container");cartBtn=document.getElementById("cart-btn");cartModal=document.getElementById("cart-modal");cartItemsContainer=document.getElementById("cart-items");cartTotal=document.getElementById("cart-total");checkoutBtn=document.getElementById("checkout-btn");closeModalBtn=document.getElementById("close-modal-btn");cartCounter=document.getElementById("cart-count");addressInput=document.getElementById("address");addressWarn=document.getElementById("address-warn");customerNameInput=document.getElementById("customer-name");paymentSelect=document.getElementById("payment-method");dateSpan=document.getElementById("date-span");varModal=document.getElementById("variation-modal");varModalImg=document.getElementById("var-modal-img");varModalTitle=document.getElementById("var-modal-title");varModalDesc=document.getElementById("var-modal-desc");varModalCatBadge=document.getElementById("var-modal-cat-badge");varModalCartNotice=document.getElementById("var-modal-cart-notice");varModalCartNoticeText=document.getElementById("var-modal-cart-notice-text");varOptionsContainer=document.getElementById("var-options-container");varQtyDisplay=document.getElementById("var-qty-display");varModalTotalDisplay=document.getElementById("var-modal-total-display");varQtyDecBtn=document.getElementById("var-qty-dec");varQtyIncBtn=document.getElementById("var-qty-inc");btnConfirmAddVar=document.getElementById("btn-confirm-add-var");btnCancelVarModal=document.getElementById("btn-cancel-var-modal");closeVarModalBtn=document.getElementById("close-var-modal-btn");currentModalProduct=null;currentSelectedVariation=null;currentModalQty=1;constructor(){this.init()}async init(){this.loadCartFromStorage(),this.setupEventListeners(),this.setupVariationModalEvents(),this.checkRestaurantStatus(),await this.fetchProducts(),this.updateCartModal()}loadCartFromStorage(){try{let t=localStorage.getItem("devburger_cart");t&&(this.cart=JSON.parse(t))}catch{this.cart=[]}}saveCartToStorage(){try{localStorage.setItem("devburger_cart",JSON.stringify(this.cart))}catch(t){console.error("Erro ao salvar carrinho no localStorage",t)}}setupEventListeners(){this.cartBtn&&this.cartModal&&this.cartBtn.addEventListener("click",()=>{this.updateCartModal(),this.cartModal.classList.remove("hidden"),this.cartModal.style.display="flex"}),this.cartModal&&this.cartModal.addEventListener("click",t=>{t.target===this.cartModal&&this.closeCart()}),this.closeModalBtn&&this.closeModalBtn.addEventListener("click",()=>{this.closeCart()}),this.addressInput&&this.addressInput.addEventListener("input",()=>{this.addressInput.value.trim()!==""&&(this.addressInput.classList.remove("border-red-500"),this.addressWarn&&this.addressWarn.classList.add("hidden"))}),this.checkoutBtn&&this.checkoutBtn.addEventListener("click",()=>this.handleCheckout()),window.addEventListener("keydown",t=>{(t.ctrlKey||t.metaKey)&&t.shiftKey&&(t.key==="A"||t.key==="a")&&(t.preventDefault(),window.location.href="/admin")}),this.cartItemsContainer&&this.cartItemsContainer.addEventListener("click",t=>{let e=t.target,r=e.closest(".remove-from-cart-btn");if(r){let a=Number(r.getAttribute("data-id"));this.removeItemCart(a)}let i=e.closest(".increase-qty-btn");if(i){let a=Number(i.getAttribute("data-id"));this.increaseItemQty(a)}})}setupVariationModalEvents(){this.closeVarModalBtn?.addEventListener("click",()=>this.closeVariationModal()),this.btnCancelVarModal?.addEventListener("click",()=>this.closeVariationModal()),this.varModal?.addEventListener("click",t=>{t.target===this.varModal&&this.closeVariationModal()}),this.varQtyDecBtn?.addEventListener("click",()=>{this.currentModalQty>1&&(this.currentModalQty-=1,this.updateModalCalculation())}),this.varQtyIncBtn?.addEventListener("click",()=>{this.currentModalQty+=1,this.updateModalCalculation()}),this.btnConfirmAddVar?.addEventListener("click",()=>{this.currentSelectedVariation&&this.currentModalProduct&&(this.addToCart(this.currentSelectedVariation.id,this.currentModalProduct.baseName,this.currentSelectedVariation.variationName,this.currentSelectedVariation.price,this.currentModalQty),this.closeVariationModal())})}closeCart(){this.cartModal&&(this.cartModal.classList.add("hidden"),this.cartModal.style.display="none")}closeVariationModal(){this.varModal&&(this.varModal.classList.add("hidden"),this.varModal.style.display="none"),this.currentModalProduct=null,this.currentSelectedVariation=null}async fetchProducts(){try{this.menuContainer&&(this.menuContainer.innerHTML=`
          <div class="col-span-full py-16 text-center text-gray-500">
            <i class="fa fa-spinner fa-spin text-3xl mb-3 text-[#d97706]"></i>
            <p class="font-medium">Carregando as del\xEDcias do card\xE1pio artesanal...</p>
          </div>
        `);let t=await fetch("/api/products?active=1");if(!t.ok)throw new Error("Erro ao carregar produtos");this.rawProducts=await t.json(),this.groupRawProducts(),this.renderMenu()}catch(t){console.error(t),this.menuContainer&&(this.menuContainer.innerHTML=`
          <div class="col-span-full py-16 text-center text-red-500">
            <i class="fa fa-exclamation-triangle text-3xl mb-3"></i>
            <p>N\xE3o foi poss\xEDvel carregar os produtos do card\xE1pio no momento.</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">Tentar novamente</button>
          </div>
        `)}}groupRawProducts(){let t=new Map;this.rawProducts.forEach(e=>{let r=e.name.trim(),i="Padr\xE3o";if(e.portion&&e.portion.trim()!=="")i=e.portion.trim(),r=r.replace(/\s*\([^)]*\)$/,"").trim();else{let s=e.name.match(/^(.*?)\s*\((.*?)\)$/);s&&(r=s[1].trim(),i=s[2].trim())}let a=`${e.category_id}__${r.toLowerCase()}`;t.has(a)||t.set(a,{baseName:r,category_id:e.category_id,category_name:e.category_name,category_slug:e.category_slug,description:e.description||"",image_url:e.image_url,minPrice:e.price,maxPrice:e.price,variations:[]});let n=t.get(a);n.variations.push({id:e.id,variationName:i,fullName:e.name,price:e.price,description:e.description,image_url:e.image_url}),e.price<n.minPrice&&(n.minPrice=e.price),e.price>n.maxPrice&&(n.maxPrice=e.price)}),t.forEach(e=>{e.variations.sort((r,i)=>r.price-i.price)}),this.groupedProducts=Array.from(t.values())}renderMenu(){if(!this.menuContainer)return;if(this.groupedProducts.length===0){this.menuContainer.innerHTML=`
        <div class="col-span-full py-16 text-center text-gray-500">
          <p class="text-lg">Nenhum produto cadastrado no momento.</p>
        </div>
      `;return}let t={};this.groupedProducts.forEach(i=>{let a=i.category_slug||(i.category_name?i.category_name.toLowerCase():"outros"),n=i.category_name||"Outros";t[a]||(t[a]={name:n,products:[]}),t[a].products.push(i)});let e="",r=Object.keys(t).sort((i,a)=>{let n=["massas-tradicionais","selecao-de-nhoques","padaria-artesanal","pizzas-e-salgados"],s=n.indexOf(i),o=n.indexOf(a);return s!==-1&&o!==-1?s-o:s!==-1?-1:o!==-1?1:i.localeCompare(a)});for(let i of r){let a=t[i];e+=`
        <div class="w-full mb-14">
          <div class="border-b-2 border-amber-200/60 pb-3 mb-6 flex items-center justify-between">
            <h3 class="text-2xl md:text-3xl font-extrabold text-[#2a1d17] tracking-tight flex items-center gap-2 font-serif-title">
              <span class="inline-block w-2.5 h-8 bg-[#d97706] rounded-full mr-1 shadow-sm"></span>
              ${a.name}
            </h3>
            <span class="text-xs font-extrabold text-amber-900 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              ${a.products.length} ${a.products.length===1?"prato":"op\xE7\xF5es"}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-8">
            ${a.products.map(n=>this.renderProductCard(n)).join("")}
          </div>
        </div>
      `}this.menuContainer.innerHTML=e,this.attachCardEventListeners()}renderProductCard(t){let e=t.variations.length>1,r=this.cart.filter(o=>t.variations.some(d=>d.id===o.id)),i=r.reduce((o,d)=>o+d.quantity,0),a="";e?t.minPrice===t.maxPrice?a=t.minPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):a=`A partir de ${t.minPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`:a=t.variations[0].price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});let n="";if(i>0){let o=r.map(d=>`${d.quantity}x ${d.variationName!=="Padr\xE3o"?d.variationName:""}`).join(", ");n=`
        <div class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full mt-1.5 shadow-xs">
          <i class="fa fa-check-circle text-emerald-600"></i>
          <span>${i} na cesta</span>
          ${e?`<span class="font-medium text-emerald-700">(${o})</span>`:""}
        </div>
      `}let s="";if(e)s=`
        <button 
          class="btn-open-variation bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
          data-base-name="${t.baseName}"
          data-category-id="${t.category_id}"
        >
          <span>Escolher Por\xE7\xE3o</span>
          <i class="fa fa-sliders text-xs"></i>
        </button>
      `;else{let o=t.variations[0];i>0?s=`
          <div class="flex items-center border border-amber-400 rounded-xl overflow-hidden bg-white shadow-sm">
            <button 
              class="card-quick-dec px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${o.id}" 
              title="Diminuir"
            >
              -
            </button>
            <span class="px-2 font-black text-xs text-[#b45309]">${i}</span>
            <button 
              class="card-quick-inc px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${o.id}" 
              title="Aumentar"
            >
              +
            </button>
          </div>
        `:s=`
          <button 
            class="btn-add-direct bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            data-id="${o.id}"
            data-base-name="${t.baseName}"
            data-variation-name="${o.variationName}"
            data-price="${o.price}"
          >
            <span>Pedir</span>
            <i class="fa fa-plus text-xs"></i>
          </button>
        `}return`
      <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-amber-100 flex gap-4 items-center group relative ${i>0?"ring-2 ring-[#d97706]/40":""}">
        
        <!-- Foto do Prato -->
        <div class="relative overflow-hidden rounded-xl w-28 h-28 md:w-32 md:h-32 flex-shrink-0 bg-stone-100 border border-amber-100 flex items-center justify-center">
          <img 
            src="${t.image_url}" 
            alt="${t.baseName}"
            class="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
            onerror="this.src='/assets/padeiro/paes.png'"
          />
        </div>

        <!-- Conte\xFAdo -->
        <div class="flex-1 flex flex-col justify-between h-full min-w-0">
          <div>
            <h4 class="font-extrabold text-[#2a1d17] text-base md:text-lg leading-snug font-serif-title">
              ${t.baseName}
            </h4>
            <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              ${t.description||"Preparado com ingredientes selecionados e amor artesanal."}
            </p>
            ${n}
          </div>

          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-amber-50">
            <div>
              <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                ${e?"Op\xE7\xF5es de Peso/Qtd":"Pre\xE7o"}
              </span>
              <span class="font-extrabold text-base md:text-lg text-[#b45309] leading-tight">
                ${a}
              </span>
            </div>

            <div>
              ${s}
            </div>
          </div>
        </div>

      </div>
    `}attachCardEventListeners(){this.menuContainer.querySelectorAll(".btn-open-variation").forEach(a=>{a.addEventListener("click",()=>{let n=a.getAttribute("data-base-name")||"",s=Number(a.getAttribute("data-category-id")),o=this.groupedProducts.find(d=>d.baseName===n&&d.category_id===s);o&&this.openVariationModal(o)})}),this.menuContainer.querySelectorAll(".btn-add-direct").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id")),s=a.getAttribute("data-base-name")||"",o=a.getAttribute("data-variation-name")||"Padr\xE3o",d=parseFloat(a.getAttribute("data-price")||"0");this.addToCart(n,s,o,d,1)})}),this.menuContainer.querySelectorAll(".card-quick-inc").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id"));this.increaseItemQty(n)})}),this.menuContainer.querySelectorAll(".card-quick-dec").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id"));this.removeItemCart(n)})})}openVariationModal(t){this.currentModalProduct=t,this.currentModalQty=1,this.currentSelectedVariation=t.variations[0],this.varModalImg&&(this.varModalImg.src=t.image_url),this.varModalTitle&&(this.varModalTitle.textContent=t.baseName),this.varModalDesc&&(this.varModalDesc.textContent=t.description),this.varModalCatBadge&&(this.varModalCatBadge.textContent=t.category_name||"Massa Artesanal");let e=this.cart.filter(r=>t.variations.some(i=>i.id===r.id));if(e.length>0){let r=e.map(i=>`${i.quantity}x ${i.variationName}`).join(", ");this.varModalCartNoticeText&&(this.varModalCartNoticeText.innerHTML=`Voc\xEA j\xE1 possui <strong>${r}</strong> adicionado na sua cesta.`),this.varModalCartNotice?.classList.remove("hidden")}else this.varModalCartNotice?.classList.add("hidden");this.renderVariationOptions(),this.updateModalCalculation(),this.varModal&&(this.varModal.classList.remove("hidden"),this.varModal.style.display="flex")}renderVariationOptions(){!this.varOptionsContainer||!this.currentModalProduct||(this.varOptionsContainer.innerHTML=this.currentModalProduct.variations.map((t,e)=>{let r=this.currentSelectedVariation?.id===t.id,i=t.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),a=this.cart.find(s=>s.id===t.id),n=a?`<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">${a.quantity} j\xE1 na cesta</span>`:"";return`
        <label 
          class="var-option-card flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${r?"border-[#b45309] bg-amber-50/60 shadow-xs ring-1 ring-[#b45309]":"border-gray-200 hover:border-amber-300 bg-white"}"
          data-id="${t.id}"
        >
          <div class="flex items-center gap-3">
            <input 
              type="radio" 
              name="product-variation-choice" 
              value="${t.id}" 
              ${r?"checked":""} 
              class="w-4 h-4 text-[#b45309] focus:ring-[#b45309]"
            />
            <div>
              <span class="font-extrabold text-sm text-[#2a1d17]">${t.variationName}</span>
              <div class="mt-0.5">${n}</div>
            </div>
          </div>

          <div class="text-right">
            <span class="font-black text-base text-[#b45309]">${i}</span>
          </div>
        </label>
      `}).join(""),this.varOptionsContainer.querySelectorAll(".var-option-card").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-id")),r=this.currentModalProduct?.variations.find(i=>i.id===e);r&&(this.currentSelectedVariation=r,this.renderVariationOptions(),this.updateModalCalculation())})}))}updateModalCalculation(){if(this.varQtyDisplay&&(this.varQtyDisplay.textContent=this.currentModalQty.toString()),this.currentSelectedVariation&&this.varModalTotalDisplay){let t=this.currentSelectedVariation.price*this.currentModalQty;this.varModalTotalDisplay.textContent=t.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}}addToCart(t,e,r,i,a=1){let n=this.cart.find(s=>s.id===t);if(n)n.quantity+=a;else{let s=r&&r!=="Padr\xE3o"?`${e} (${r})`:e;this.cart.push({id:t,name:s,baseName:e,variationName:r,price:i,quantity:a})}this.saveCartToStorage(),this.updateCartModal(),this.renderMenu(),this.showBottomRightNotification(e,r,a)}showBottomRightNotification(t,e,r){let i=e&&e!=="Padr\xE3o"?`<strong>${r}x ${t}</strong> (${e})`:`<strong>${r}x ${t}</strong>`;typeof Toastify<"u"&&Toastify({text:`\u{1F9FA} ${i} adicionado ao carrinho!`,escapeMarkup:!1,duration:3500,close:!0,gravity:"bottom",position:"right",stopOnFocus:!0,style:{background:"linear-gradient(135deg, #241a15 0%, #3e2b20 100%)",borderLeft:"5px solid #d97706",boxShadow:"0 10px 25px -5px rgba(0, 0, 0, 0.4)",borderRadius:"14px",padding:"14px 20px",color:"#fef3c7",fontSize:"14px",fontWeight:"600",cursor:"pointer"},onClick:()=>{this.cartBtn?.click()}}).showToast()}updateCartModal(){if(!this.cartItemsContainer||!this.cartTotal||!this.cartCounter)return;this.cartItemsContainer.innerHTML="";let t=0,e=0;this.cart.length===0?this.cartItemsContainer.innerHTML=`
        <div class="text-center py-10 text-gray-400">
          <i class="fa fa-basket-shopping text-5xl mb-3 text-amber-200"></i>
          <p class="font-bold text-gray-700 text-base">Sua cesta est\xE1 vazia.</p>
          <p class="text-xs text-gray-400 mt-1">Escolha massas frescas e p\xE3es artesanais no card\xE1pio!</p>
        </div>
      `:this.cart.forEach(r=>{let i=r.price*r.quantity;t+=i,e+=r.quantity;let a=document.createElement("div");a.className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0",a.innerHTML=`
          <div class="flex-1 pr-3">
            <p class="font-extrabold text-[#2a1d17] text-sm md:text-base leading-snug">${r.name}</p>
            <p class="text-xs text-gray-400 mt-0.5">Unit\xE1rio: R$ ${r.price.toFixed(2)}</p>
            <p class="font-black text-[#b45309] text-sm mt-0.5">Subtotal: R$ ${i.toFixed(2)}</p>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-xs">
              <button 
                class="remove-from-cart-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${r.id}"
                title="Diminuir"
              >
                -
              </button>
              <span class="px-2.5 font-black text-xs text-gray-900">${r.quantity}</span>
              <button 
                class="increase-qty-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${r.id}"
                title="Aumentar"
              >
                +
              </button>
            </div>
          </div>
        `,this.cartItemsContainer.appendChild(a)}),this.cartTotal.textContent=t.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),this.cartCounter.textContent=e.toString()}removeItemCart(t){let e=this.cart.findIndex(r=>r.id===t);if(e!==-1){let r=this.cart[e];r.quantity>1?r.quantity-=1:this.cart.splice(e,1),this.saveCartToStorage(),this.updateCartModal(),this.renderMenu()}}increaseItemQty(t){let e=this.cart.find(r=>r.id===t);e&&(e.quantity+=1,this.saveCartToStorage(),this.updateCartModal(),this.renderMenu())}async handleCheckout(){if(this.cart.length===0){alert("Sua cesta est\xE1 vazia! Adicione produtos antes de finalizar.");return}let t=this.addressInput?this.addressInput.value.trim():"";if(!t){this.addressWarn&&this.addressWarn.classList.remove("hidden"),this.addressInput&&(this.addressInput.classList.add("border-red-500"),this.addressInput.focus());return}let e=this.customerNameInput&&this.customerNameInput.value.trim()!==""?this.customerNameInput.value.trim():"Cliente",r=this.paymentSelect?this.paymentSelect.value:"Pix",i={customer_name:e,customer_phone:"",delivery_address:t,payment_method:r,items:this.cart.map(a=>({product_id:a.id,product_name:a.name,unit_price:a.price,quantity:a.quantity}))};try{this.checkoutBtn.disabled=!0,this.checkoutBtn.textContent="Processando Pedido...";let a=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!a.ok)throw new Error("Erro ao salvar pedido no sistema");let n=await a.json(),s=this.cart.map(c=>`*${c.quantity}x* ${c.name} (R$ ${(c.price*c.quantity).toFixed(2)})`).join(`
`),o=this.cart.reduce((c,u)=>c+u.price*u.quantity,0),d=`\u{1F35D} *NOVO PEDIDO - MASSAS & P\xC3ES ARTESANAIS (#${n.id})*
\u{1F956} *Padeiro - Sabores Feitos com Amor e Tradi\xE7\xE3o*

\u{1F464} *Cliente:* ${e}
\u{1F4CD} *Endere\xE7o/Retirada:* ${t}
\u{1F4B3} *Pagamento:* ${r}

\u{1F6D2} *Itens Selecionados:*
${s}

\u{1F4B0} *Total:* R$ ${o.toFixed(2)}

Agradecemos pela prefer\xEAncia! Aguardamos a confirma\xE7\xE3o.`,m=encodeURIComponent(d);window.open(`https://wa.me/11970345627?text=${m}`,"_blank"),this.cart=[],this.saveCartToStorage(),this.updateCartModal(),this.renderMenu(),this.closeCart(),this.addressInput&&(this.addressInput.value=""),typeof Toastify<"u"&&Toastify({text:`\u{1F389} Pedido #${n.id} enviado com sucesso e registrado no sistema!`,duration:5e3,close:!0,gravity:"bottom",position:"right",style:{background:"linear-gradient(to right, #059669, #10b981)",fontSize:"14px",fontWeight:"bold",borderRadius:"12px",boxShadow:"0 10px 25px -5px rgba(0,0,0,0.4)"}}).showToast()}catch(a){console.error(a),alert("Houve uma falha ao registrar o pedido no banco de dados. Tente novamente.")}finally{this.checkoutBtn.disabled=!1,this.checkoutBtn.textContent="Enviar Pedido pelo WhatsApp"}}checkRestaurantStatus(){this.dateSpan&&(this.dateSpan.innerHTML=`
      <i class="fa fa-circle text-[10px] text-emerald-300 animate-pulse"></i>
      <span>Aberto para Pedidos e Encomendas</span>
    `)}};document.addEventListener("DOMContentLoaded",()=>{new l});})();
