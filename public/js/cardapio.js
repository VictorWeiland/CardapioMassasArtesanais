"use strict";(()=>{var u=class{rawProducts=[];groupedProducts=[];cart=[];menuContainer=document.getElementById("menu-container");cartBtn=document.getElementById("cart-btn");cartModal=document.getElementById("cart-modal");cartItemsContainer=document.getElementById("cart-items");cartTotal=document.getElementById("cart-total");checkoutBtn=document.getElementById("checkout-btn");closeModalBtn=document.getElementById("close-modal-btn");cartCounter=document.getElementById("cart-count");addressInput=document.getElementById("address");addressWarn=document.getElementById("address-warn");customerNameInput=document.getElementById("customer-name");paymentSelect=document.getElementById("payment-method");dateSpan=document.getElementById("date-span");varModal=document.getElementById("variation-modal");varModalImg=document.getElementById("var-modal-img");varModalTitle=document.getElementById("var-modal-title");varModalDesc=document.getElementById("var-modal-desc");varModalCatBadge=document.getElementById("var-modal-cat-badge");varModalCartNotice=document.getElementById("var-modal-cart-notice");varModalCartNoticeText=document.getElementById("var-modal-cart-notice-text");varPortionsSection=document.getElementById("var-portions-section");varPortionsLabel=document.getElementById("var-portions-label");varOptionsContainer=document.getElementById("var-options-container");varFlavorsSection=document.getElementById("var-flavors-section");varFlavorsLabel=document.getElementById("var-flavors-label");varFlavorsContainer=document.getElementById("var-flavors-container");varQtyDisplay=document.getElementById("var-qty-display");varModalTotalDisplay=document.getElementById("var-modal-total-display");varQtyDecBtn=document.getElementById("var-qty-dec");varQtyIncBtn=document.getElementById("var-qty-inc");btnConfirmAddVar=document.getElementById("btn-confirm-add-var");btnCancelVarModal=document.getElementById("btn-cancel-var-modal");closeVarModalBtn=document.getElementById("close-var-modal-btn");currentModalProduct=null;currentSelectedVariation=null;currentSelectedFlavor=null;currentModalQty=1;constructor(){this.init()}async init(){this.loadCartFromStorage(),this.setupEventListeners(),this.setupVariationModalEvents(),this.checkRestaurantStatus(),await this.fetchProducts(),this.updateCartModal()}loadCartFromStorage(){try{let t=localStorage.getItem("devburger_cart");t&&(this.cart=JSON.parse(t))}catch{this.cart=[]}}saveCartToStorage(){try{localStorage.setItem("devburger_cart",JSON.stringify(this.cart))}catch(t){console.error("Erro ao salvar carrinho no localStorage",t)}}setupEventListeners(){this.cartBtn&&this.cartModal&&this.cartBtn.addEventListener("click",()=>{this.updateCartModal(),this.cartModal.classList.remove("hidden"),this.cartModal.style.display="flex"}),this.cartModal&&this.cartModal.addEventListener("click",t=>{t.target===this.cartModal&&this.closeCart()}),this.closeModalBtn&&this.closeModalBtn.addEventListener("click",()=>{this.closeCart()}),this.addressInput&&this.addressInput.addEventListener("input",()=>{this.addressInput.value.trim()!==""&&(this.addressInput.classList.remove("border-red-500"),this.addressWarn&&this.addressWarn.classList.add("hidden"))}),this.checkoutBtn&&this.checkoutBtn.addEventListener("click",()=>this.handleCheckout()),window.addEventListener("keydown",t=>{(t.ctrlKey||t.metaKey)&&t.shiftKey&&(t.key==="A"||t.key==="a")&&(t.preventDefault(),window.location.href="/admin")}),this.cartItemsContainer&&this.cartItemsContainer.addEventListener("click",t=>{let e=t.target,r=e.closest(".remove-from-cart-btn");if(r){let a=Number(r.getAttribute("data-id")),n=r.getAttribute("data-variation")||null,i=r.getAttribute("data-flavor")||null;this.removeItemCart(a,n,i)}let s=e.closest(".increase-qty-btn");if(s){let a=Number(s.getAttribute("data-id")),n=s.getAttribute("data-variation")||null,i=s.getAttribute("data-flavor")||null;this.increaseItemQty(a,n,i)}})}setupVariationModalEvents(){this.closeVarModalBtn?.addEventListener("click",()=>this.closeVariationModal()),this.btnCancelVarModal?.addEventListener("click",()=>this.closeVariationModal()),this.varModal?.addEventListener("click",t=>{t.target===this.varModal&&this.closeVariationModal()}),this.varQtyDecBtn?.addEventListener("click",()=>{this.currentModalQty>1&&(this.currentModalQty-=1,this.updateModalCalculation())}),this.varQtyIncBtn?.addEventListener("click",()=>{this.currentModalQty+=1,this.updateModalCalculation()}),this.btnConfirmAddVar?.addEventListener("click",()=>{this.currentSelectedVariation&&this.currentModalProduct&&(this.addToCart(this.currentSelectedVariation.id,this.currentModalProduct.baseName,this.currentSelectedVariation.variationName,this.currentSelectedVariation.price,this.currentModalQty,this.currentSelectedFlavor),this.closeVariationModal())})}closeCart(){this.cartModal&&(this.cartModal.classList.add("hidden"),this.cartModal.style.display="none")}closeVariationModal(){this.varModal&&(this.varModal.classList.add("hidden"),this.varModal.style.display="none"),this.currentModalProduct=null,this.currentSelectedVariation=null,this.currentSelectedFlavor=null}async fetchProducts(){try{this.menuContainer&&(this.menuContainer.innerHTML=`
          <div class="col-span-full py-16 text-center text-gray-500">
            <i class="fa fa-spinner fa-spin text-3xl mb-3 text-[#d97706]"></i>
            <p class="font-medium">Carregando as del\xEDcias do card\xE1pio artesanal...</p>
          </div>
        `);let t=await fetch(`/api/products?active=1&_t=${Date.now()}`);if(!t.ok)throw new Error("Erro ao carregar produtos");this.rawProducts=await t.json(),this.groupRawProducts(),this.renderMenu()}catch(t){console.error(t),this.menuContainer&&(this.menuContainer.innerHTML=`
          <div class="col-span-full py-16 text-center text-red-500">
            <i class="fa fa-exclamation-triangle text-3xl mb-3"></i>
            <p>N\xE3o foi poss\xEDvel carregar os produtos do card\xE1pio no momento.</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">Tentar novamente</button>
          </div>
        `)}}parsePriceStr(t,e){if(!t)return e;t=t.trim(),t.includes(",")&&t.includes(".")?t=t.replace(/\./g,"").replace(",","."):t.includes(",")&&(t=t.replace(",","."));let r=parseFloat(t);return isNaN(r)?e:r}groupRawProducts(){let t=new Map;this.rawProducts.forEach(e=>{let r=e.name.trim(),s=[];if(e.portion&&e.portion.trim()!=="")r=r.replace(/\s*\([^)]*\)$/,"").trim(),e.portion.split(",").map(l=>l.trim()).filter(Boolean).forEach(l=>{let d=l.match(/^(.*?):\s*(?:R\$\s*)?([\d.,]+)$/i),c=l.match(/^(.*?)\s*\((?:R\$\s*)?([\d.,]+)\)$/i),m=l.match(/^(.*?)\s*-\s*(?:R\$\s*)?([\d.,]+)$/i);d?s.push({name:d[1].trim(),price:this.parsePriceStr(d[2],e.price)}):c?s.push({name:c[1].trim(),price:this.parsePriceStr(c[2],e.price)}):m?s.push({name:m[1].trim(),price:this.parsePriceStr(m[2],e.price)}):s.push({name:l,price:e.price})});else{let o=e.name.match(/^(.*?)\s*\((.*?)\)$/);o?(r=o[1].trim(),s.push({name:o[2].trim(),price:e.price})):s.push({name:"Padr\xE3o",price:e.price})}let a=`${e.category_id}__${r.toLowerCase()}`,n=[];e.flavors&&e.flavors.trim()!==""&&e.flavors.split(",").map(o=>o.trim()).filter(Boolean).forEach(o=>{n.includes(o)||n.push(o)}),t.has(a)||t.set(a,{baseName:r,category_id:e.category_id,category_name:e.category_name,category_slug:e.category_slug,description:e.description||"",image_url:e.image_url,minPrice:e.price,maxPrice:e.price,flavorsList:[...n],variations:[]});let i=t.get(a);n.forEach(o=>{i.flavorsList.includes(o)||i.flavorsList.push(o)}),s.forEach(o=>{i.variations.some(d=>d.variationName===o.name)||(i.variations.push({id:e.id,variationName:o.name,fullName:o.name!=="Padr\xE3o"?`${r} (${o.name})`:r,price:o.price,description:e.description,image_url:e.image_url,flavors:e.flavors}),o.price<i.minPrice&&(i.minPrice=o.price),o.price>i.maxPrice&&(i.maxPrice=o.price))})}),t.forEach(e=>{e.variations.sort((r,s)=>r.price-s.price)}),this.groupedProducts=Array.from(t.values())}renderMenu(){if(!this.menuContainer)return;if(this.groupedProducts.length===0){this.menuContainer.innerHTML=`
        <div class="col-span-full py-16 text-center text-gray-500">
          <p class="text-lg">Nenhum produto cadastrado no momento.</p>
        </div>
      `;return}let t={};this.groupedProducts.forEach(s=>{let a=s.category_slug||(s.category_name?s.category_name.toLowerCase():"outros"),n=s.category_name||"Outros";t[a]||(t[a]={name:n,products:[]}),t[a].products.push(s)});let e="",r=Object.keys(t).sort((s,a)=>{let n=["massas-tradicionais","selecao-de-nhoques","padaria-artesanal","pizzas-e-salgados"],i=n.indexOf(s),o=n.indexOf(a);return i!==-1&&o!==-1?i-o:i!==-1?-1:o!==-1?1:s.localeCompare(a)});for(let s of r){let a=t[s];e+=`
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
      `}this.menuContainer.innerHTML=e,this.attachCardEventListeners()}renderProductCard(t){let e=t.variations.length>1,r=!!(t.flavorsList&&t.flavorsList.length>0),s=e||r,a=this.cart.filter(d=>t.variations.some(c=>c.id===d.id)),n=a.reduce((d,c)=>d+c.quantity,0),i="";e?t.minPrice===t.maxPrice?i=t.minPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):i=`A partir de ${t.minPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`:i=t.variations[0].price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});let o="";if(n>0){let d=a.map(c=>{let m=[];return c.variationName!=="Padr\xE3o"&&m.push(c.variationName),c.flavor&&m.push(c.flavor),`${c.quantity}x ${m.join(" - ")}`}).join(", ");o=`
        <div class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full mt-1.5 shadow-xs">
          <i class="fa fa-check-circle text-emerald-600"></i>
          <span>${n} na cesta</span>
          ${d?`<span class="font-medium text-emerald-700">(${d})</span>`:""}
        </div>
      `}let l="";if(s){let d="Escolher Op\xE7\xF5es",c="fa-sliders";e&&r?(d="Escolher Op\xE7\xF5es",c="fa-sliders"):e?(d="Escolher Por\xE7\xE3o",c="fa-sliders"):r&&(d="Escolher Sabor",c="fa-utensils"),l=`
        <button 
          class="btn-open-variation bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
          data-base-name="${t.baseName}"
          data-category-id="${t.category_id}"
        >
          <span>${d}</span>
          <i class="fa ${c} text-xs"></i>
        </button>
      `}else{let d=t.variations[0];n>0?l=`
            <button 
              class="card-quick-dec px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${d.id}" 
              data-variation-name="${d.variationName}"
              title="Diminuir"
            >
              -
            </button>
            <span class="px-2 font-black text-xs text-[#b45309]">${n}</span>
            <button 
              class="card-quick-inc px-2.5 py-1 text-amber-900 hover:bg-amber-100 font-black text-xs transition" 
              data-id="${d.id}" 
              data-variation-name="${d.variationName}"
              title="Aumentar"
            >
              +
            </button>
          </div>
        `:l=`
          <button 
            class="btn-add-direct bg-[#b45309] hover:bg-[#92400e] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            data-id="${d.id}"
            data-base-name="${t.baseName}"
            data-variation-name="${d.variationName}"
            data-price="${d.price}"
          >
            <span>Pedir</span>
            <i class="fa fa-plus text-xs"></i>
          </button>
        `}return`
      <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-amber-100 flex gap-4 items-center group relative ${n>0?"ring-2 ring-[#d97706]/40":""}">
        
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
            ${e?`
              <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <i class="fa fa-scale-balanced text-[9px] text-[#b45309]"></i>
                  <span>${t.variations.length} tamanhos: ${t.variations.map(d=>d.variationName).join(", ")}</span>
                </span>
              </div>
            `:""}
            ${r?`
              <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <i class="fa fa-utensils text-[9px] text-[#b45309]"></i>
                  <span>${t.flavorsList.length} op\xE7\xF5es: ${t.flavorsList.join(", ")}</span>
                </span>
              </div>
            `:""}
            ${o}
          </div>

          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-amber-50">
            <div>
              <span class="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                ${e?"Op\xE7\xF5es de Peso/Qtd":r?"Op\xE7\xF5es de Sabores":"Pre\xE7o"}
              </span>
              <span class="font-extrabold text-base md:text-lg text-[#b45309] leading-tight">
                ${i}
              </span>
            </div>

            <div>
              ${l}
            </div>
          </div>
        </div>

      </div>
    `}attachCardEventListeners(){this.menuContainer.querySelectorAll(".btn-open-variation").forEach(a=>{a.addEventListener("click",()=>{let n=a.getAttribute("data-base-name")||"",i=Number(a.getAttribute("data-category-id")),o=this.groupedProducts.find(l=>l.baseName===n&&l.category_id===i);o&&this.openVariationModal(o)})}),this.menuContainer.querySelectorAll(".btn-add-direct").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id")),i=a.getAttribute("data-base-name")||"",o=a.getAttribute("data-variation-name")||"Padr\xE3o",l=parseFloat(a.getAttribute("data-price")||"0");this.addToCart(n,i,o,l,1)})}),this.menuContainer.querySelectorAll(".card-quick-inc").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id")),i=a.getAttribute("data-variation-name")||"Padr\xE3o";this.increaseItemQty(n,i)})}),this.menuContainer.querySelectorAll(".card-quick-dec").forEach(a=>{a.addEventListener("click",()=>{let n=Number(a.getAttribute("data-id")),i=a.getAttribute("data-variation-name")||"Padr\xE3o";this.removeItemCart(n,i)})})}openVariationModal(t){this.currentModalProduct=t,this.currentModalQty=1,this.currentSelectedVariation=t.variations[0],this.currentSelectedFlavor=t.flavorsList&&t.flavorsList.length>0?t.flavorsList[0]:null,this.varModalImg&&(this.varModalImg.src=t.image_url),this.varModalTitle&&(this.varModalTitle.textContent=t.baseName),this.varModalDesc&&(this.varModalDesc.textContent=t.description),this.varModalCatBadge&&(this.varModalCatBadge.textContent=t.category_name||"Massa Artesanal");let e=this.cart.filter(a=>t.variations.some(n=>n.id===a.id));if(e.length>0){let a=e.map(n=>{let i=[];return n.variationName!=="Padr\xE3o"&&i.push(n.variationName),n.flavor&&i.push(n.flavor),`${n.quantity}x ${i.join(" - ")}`}).join(", ");this.varModalCartNoticeText&&(this.varModalCartNoticeText.innerHTML=`Voc\xEA j\xE1 possui <strong>${a}</strong> adicionado na sua cesta.`),this.varModalCartNotice?.classList.remove("hidden")}else this.varModalCartNotice?.classList.add("hidden");let r=t.variations.length>1,s=!!(t.flavorsList&&t.flavorsList.length>0);r&&s?(this.varPortionsSection&&this.varPortionsSection.classList.remove("hidden"),this.varPortionsLabel&&(this.varPortionsLabel.textContent="1. Selecione a por\xE7\xE3o / tamanho:"),this.varFlavorsSection&&this.varFlavorsSection.classList.remove("hidden"),this.varFlavorsLabel&&(this.varFlavorsLabel.textContent="2. Selecione o sabor / recheio:")):r?(this.varPortionsSection&&this.varPortionsSection.classList.remove("hidden"),this.varPortionsLabel&&(this.varPortionsLabel.textContent="Selecione a por\xE7\xE3o / tamanho:"),this.varFlavorsSection&&this.varFlavorsSection.classList.add("hidden")):s?(this.varPortionsSection&&this.varPortionsSection.classList.add("hidden"),this.varFlavorsSection&&this.varFlavorsSection.classList.remove("hidden"),this.varFlavorsLabel&&(this.varFlavorsLabel.textContent="Selecione o sabor / recheio:")):(this.varPortionsSection&&this.varPortionsSection.classList.add("hidden"),this.varFlavorsSection&&this.varFlavorsSection.classList.add("hidden")),r&&this.renderVariationOptions(),s&&this.renderFlavorOptions(),this.updateModalCalculation(),this.varModal&&(this.varModal.classList.remove("hidden"),this.varModal.style.display="flex")}renderVariationOptions(){!this.varOptionsContainer||!this.currentModalProduct||(this.varOptionsContainer.innerHTML=this.currentModalProduct.variations.map((t,e)=>{let r=this.currentSelectedVariation?.variationName===t.variationName,s=t.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),a=this.cart.find(i=>i.id===t.id&&(i.variationName||"Padr\xE3o")===(t.variationName||"Padr\xE3o")&&(!this.currentSelectedFlavor||i.flavor===this.currentSelectedFlavor)),n=a?`<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">${a.quantity} j\xE1 na cesta</span>`:"";return`
        <label 
          class="var-option-card flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${r?"border-[#b45309] bg-amber-50/60 shadow-xs ring-1 ring-[#b45309]":"border-gray-200 hover:border-amber-300 bg-white"}"
          data-index="${e}"
        >
          <div class="flex items-center gap-3">
            <input 
              type="radio" 
              name="product-variation-choice" 
              value="${e}" 
              ${r?"checked":""} 
              class="w-4 h-4 text-[#b45309] focus:ring-[#b45309]"
            />
            <div>
              <span class="font-extrabold text-sm text-[#2a1d17]">${t.variationName}</span>
              <div class="mt-0.5">${n}</div>
            </div>
          </div>

          <div class="text-right">
            <span class="font-black text-base text-[#b45309]">${s}</span>
          </div>
        </label>
      `}).join(""),this.varOptionsContainer.querySelectorAll(".var-option-card").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-index")),r=this.currentModalProduct?.variations[e];r&&(this.currentSelectedVariation=r,this.renderVariationOptions(),this.renderFlavorOptions(),this.updateModalCalculation())})}))}renderFlavorOptions(){if(!this.varFlavorsContainer||!this.currentModalProduct)return;let t=this.currentModalProduct.flavorsList;if(!t||t.length===0){this.varFlavorsContainer.innerHTML="";return}this.varFlavorsContainer.innerHTML=t.map(e=>{let r=this.currentSelectedFlavor===e,s=this.cart.find(n=>this.currentModalProduct.variations.some(i=>i.id===n.id)&&(!this.currentSelectedVariation||(n.variationName||"Padr\xE3o")===(this.currentSelectedVariation.variationName||"Padr\xE3o"))&&n.flavor===e),a=s?`<span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">${s.quantity} na cesta</span>`:"";return`
        <label 
          class="flavor-option-card flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${r?"border-[#b45309] bg-amber-50/70 shadow-xs ring-1 ring-[#b45309]":"border-gray-200 hover:border-amber-300 bg-white"}"
          data-flavor="${e}"
        >
          <div class="flex items-center gap-2.5">
            <input 
              type="radio" 
              name="product-flavor-choice" 
              value="${e}" 
              ${r?"checked":""} 
              class="w-4 h-4 text-[#b45309] focus:ring-[#b45309]"
            />
            <span class="font-bold text-xs md:text-sm text-[#2a1d17]">${e}</span>
          </div>
          ${a}
        </label>
      `}).join(""),this.varFlavorsContainer.querySelectorAll(".flavor-option-card").forEach(e=>{e.addEventListener("click",()=>{let r=e.getAttribute("data-flavor");r&&(this.currentSelectedFlavor=r,this.renderFlavorOptions(),this.renderVariationOptions())})})}updateModalCalculation(){if(this.varQtyDisplay&&(this.varQtyDisplay.textContent=this.currentModalQty.toString()),this.currentSelectedVariation&&this.varModalTotalDisplay){let t=this.currentSelectedVariation.price*this.currentModalQty;this.varModalTotalDisplay.textContent=t.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}}addToCart(t,e,r,s,a=1,n=null){let i=n&&n.trim()!==""?n.trim():null,o=r&&r.trim()!==""?r.trim():"Padr\xE3o",l=this.cart.find(d=>d.id===t&&(d.variationName||"Padr\xE3o")===o&&(d.flavor||null)===i);if(l)l.quantity+=a;else{let d=[];o!=="Padr\xE3o"&&d.push(o),i&&d.push(i);let c=d.length>0?`${e} (${d.join(" - ")})`:e;this.cart.push({id:t,name:c,baseName:e,variationName:o,flavor:i||void 0,price:s,quantity:a})}this.saveCartToStorage(),this.updateCartModal(),this.renderMenu(),this.showBottomRightNotification(e,o,a,i)}showBottomRightNotification(t,e,r,s=null){let a=[];e&&e!=="Padr\xE3o"&&a.push(e),s&&a.push(s);let n=a.length>0?` (${a.join(" - ")})`:"",i=`<strong>${r}x ${t}</strong>${n}`;typeof Toastify<"u"&&Toastify({text:`\u{1F9FA} ${i} adicionado ao carrinho!`,escapeMarkup:!1,duration:3500,close:!0,gravity:"bottom",position:"right",stopOnFocus:!0,style:{background:"linear-gradient(135deg, #241a15 0%, #3e2b20 100%)",borderLeft:"5px solid #d97706",boxShadow:"0 10px 25px -5px rgba(0, 0, 0, 0.4)",borderRadius:"14px",padding:"14px 20px",color:"#fef3c7",fontSize:"14px",fontWeight:"600",cursor:"pointer"},onClick:()=>{this.cartBtn?.click()}}).showToast()}updateCartModal(){if(!this.cartItemsContainer||!this.cartTotal||!this.cartCounter)return;this.cartItemsContainer.innerHTML="";let t=0,e=0;this.cart.length===0?this.cartItemsContainer.innerHTML=`
        <div class="text-center py-10 text-gray-400">
          <i class="fa fa-basket-shopping text-5xl mb-3 text-amber-200"></i>
          <p class="font-bold text-gray-700 text-base">Sua cesta est\xE1 vazia.</p>
          <p class="text-xs text-gray-400 mt-1">Escolha massas frescas e p\xE3es artesanais no card\xE1pio!</p>
        </div>
      `:this.cart.forEach(r=>{let s=r.price*r.quantity;t+=s,e+=r.quantity;let a=document.createElement("div");a.className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0",a.innerHTML=`
          <div class="flex-1 pr-3">
            <p class="font-extrabold text-[#2a1d17] text-sm md:text-base leading-snug">${r.name}</p>
            <p class="text-xs text-gray-400 mt-0.5">Unit\xE1rio: R$ ${r.price.toFixed(2)}</p>
            <p class="font-black text-[#b45309] text-sm mt-0.5">Subtotal: R$ ${s.toFixed(2)}</p>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-xs">
              <button 
                class="remove-from-cart-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${r.id}"
                data-variation="${r.variationName||"Padr\xE3o"}"
                data-flavor="${r.flavor||""}"
                title="Diminuir"
              >
                -
              </button>
              <span class="px-2.5 font-black text-xs text-gray-900">${r.quantity}</span>
              <button 
                class="increase-qty-btn px-2.5 py-1 text-gray-700 hover:bg-amber-100 transition text-sm font-black" 
                data-id="${r.id}"
                data-variation="${r.variationName||"Padr\xE3o"}"
                data-flavor="${r.flavor||""}"
                title="Aumentar"
              >
                +
              </button>
            </div>
          </div>
        `,this.cartItemsContainer.appendChild(a)}),this.cartTotal.textContent=t.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),this.cartCounter.textContent=e.toString()}removeItemCart(t,e,r){let s=e&&e.trim()!==""?e.trim():"Padr\xE3o",a=r&&r.trim()!==""?r.trim():null,n=this.cart.findIndex(i=>i.id===t&&(i.variationName||"Padr\xE3o")===s&&(i.flavor||null)===a);if(n!==-1){let i=this.cart[n];i.quantity>1?i.quantity-=1:this.cart.splice(n,1),this.saveCartToStorage(),this.updateCartModal(),this.renderMenu()}}increaseItemQty(t,e,r){let s=e&&e.trim()!==""?e.trim():"Padr\xE3o",a=r&&r.trim()!==""?r.trim():null,n=this.cart.find(i=>i.id===t&&(i.variationName||"Padr\xE3o")===s&&(i.flavor||null)===a);n&&(n.quantity+=1,this.saveCartToStorage(),this.updateCartModal(),this.renderMenu())}async handleCheckout(){if(this.cart.length===0){alert("Sua cesta est\xE1 vazia! Adicione produtos antes de finalizar.");return}let t=this.addressInput?this.addressInput.value.trim():"";if(!t){this.addressWarn&&this.addressWarn.classList.remove("hidden"),this.addressInput&&(this.addressInput.classList.add("border-red-500"),this.addressInput.focus());return}let e=this.customerNameInput&&this.customerNameInput.value.trim()!==""?this.customerNameInput.value.trim():"Cliente",r=this.paymentSelect?this.paymentSelect.value:"Pix",s={customer_name:e,customer_phone:"",delivery_address:t,payment_method:r,items:this.cart.map(a=>({product_id:a.id,product_name:a.name,unit_price:a.price,quantity:a.quantity}))};try{this.checkoutBtn.disabled=!0,this.checkoutBtn.textContent="Processando Pedido...";let a=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!a.ok)throw new Error("Erro ao salvar pedido no sistema");let n=await a.json(),i=this.cart.map(m=>`*${m.quantity}x* ${m.name} (R$ ${(m.price*m.quantity).toFixed(2)})`).join(`
`),o=this.cart.reduce((m,v)=>m+v.price*v.quantity,0),l=`\u{1F35D} *NOVO PEDIDO - MASSAS & P\xC3ES ARTESANAIS (#${n.id})*
\u{1F956} *Padeiro - Sabores Feitos com Amor e Tradi\xE7\xE3o*

\u{1F464} *Cliente:* ${e}
\u{1F4CD} *Endere\xE7o/Retirada:* ${t}
\u{1F4B3} *Pagamento:* ${r}

\u{1F6D2} *Itens Selecionados:*
${i}

\u{1F4B0} *Total:* R$ ${o.toFixed(2)}

Agradecemos pela prefer\xEAncia! Aguardamos a confirma\xE7\xE3o.`,d=encodeURIComponent(l);window.open(`https://wa.me/5511970345627?text=${d}`,"_blank"),this.cart=[],this.saveCartToStorage(),this.updateCartModal(),this.renderMenu(),this.closeCart(),this.addressInput&&(this.addressInput.value=""),typeof Toastify<"u"&&Toastify({text:`\u{1F389} Pedido #${n.id} enviado com sucesso e registrado no sistema!`,duration:5e3,close:!0,gravity:"bottom",position:"right",style:{background:"linear-gradient(to right, #059669, #10b981)",fontSize:"14px",fontWeight:"bold",borderRadius:"12px",boxShadow:"0 10px 25px -5px rgba(0,0,0,0.4)"}}).showToast()}catch(a){console.error(a),alert("Houve uma falha ao registrar o pedido no banco de dados. Tente novamente.")}finally{this.checkoutBtn.disabled=!1,this.checkoutBtn.textContent="Enviar Pedido pelo WhatsApp"}}checkRestaurantStatus(){this.dateSpan&&(this.dateSpan.innerHTML=`
      <i class="fa fa-circle text-[10px] text-emerald-300 animate-pulse"></i>
      <span>Aberto para Pedidos e Encomendas</span>
    `)}};document.addEventListener("DOMContentLoaded",()=>{new u});})();
