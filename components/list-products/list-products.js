(async function () {
    const IMAGES_BASE_PATH = "/lojista/app_produtos"; // ajuste se precisar

    const container = document.querySelector('div[data-include="components/list-products/"]');
    if (!container) return;

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

        async load() {
            const [prodRes, varRes] = await Promise.all([
                fetch(this.apiBaseUrl),
                fetch(this.apiBaseUrl + "?tipo=variacoes"),
            ]);

            this.products = await prodRes.json();
            this.variations = await varRes.json();

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

            console.log("SKUs de produtos:", this.products.map(p => ProductService.skuKey(p.COD_SKU_PAI)));
            console.log("Mapa de variações por SKU:", this.variationsBySku);
        }

        getVariationsForProduct(product) {
            const key = ProductService.skuKey(product.COD_SKU_PAI);
            return this.variationsBySku[key] || [];
        }
    }

    // ==========================
    // UI: filtros, tabela, detalhes
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

            // bind de métodos usados em eventos
            this.applyFilters = this.applyFilters.bind(this);
            this.renderTable = this.renderTable.bind(this);
            this.attachRowListeners = this.attachRowListeners.bind(this);
        }

        normalize(value) {
            if (value === undefined || value === null || value === "") return "-";
            return String(value);
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
            const raw = product.URL_IMG || "";
            if (!raw) return "";

            if (/^https?:\/\//i.test(raw)) return raw;
            if (raw.startsWith("/")) return raw;

            return `${this.imagesBasePath}/${raw}`;
        }

        buildVariationImageUrl(variation) {
            const raw = variation.URL_IMG || "";
            if (!raw) return "";

            if (/^https?:\/\//i.test(raw)) return raw;
            if (raw.startsWith("/")) return raw;

            return `${this.imagesBasePath}/${raw}`;
        }

        initLayout() {
            const products = this.service.products;

            const categorias = [...new Set(products.map(p => p.CATEGORIA).filter(Boolean))].sort();
            const subcategorias = [...new Set(products.map(p => p.SUBCATEGORIA).filter(Boolean))].sort();

            const filtrosHtml = `
        <div class="produtos-filtros">
          <h3>Filtros</h3>

          <label for="filtro-categoria">Categoria</label>
          <select id="filtro-categoria">
            <option value="">Todas</option>
            ${categorias.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>

          <label for="filtro-subcategoria">Subcategoria</label>
          <select id="filtro-subcategoria">
            <option value="">Todas</option>
            ${subcategorias.map(sc => `<option value="${sc}">${sc}</option>`).join("")}
          </select>

          <label for="filtro-busca">Busca (nome, descrição, SKU pai)</label>
          <input type="text" id="filtro-busca" placeholder="Digite um termo">

          <label for="filtro-preco-min">Preço mínimo (POR)</label>
          <input type="text" id="filtro-preco-min" placeholder="Ex: 10,00">

          <label for="filtro-preco-max">Preço máximo (POR)</label>
          <input type="text" id="filtro-preco-max" placeholder="Ex: 50,00">

          <button id="filtro-limpar">Limpar filtros</button>
        </div>
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
                <th>MOQ</th>
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
        }

        applyFilters() {
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
        }

        renderTable() {
            const products = this.service.products;
            this.tableBody.innerHTML = "";
            this.selectedRow = null;

            const existingDetailsRow = this.container.querySelector(".produto-detalhes-row");
            if (existingDetailsRow) existingDetailsRow.remove();

            const rowsHtml = this.filteredIndexes.map(idx => {
                const p = products[idx];
                const skuKey = ProductService.skuKey(p.COD_SKU_PAI);
                const variations = this.service.variationsBySku[skuKey] || [];
                const qtd = variations.length;

                const labelVariacoes = qtd > 0 ? ` (${qtd} variações)` : "";
                const imgUrl = this.buildProductImageUrl(p);

                console.log("Produto", skuKey, "->", qtd, "variações");

                return `
          <tr data-index="${idx}">
            <td>
              ${imgUrl ? `<img class="produto-img-small" src="${imgUrl}" alt="${p.PRODUTO || ""}">` : ""}
            </td>
            <td>${(p.PRODUTO || "") + labelVariacoes}</td>
            <td><pre style="white-space: pre-wrap; margin:0">${p.MOQ || ""}</pre></td>
            <td>
              ${p.URL_VIDEO
                        ? `<a href="${p.URL_VIDEO}" target="_blank" rel="noopener noreferrer">
                         <i class="fab fa-youtube youtube-icon"></i>
                       </a>`
                        : "-"
                    }
            </td>
          </tr>
        `;
            }).join("");

            this.tableBody.innerHTML = rowsHtml;
            this.attachRowListeners();
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
            const tamanhoLados = this.normalize(product["TAMANHO LADOS (MM)"]);
            const destaque = this.normalize(product.DESTAQUE);
            const videoUrl = product.URL_VIDEO || "";
            const itens_inclusos = this.normalize(product.ITENS_INCLUSOS);
            const caracteristicas = this.normalize(product.CARACTERISTICAS);

            const variacoesDoProduto = this.service.variationsBySku[skuRaw] || [];

            let variacoesHtml = `
      <div class="produto-detalhes-variacoes" style="margin-top:8px;">
        <span class="produto-detalhes-label">Variações:</span><br>
        Nenhuma variação cadastrada.
      </div>
    `;

            if (Array.isArray(variacoesDoProduto) && variacoesDoProduto.length > 0) {
                const itensHtml = variacoesDoProduto.map(v => {
                    const imgVarUrl = this.buildVariationImageUrl(v);
                    const imgVar = imgVarUrl
                        ? `<img src="${imgVarUrl}" alt="${v.VARIACAO || ""}"
                                 style="width:32px;height:32px;object-fit:cover;border-radius:4px;margin-right:4px;">`
                        : "";
                    return `
              <li>
                ${imgVar}
                <strong>${v.TIPO_VARIACAO || ""}:</strong> ${v.VARIACAO || ""}
                <span style="font-size:10px;"> (${v.COD_SKU || ""})</span>
              </li>
            `;
                }).join("");

                variacoesHtml = `
      <div class="produto-detalhes-variacoes" style="margin-top:8px;">
        <span class="produto-detalhes-label">Variações (${variacoesDoProduto.length}):</span>
        <ul class="produto-list-variacoes">
          ${itensHtml}
        </ul>
      </div>
    `;
            }

            return `
    <div class="produto-detalhes-header">
      ${imgUrl ? `<img src="${imgUrl}" alt="${produtoNome}">` : ""}
      <div>
        <div class="produto-detalhes-titulo">${produtoNome}</div>
        
      
        <div class="produto-detalhes-video" style="margin-top:8px;">
        
        ${videoUrl
                    ? `<a href="${videoUrl}" target="_blank" rel="noopener noreferrer">
             <i class="fab fa-youtube"></i> Abrir vídeo
           </a>`
                    : "Nenhum video informado."
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
      <p><span class="produto-detalhes-label">MOQ:</span> ${mqq}</p>
      <p><span class="produto-detalhes-label">Peso:</span> ${peso}</p>
      <p><span class="produto-detalhes-label">Tamanho lados (mm):</span> ${tamanhoLados}</p>
      <p><span class="produto-detalhes-label">Destaque:</span> ${destaque}</p>

      

      <div class="produto-detalhes-preco">
        <div><span class="produto-detalhes-label">De:</span> ${dePreco}</div>
        <div><span class="produto-detalhes-label">Por:</span> ${porPreco}</div>
      </div>

      ${variacoesHtml}

      <div class="produto-detalhes-descricao">
        <span class="produto-detalhes-label">Descrição:</span><br>
        ${descricao}<br>
        <span class="produto-detalhes-label">Itens Inclusos:</span><br>
        ${itens_inclusos}<br>
        <span class="produto-detalhes-label">Características:</span><br>
        ${caracteristicas}<br>
      </div>


      
    </div>
    `;
        }

        attachRowListeners() {
            const rows = this.tableBody.querySelectorAll("tr");
            const products = this.service.products;

            rows.forEach(row => {
                row.addEventListener("click", () => {
                    const indexOriginal = parseInt(row.getAttribute("data-index"), 10);
                    const product = products[indexOriginal];
                    if (!product) return;

                    if (this.selectedRow === row) {
                        row.classList.remove("selecionado");
                        this.selectedRow = null;

                        if (window.innerWidth < 768) {
                            const detalhesRow = this.container.querySelector(".produto-detalhes-row");
                            if (detalhesRow) detalhesRow.remove();
                        } else {
                            this.detailsCard.classList.add("hidden");
                            this.detailsCard.innerHTML = "<p>Selecione um produto na tabela para ver os detalhes.</p>";
                        }
                        return;
                    }

                    if (this.selectedRow) {
                        this.selectedRow.classList.remove("selecionado");
                    }
                    row.classList.add("selecionado");
                    this.selectedRow = row;

                    const detailsHtml = this.renderDetails(product);

                    if (window.innerWidth < 768) {
                        const existingDetailsRow = this.container.querySelector(".produto-detalhes-row");
                        if (existingDetailsRow) existingDetailsRow.remove();

                        const newRow = document.createElement("tr");
                        newRow.classList.add("produto-detalhes-row");
                        const td = document.createElement("td");
                        td.colSpan = 4;
                        td.innerHTML = detailsHtml;
                        newRow.appendChild(td);

                        if (row.nextSibling) {
                            row.parentNode.insertBefore(newRow, row.nextSibling);
                        } else {
                            row.parentNode.appendChild(newRow);
                        }
                    } else {
                        this.detailsCard.innerHTML = detailsHtml;
                        this.detailsCard.classList.remove("hidden");
                    }
                });
            });
        }

        openFirstProductIfAny() {
            if (this.filteredIndexes.length === 0) return;
            const firstRow = this.tableBody.querySelector("tr");
            if (firstRow) firstRow.click();
        }
    }

    // ==========================
    // BOOTSTRAP
    // ==========================
    try {
        const service = new ProductService(Config.APIS.BD_Produtos);
        await service.load();

        if (!Array.isArray(service.products) || service.products.length === 0) {
            container.innerHTML = "<p>Nenhum produto encontrado.</p>";
            return;
        }

        const ui = new ProductUI(container, service, IMAGES_BASE_PATH);
        ui.initLayout();
        ui.applyFilters();
        ui.openFirstProductIfAny();

    } catch (err) {
        console.error("Erro ao carregar produtos/variações:", err);
        container.innerHTML = '<p style="color:red">Erro ao carregar produtos.</p>';
    }
})();
