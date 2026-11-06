(async function () {
    const IMAGES_BASE_PATH = "/lojista/app_produtos"; // ajuste se precisar

    const container = document.querySelector('div[data-include="components/list-products/"]');
    if (!container) return;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const safeHttpUrl = value => {
        try {
            const raw = String(value || '').trim();
            if (!raw) return '';
            const candidate = /^(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$)/i.test(raw) ? `https://${raw}` : raw;
            const url = new URL(candidate, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    };
    const safeExternalUrl = value => {
        try {
            const raw = String(value || '').trim();
            if (!raw) return '';
            const hasHttpScheme = /^https?:\/\//i.test(raw);
            const isBareDomain = /^(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$)/i.test(raw);
            if (!hasHttpScheme && !isBareDomain) return '';
            const url = new URL(hasHttpScheme ? raw : `https://${raw}`);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    };

    // ==========================
    // SERVICE: dados + variações
    // ==========================
    class ProductService {
        constructor(apiBaseUrl) {
            this.apiBaseUrl = apiBaseUrl;
            this.products = [];
            this.variations = [];
            this.variationsBySku = {};
        }

        static skuKey(value) {
            return String(value || "").trim().toUpperCase();
        }

        async loadProducts() {
            const response = await fetch(this.apiBaseUrl);
            if (!response.ok) {
                throw new Error(`Falha ao carregar produtos: HTTP ${response.status}`);
            }
            this.products = await response.json();
        }

        async loadVariations() {
            const response = await fetch(this.apiBaseUrl + "?tipo=variacoes");
            if (!response.ok) {
                throw new Error(`Falha ao carregar variações: HTTP ${response.status}`);
            }
            this.variations = await response.json();
            this.buildVariationMap();
        }

        buildVariationMap() {
            this.variationsBySku = {};

            if (!Array.isArray(this.variations)) {
                console.warn("Variações não vieram como array:", this.variations);
                return;
            }

            this.variations.forEach(v => {
                const key = ProductService.skuKey(v.COD_SKU_PAI);
                const variacaoNome = String(v.VARIACAO || "").trim();

                // só conta se tiver SKU pai + nome de variação
                if (!key || !variacaoNome) return;

                if (!this.variationsBySku[key]) {
                    this.variationsBySku[key] = [];
                }
                this.variationsBySku[key].push(v);
            });

        }

        getVariationsForProduct(product) {
            const key = ProductService.skuKey(product.COD_SKU_PAI);
            return this.variationsBySku[key] || [];
        }
    }

    // ==========================
    // UI: filtros, tabela, detalhes, modal
    // ==========================
    class ProductUI {
        constructor(container, service, imagesBasePath) {
            this.container = container;
            this.service = service;
            this.imagesBasePath = imagesBasePath;

            this.tableBody = null;
            this.detailsCard = null;
            this.filterCategory = null;
            this.filterSubcategory = null;
            this.filterSearch = null;
            this.filterPriceMin = null;
            this.filterPriceMax = null;

            this.filteredIndexes = [];
            this.selectedRow = null;

            // elementos de modal
            this.modal = null;
            this.modalImg = null;
            this.modalClose = null;

            // bind de métodos usados em eventos
            this.applyFilters = this.applyFilters.bind(this);
            this.renderTable = this.renderTable.bind(this);
            this.attachRowListeners = this.attachRowListeners.bind(this);
        }

        normalize(value) {
            if (value === undefined || value === null || value === "") return "-";
            return escapeHtml(value);
        }

        parsePrice(raw) {
            if (!raw) return NaN;
            let s = String(raw).trim();
            s = s.replace(/R\$/i, "").replace(/\./g, "").replace(/\s+/g, "");
            s = s.replace(",", ".");
            const n = parseFloat(s);
            return isNaN(n) ? NaN : n;
        }

        buildProductImageUrl(product) {
            const raw = String(product.URL_IMG || "").trim();
            if (!raw) return "";

            if (/^(?:https?:\/\/|\/\/|(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$))/i.test(raw)) return safeHttpUrl(raw);
            if (raw.startsWith("/") && !raw.startsWith("//")) {
                const url = new URL(raw, window.location.origin);
                return url.origin === window.location.origin ? `${url.pathname}${url.search}` : "";
            }
            if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";

            const segments = raw.split("/");
            if (segments.some(segment => segment === "." || segment === "..")) return "";
            return `${this.imagesBasePath}/${segments.map(encodeURIComponent).join("/")}`;
        }

        buildVariationImageUrl(variation) {
            const raw = String(variation.URL_IMG || "").trim();
            if (!raw) return "";

            if (/^(?:https?:\/\/|\/\/|(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$))/i.test(raw)) return safeHttpUrl(raw);
            if (raw.startsWith("/") && !raw.startsWith("//")) {
                const url = new URL(raw, window.location.origin);
                return url.origin === window.location.origin ? `${url.pathname}${url.search}` : "";
            }
            if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";

            const segments = raw.split("/");
            if (segments.some(segment => segment === "." || segment === "..")) return "";
            return `${this.imagesBasePath}/${segments.map(encodeURIComponent).join("/")}`;
        }

        initLayout() {
            const products = this.service.products;

            const categorias = [...new Set(products.map(p => p.CATEGORIA).filter(Boolean))].sort();
            const subcategorias = [...new Set(products.map(p => p.SUBCATEGORIA).filter(Boolean))].sort();

            const filtrosHtml = `
        <details class="produtos-filtros" open>
          <summary><h3>Filtros</h3></summary>
          <div class="produtos-filtros-conteudo">

          <label for="filtro-categoria">Categoria</label>
          <select id="filtro-categoria">
            <option value="">Todas</option>
            ${categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
          </select>

          <label for="filtro-subcategoria">Subcategoria</label>
          <select id="filtro-subcategoria">
            <option value="">Todas</option>
            ${subcategorias.map(sc => `<option value="${escapeHtml(sc)}">${escapeHtml(sc)}</option>`).join("")}
          </select>

          <label for="filtro-busca">Busca (nome, descrição, SKU pai)</label>
          <input type="text" id="filtro-busca" placeholder="Digite um termo">

          <label for="filtro-preco-min">Preço mínimo (POR)</label>
          <input type="text" id="filtro-preco-min" placeholder="Ex: 10,00">

          <label for="filtro-preco-max">Preço máximo (POR)</label>
          <input type="text" id="filtro-preco-max" placeholder="Ex: 50,00">

          <button id="filtro-limpar">Limpar filtros</button>
          </div>
        </details>
      `;

            const estruturaHtml = `
      <div class="produtos-wrapper">
        ${filtrosHtml}

        <div class="produtos-lista">
          <table class="produtos-tabela">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Produto</th>
                <th>Preço Unitário</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="produto-detalhes-card hidden" id="produto-detalhes-card">
          <p>Selecione um produto na tabela para ver os detalhes.</p>
        </div>
      </div>
      `;

            this.container.innerHTML = estruturaHtml;

            const filtrosDisclosure = this.container.querySelector(".produtos-filtros");
            if (filtrosDisclosure && window.innerWidth <= 1024) {
                filtrosDisclosure.open = false;
            }

            this.tableBody = this.container.querySelector("tbody");
            this.detailsCard = this.container.querySelector("#produto-detalhes-card");

            this.filterCategory = this.container.querySelector("#filtro-categoria");
            this.filterSubcategory = this.container.querySelector("#filtro-subcategoria");
            this.filterSearch = this.container.querySelector("#filtro-busca");
            this.filterPriceMin = this.container.querySelector("#filtro-preco-min");
            this.filterPriceMax = this.container.querySelector("#filtro-preco-max");

            const btnClear = this.container.querySelector("#filtro-limpar");

            this.filterCategory.addEventListener("change", this.applyFilters);
            this.filterSubcategory.addEventListener("change", this.applyFilters);

            this.filterSearch.addEventListener("input", () => {
                clearTimeout(this.filterSearch._timeout);
                this.filterSearch._timeout = setTimeout(this.applyFilters, 300);
            });

            this.filterPriceMin.addEventListener("input", () => {
                clearTimeout(this.filterPriceMin._timeout);
                this.filterPriceMin._timeout = setTimeout(this.applyFilters, 300);
            });

            this.filterPriceMax.addEventListener("input", () => {
                clearTimeout(this.filterPriceMax._timeout);
                this.filterPriceMax._timeout = setTimeout(this.applyFilters, 300);
            });

            if (btnClear) {
                btnClear.addEventListener("click", () => {
                    this.filterCategory.value = "";
                    this.filterSubcategory.value = "";
                    this.filterSearch.value = "";
                    this.filterPriceMin.value = "";
                    this.filterPriceMax.value = "";
                    this.applyFilters();
                });
            }

            this.filteredIndexes = products.map((_, i) => i);

            // inicializa modal de imagem
            this.initImageModal();
        }

        // ==========================
        // MODAL DE IMAGEM
        // ==========================
        initImageModal() {
            const modalWrapper = document.createElement("div");
            modalWrapper.innerHTML = `
        <div class="produto-modal" id="produto-modal">
          <div class="produto-modal-backdrop"></div>
          <div class="produto-modal-content" role="dialog" aria-modal="true">
            <button class="produto-modal-close" type="button" aria-label="Fechar imagem">&times;</button>
            <img id="produto-modal-img" src="" alt="">
          </div>
        </div>
      `;

            const modal = modalWrapper.firstElementChild;
            this.container.appendChild(modal);

            this.modal = modal;
            this.modalImg = modal.querySelector("#produto-modal-img");
            this.modalClose = modal.querySelector(".produto-modal-close");

            // fecha ao clicar no fundo ou no botão
            this.modal.addEventListener("click", (e) => {
                if (
                    e.target === this.modal ||
                    e.target.classList.contains("produto-modal-backdrop") ||
                    e.target === this.modalClose
                ) {
                    this.closeImageModal();
                }
            });

            // fecha com ESC
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    this.closeImageModal();
                }
            });

            // delega clique para qualquer imagem com a classe .js-image-modal-trigger
            this.container.addEventListener("click", (e) => {
                const trigger = e.target.closest(".js-image-modal-trigger");
                if (!trigger) return;

                const src = trigger.getAttribute("data-fullsrc") || trigger.getAttribute("src");
                const alt = trigger.getAttribute("alt") || "";
                if (!src) return;

                this.openImageModal(src, alt);
            });
        }

        openImageModal(src, alt) {
            if (!this.modal || !this.modalImg) return;
            this.modalImg.src = src;
            this.modalImg.alt = alt || "";
            this.modal.classList.add("is-open");
        }

        closeImageModal() {
            if (!this.modal || !this.modalImg) return;
            this.modal.classList.remove("is-open");
            this.modalImg.src = "";
            this.modalImg.alt = "";
        }

        // ==========================
        // FILTROS / TABELA / DETALHES
        // ==========================
        applyFilters() {
            window.siteAnalyticsSelectedProduct = null;
            const products = this.service.products;
            const cat = this.filterCategory.value;
            const subcat = this.filterSubcategory.value;
            const termo = this.filterSearch.value.trim().toLowerCase();
            const precoMinVal = this.parsePrice(this.filterPriceMin.value);
            const precoMaxVal = this.parsePrice(this.filterPriceMax.value);

            this.filteredIndexes = products
                .map((p, index) => ({ p, index }))
                .filter(({ p }) => {
                    if (cat && p.CATEGORIA !== cat) return false;
                    if (subcat && p.SUBCATEGORIA !== subcat) return false;

                    if (termo) {
                        const campoBusca = `${p.PRODUTO || ""} ${p.DESCRICAO || ""} ${p.COD_SKU_PAI || ""}`.toLowerCase();
                        if (!campoBusca.includes(termo)) return false;
                    }

                    if (!isNaN(precoMinVal) || !isNaN(precoMaxVal)) {
                        const precoPor = this.parsePrice(p.POR);
                        if (!isNaN(precoMinVal) && (isNaN(precoPor) || precoPor < precoMinVal)) return false;
                        if (!isNaN(precoMaxVal) && (isNaN(precoPor) || precoPor > precoMaxVal)) return false;
                    }

                    return true;
                })
                .map(({ index }) => index);

            this.renderTable();

            // Filtering clears the selected row; also clear the desktop details card
            // so it cannot look selected while analytics has no product context.
            if (this.detailsCard) {
                this.detailsCard.classList.add("hidden");
                this.detailsCard.innerHTML = "<p>Selecione um produto na tabela para ver os detalhes.</p>";
            }
        }

        renderTable() {
            const products = this.service.products;
            this.tableBody.innerHTML = "";
            this.selectedRow = null;

            const existingDetailsRow = this.container.querySelector(".produto-detalhes-row");
            if (existingDetailsRow) existingDetailsRow.remove();

            let ledAnchorAssigned = false;
            const rowsHtml = this.filteredIndexes.map(idx => {
                const p = products[idx];
                const skuKey = ProductService.skuKey(p.COD_SKU_PAI);
                const variations = this.service.variationsBySku[skuKey] || [];
                const labelVariacoes = variations.length > 0 ? ` (${variations.length} variações)` : "";
                const imgUrl = this.buildProductImageUrl(p);
                const name = escapeHtml(p.PRODUTO || "Produto");
                const videoUrl = safeExternalUrl(p.URL_VIDEO);
                const isLedProduct = !ledAnchorAssigned && String(p.PRODUTO || "").toLocaleLowerCase("pt-BR").includes("dados de led");
                if (isLedProduct) ledAnchorAssigned = true;
                const rowId = isLedProduct ? ' id="dados-led"' : "";

                return `
          <tr${rowId} data-index="${idx}" tabindex="0" aria-label="Ver detalhes de ${name}" aria-expanded="false">
            <td>
              ${imgUrl ? `<img class="produto-img-small js-image-modal-trigger" data-fullsrc="${escapeHtml(imgUrl)}" src="${escapeHtml(imgUrl)}" alt="Imagem de ${name}" loading="lazy" decoding="async">` : ""}
            </td>
            <td><span class="produto-nome">${name}${escapeHtml(labelVariacoes)}</span></td>
            <td><pre style="white-space: pre-wrap; margin:0">${escapeHtml(p.MOQ || "")}</pre></td>
            <td>
              ${videoUrl
                        ? `<a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Assistir ao vídeo de ${name}">
                         <i class="fab fa-youtube youtube-icon" aria-hidden="true"></i>
                       </a>`
                        : "-"
                    }
            </td>
          </tr>
        `;
            }).join("");

            this.tableBody.innerHTML = rowsHtml || '<tr class="produtos-sem-resultado"><td colspan="4">Nenhum produto encontrado com esses filtros. Ajuste ou limpe os filtros para ver outros itens.</td></tr>';
            this.attachRowListeners();
        }

        refreshVariationData() {
            const products = this.service.products;

            this.tableBody.querySelectorAll("tr[data-index]").forEach(row => {
                const product = products[Number(row.dataset.index)];
                const name = row.querySelector(".produto-nome");
                if (!product || !name) return;

                const skuKey = ProductService.skuKey(product.COD_SKU_PAI);
                const variationCount = (this.service.variationsBySku[skuKey] || []).length;
                name.textContent = (product.PRODUTO || "") + (variationCount ? ` (${variationCount} variações)` : "");
            });

            if (!this.selectedRow) return;
            const selectedProduct = products[Number(this.selectedRow.dataset.index)];
            if (!selectedProduct) return;

            const detailsHtml = this.renderDetails(selectedProduct);
            if (window.innerWidth < 1100) {
                const detailsCell = this.container.querySelector(".produto-detalhes-row td");
                if (detailsCell) detailsCell.innerHTML = detailsHtml;
            } else if (this.detailsCard && !this.detailsCard.classList.contains("hidden")) {
                this.detailsCard.innerHTML = detailsHtml;
            }
        }

        renderDetails(product) {
            const imgUrl = this.buildProductImageUrl(product);
            const skuRaw = ProductService.skuKey(product.COD_SKU_PAI);
            const skuPai = this.normalize(product.COD_SKU_PAI);
            const categoria = this.normalize(product.CATEGORIA);
            const subcategoria = this.normalize(product.SUBCATEGORIA);
            const produtoNome = this.normalize(product.PRODUTO);
            const descricao = this.normalize(product.DESCRICAO);
            const dePreco = this.normalize(product.DE);
            const porPreco = this.normalize(product.POR);
            const mqq = this.normalize(product.MOQ);
            const peso = this.normalize(product.PESO);
            const videoUrl = safeExternalUrl(product.URL_VIDEO);
            const itensInclusos = this.normalize(product.ITENS_INCLUSOS);
            const caracteristicas = this.normalize(product.CARACTERISTICAS);
            const variacoes = this.service.variationsBySku[skuRaw] || [];

            const variacoesHtml = variacoes.length
                ? `<div class="produto-detalhes-variacoes" style="margin-top:8px;">
                    <span class="produto-detalhes-label">Variações (${variacoes.length}):</span>
                    <ul class="produto-list-variacoes">
                        ${variacoes.map(v => {
                            const image = this.buildVariationImageUrl(v);
                            const variationName = escapeHtml(v.VARIACAO || "");
                            const variationType = escapeHtml(v.TIPO_VARIACAO || "");
                            const variationSku = escapeHtml(v.COD_SKU || "");
                            const imageHtml = image
                                ? `<img class="js-image-modal-trigger" data-fullsrc="${escapeHtml(image)}" src="${escapeHtml(image)}" alt="${variationName}" loading="lazy" decoding="async" style="width:32px;height:32px;object-fit:cover;border-radius:4px;margin-right:4px;">`
                                : "";
                            return `<li>${imageHtml}<strong>${variationType}:</strong> ${variationName}<span style="font-size:10px;"> (${variationSku})</span></li>`;
                        }).join("")}
                    </ul>
                </div>`
                : `<div class="produto-detalhes-variacoes" style="margin-top:8px;">
                    <span class="produto-detalhes-label">Variações:</span><br>Nenhuma variação cadastrada.
                </div>`;

            return `
    <div class="produto-detalhes-header">
      ${imgUrl ? `<img class="js-image-modal-trigger" data-fullsrc="${escapeHtml(imgUrl)}" src="${escapeHtml(imgUrl)}" alt="${produtoNome}" loading="lazy" decoding="async">` : ""}
      <div>
        <div class="produto-detalhes-titulo">${produtoNome}</div>
        <div class="produto-detalhes-video" style="margin-top:8px;">
          ${videoUrl
                    ? `<a href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-youtube" aria-hidden="true"></i> Abrir vídeo</a>`
                    : "Nenhum vídeo informado."
                }
        </div>
        <div class="produto-detalhes-sub">
          <div><span class="produto-detalhes-label">SKU Pai:</span> ${skuPai}</div>
          <div><span class="produto-detalhes-label">Categoria:</span> ${categoria}</div>
          <div><span class="produto-detalhes-label">Subcategoria:</span> ${subcategoria}</div>
        </div>
      </div>
    </div>
    <div class="produto-detalhes-body">
      <div class="produto-detalhes-preco">
        <div><span class="produto-detalhes-label">De:</span> ${dePreco}</div>
        <div><span class="produto-detalhes-label">Por:</span> ${porPreco}</div>
      </div>
      <p><span class="produto-detalhes-label">Preço unitário:</span> ${mqq}</p>
      <p><span class="produto-detalhes-label">Peso (g):</span> ${peso}</p>
      <div class="produto-detalhes-descricao">
        <span class="produto-detalhes-label">Itens inclusos:</span><br>${itensInclusos}<br>
        <span class="produto-detalhes-label">Características:</span><br>${caracteristicas}<br>
      </div>
      ${variacoesHtml}
      <div><span class="produto-detalhes-label">Descrição:</span><br>${descricao}<br></div>
    </div>`;
        }

        attachRowListeners() {
            const rows = this.tableBody.querySelectorAll("tr[data-index]");
            const products = this.service.products;

            rows.forEach(row => {
                row.addEventListener("keydown", event => {
                    if (event.target !== row || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    row.click();
                });

                row.addEventListener("click", event => {
                    if (event.target.closest("a, button, .js-image-modal-trigger")) return;

                    const indexOriginal = parseInt(row.getAttribute("data-index"), 10);
                    const product = products[indexOriginal];
                    if (!product) return;

                    if (this.selectedRow === row) {
                        if (!this.isProgrammaticSelection) window.siteAnalyticsSelectedProduct = null;
                        row.classList.remove("selecionado");
                        row.setAttribute("aria-expanded", "false");
                        this.selectedRow = null;

                        if (window.innerWidth < 1100) {
                            const detailsRow = this.container.querySelector(".produto-detalhes-row");
                            if (detailsRow) detailsRow.remove();
                        } else {
                            this.detailsCard.classList.add("hidden");
                            this.detailsCard.innerHTML = "<p>Selecione um produto na tabela para ver os detalhes.</p>";
                        }
                        return;
                    }

                    if (this.selectedRow) {
                        this.selectedRow.classList.remove("selecionado");
                        this.selectedRow.setAttribute("aria-expanded", "false");
                    }
                    row.classList.add("selecionado");
                    row.setAttribute("aria-expanded", "true");
                    this.selectedRow = row;

                    const item = {
                        item_id: String(product.COD_SKU_PAI || "").trim(),
                        item_name: String(product.PRODUTO || "").trim(),
                        item_brand: "Covil do Jabuti",
                        item_category: String(product.CATEGORIA || "").trim(),
                        item_category2: String(product.SUBCATEGORIA || "").trim()
                    };
                    Object.keys(item).forEach(key => {
                        if (!item[key]) delete item[key];
                    });

                    // Programmatic opening shows details but does not imply user intent.
                    if (!this.isProgrammaticSelection) {
                        window.siteAnalyticsSelectedProduct = {
                            name: item.item_name || "",
                            sku: item.item_id || ""
                        };

                        if ((item.item_id || item.item_name) && typeof window.gtag === "function") {
                            window.gtag("event", "select_item", {
                                item_list_id: "lojista_catalog",
                                item_list_name: "Catálogo para lojistas",
                                items: [item]
                            });
                        }
                    }

                    const detailsHtml = this.renderDetails(product);
                    if (window.innerWidth < 1100) {
                        const existingDetailsRow = this.container.querySelector(".produto-detalhes-row");
                        if (existingDetailsRow) existingDetailsRow.remove();

                        const newRow = document.createElement("tr");
                        newRow.classList.add("produto-detalhes-row");
                        const td = document.createElement("td");
                        td.colSpan = 4;
                        td.innerHTML = detailsHtml;
                        newRow.appendChild(td);

                        if (row.nextSibling) row.parentNode.insertBefore(newRow, row.nextSibling);
                        else row.parentNode.appendChild(newRow);
                    } else {
                        this.detailsCard.innerHTML = detailsHtml;
                        this.detailsCard.classList.remove("hidden");
                    }
                });
            });
        }

        openProductFromHash() {
            if (window.location.hash !== "#dados-led") return false;
            const row = this.tableBody.querySelector('[id="dados-led"]');
            if (!row) return false;

            this.isProgrammaticSelection = true;
            try {
                row.click();
            } finally {
                this.isProgrammaticSelection = false;
            }

            window.requestAnimationFrame(() => {
                row.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            });
            return true;
        }

        openFirstProductIfAny() {
            if (this.filteredIndexes.length === 0) return;
            const firstRow = this.tableBody.querySelector("tr[data-index]");
            if (!firstRow) return;

            this.isProgrammaticSelection = true;
            try {
                firstRow.click();
            } finally {
                this.isProgrammaticSelection = false;
            }
        }
    }

    // ==========================
    // BOOTSTRAP
    // ==========================
    try {
        const service = new ProductService(Config.APIS.BD_Produtos);
        const variationsPromise = service.loadVariations().catch(err => {
            console.warn("Não foi possível carregar as variações:", err);
            return false;
        });
        await service.loadProducts();

        if (!Array.isArray(service.products) || service.products.length === 0) {
            container.innerHTML = "<p>Nenhum produto encontrado.</p>";
            return;
        }

        const ui = new ProductUI(container, service, IMAGES_BASE_PATH);
        ui.initLayout();
        ui.applyFilters();
        const openedFromHash = ui.openProductFromHash();
        if (!openedFromHash && window.innerWidth >= 1100) {
            ui.openFirstProductIfAny();
        }

        variationsPromise.then(loaded => {
            if (loaded) ui.refreshVariationData();
        });

    } catch (err) {
        console.error("Erro ao carregar produtos/variações:", err);
        container.innerHTML = '<p style="color:red">Erro ao carregar produtos.</p>';
    }
})();
