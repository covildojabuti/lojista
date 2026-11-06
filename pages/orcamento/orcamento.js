(function () {
    const MAX_QUANTITY = 9999;
    const CATALOG_TIMEOUT_MS = 12000;
    const IMAGE_BASE_PATH = "/lojista/app_produtos";

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);

    function parseMoney(value) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
        const raw = String(value ?? "").trim().replace(/^R\$/i, "").replace(/\s+/g, "");
        if (!raw) return null;
        let normalized;
        if (raw.includes(",")) {
            if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})$/.test(raw)) return null;
            normalized = raw.replace(/\./g, "").replace(",", ".");
        } else if (/^\d+$/.test(raw)) {
            normalized = raw;
        } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
            normalized = raw.replace(/\./g, "");
        } else if (/^\d+\.\d{1,2}$/.test(raw)) {
            normalized = raw;
        } else {
            return null;
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function cents(value) {
        return value === null ? null : Math.round(value * 100);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }

    function getPricingBands(tiers) {
        const bands = tiers.map((tier, index) => ({
            firstQuantity: index === 0 ? 0 : tiers[index - 1].quantity + 1,
            lastQuantity: tier.quantity,
            price: tier.price,
            openEnded: index === tiers.length - 1
        }));

        return bands.reduce((merged, band) => {
            const previous = merged.at(-1);
            if (previous && cents(previous.price) === cents(band.price)) {
                previous.lastQuantity = band.lastQuantity;
                previous.openEnded = band.openEnded;
            } else {
                merged.push({ ...band });
            }
            return merged;
        }, []);
    }

    function getPricingBandLabel(band) {
        if (band.firstQuantity === 0 && band.openEnded) return "Todas as quantidades";
        if (band.openEnded) return `${band.firstQuantity} ou mais`;
        if (band.firstQuantity === 0) return `0–${band.lastQuantity}`;
        return `${band.firstQuantity}–${band.lastQuantity}`;
    }

    function getTextMarkup(value) {
        const text = String(value ?? "").trim();
        return text ? escapeHtml(text).replace(/\r?\n/g, "<br>") : "Não informado.";
    }

    function safeExternalUrl(value) {
        try {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const candidate = /^(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$)/i.test(raw) ? `https://${raw}` : raw;
            const url = new URL(candidate, window.location.origin);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
    }

    function parsePricing(product, index) {
        const raw = String(product.MOQ || "");
        const groupMatch = raw.match(/Grupo de Quantidade:\s*([^\r\n]+)/i);
        const groupName = (groupMatch && groupMatch[1].trim()) || `Produto ${product.COD_SKU_PAI || index + 1}`;
        const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        const tierLinePattern = /^(\d+)\s*=\s*R\$\s*([\d.,]+)\s*\(cada\)$/i;
        const pricingLines = lines.filter(line => /(?:=|R\$)/i.test(line) && !/^Grupo de Quantidade:/i.test(line));
        const parsedLines = pricingLines.map(line => {
            const match = line.match(tierLinePattern);
            return match
                ? { quantity: Number(match[1]), price: parseMoney(match[2]) }
                : null;
        });
        const tiers = parsedLines.filter(Boolean).sort((a, b) => a.quantity - b.quantity);
        const duplicateQuantity = tiers.some((tier, tierIndex) => tierIndex > 0 && tier.quantity === tiers[tierIndex - 1].quantity);
        const invalidTier = tiers.some(tier => !Number.isInteger(tier.quantity) || tier.quantity <= 0 || tier.price === null || tier.price <= 0);
        const hasTierPricing = Boolean(groupMatch) || pricingLines.length > 0;
        const invalid = hasTierPricing && (
            pricingLines.length === 0 ||
            parsedLines.some(tier => tier === null) ||
            invalidTier ||
            duplicateQuantity
        );
        const fallbackPrice = parseMoney(product.POR);

        return {
            groupName,
            groupKey: groupName.normalize("NFKC").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " "),
            tiers,
            bands: getPricingBands(tiers),
            invalid,
            fallbackPrice: fallbackPrice !== null && fallbackPrice > 0 ? fallbackPrice : null
        };
    }

    function productImageUrl(rawValue) {
        const raw = String(rawValue || "").trim();
        if (!raw) return "";

        try {
            if (/^(?:https?:\/\/|\/\/|(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$))/i.test(raw)) {
                const candidate = /^(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$)/i.test(raw) ? `https://${raw}` : raw;
                const url = new URL(candidate, window.location.origin);
                return ["https:", "http:"].includes(url.protocol) ? url.href : "";
            }
            if (raw.startsWith("/")) {
                const url = new URL(raw, window.location.origin);
                return url.origin === window.location.origin ? `${url.pathname}${url.search}` : "";
            }
            if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
            const segments = raw.split("/");
            if (segments.some(segment => segment === "." || segment === "..")) return "";
            return `${IMAGE_BASE_PATH}/${segments.map(encodeURIComponent).join("/")}`;
        } catch {
            return "";
        }
    }

    function waitForApiConfig() {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const check = () => {
                const api = window.Config?.APIS?.BD_Produtos || window.APP_CONFIG?.apis?.BD_Produtos;
                if (api) return resolve(api);
                if (Date.now() - startedAt > 5000) return reject(new Error("Configuração do catálogo indisponível."));
                window.setTimeout(check, 100);
            };
            check();
        });
    }

    function initialize(root) {
        if (!root || root.dataset.orcamentoInicializado === "true") return;
        if (!window.B2B_COMMERCIAL_POLICY) {
            const status = root.querySelector("[data-catalog-status]");
            status.textContent = "As condições comerciais não carregaram. Atualize a página ou fale com a equipe.";
            status.classList.add("orcamento-status--erro");
            return;
        }
        const COMMERCIAL_POLICY = window.B2B_COMMERCIAL_POLICY;
        root.dataset.orcamentoInicializado = "true";

        const productsGrid = root.querySelector("[data-products]");
        const catalogStatus = root.querySelector("[data-catalog-status]");
        const productCount = root.querySelector("[data-product-count]");
        const searchInput = root.querySelector("[data-search]");
        const categorySelect = root.querySelector("[data-category]");
        const cartItemsElement = root.querySelector("[data-cart-items]");
        const tierProgressElement = root.querySelector("[data-tier-progress]");
        const productDialog = root.querySelector("[data-product-dialog]");
        const productDialogContent = root.querySelector("[data-product-dialog-content]");
        const cartCountElement = root.querySelector("[data-cart-count]");
        const minimumElement = root.querySelector("[data-minimum]");
        const minimumProgress = root.querySelector("[data-minimum-progress]");
        const minimumMessage = root.querySelector("[data-minimum-message]");
        const subtotalElement = root.querySelector("[data-subtotal]");
        const shippingElement = root.querySelector("[data-shipping]");
        const boletoElement = root.querySelector("[data-total-boleto]");
        const pixElement = root.querySelector("[data-total-pix]");
        const quoteNote = root.querySelector("[data-quote-note]");
        const copyButton = root.querySelector("[data-copy]");
        const printButton = root.querySelector("[data-print]");
        const feedback = root.querySelector("[data-feedback]");
        const mobileSummary = root.querySelector("[data-mobile-summary]");
        const mobileCount = root.querySelector("[data-mobile-count]");
        const mobileTotalLabel = root.querySelector("[data-mobile-label]");
        const mobileTotal = root.querySelector("[data-mobile-total]");
        const printContext = root.querySelector("[data-print-context]");
        const viewQuoteButton = root.querySelector("[data-view-quote]");
        const quoteSummary = root.querySelector(".orcamento-resumo");
        const minimumLabel = root.querySelector("[data-minimum-label]");
        const mobileSummaryResizeObserver = "ResizeObserver" in window
            ? new ResizeObserver(() => updateMobileSummarySpace())
            : null;

        function updateMobileSummarySpace() {
            if (mobileSummary.hidden || !window.matchMedia("(max-width: 900px)").matches) {
                document.body.style.removeProperty("--orcamento-mobile-summary-height");
                return;
            }
            const height = Math.ceil(mobileSummary.getBoundingClientRect().height);
            document.body.style.setProperty("--orcamento-mobile-summary-height", `${height}px`);
        }

        function renderPolicy() {
            const minimum = formatCurrency(COMMERCIAL_POLICY.minimumOrderCents / 100);
            const freeShippingLimit = formatCurrency(COMMERCIAL_POLICY.freeShippingCents / 100);
            const standardShipping = formatCurrency(COMMERCIAL_POLICY.standardShippingCents / 100);
            const pixPercent = Math.round(COMMERCIAL_POLICY.pixDiscountRate * 100);
            root.querySelector("[data-policy-minimum]").textContent = `${minimum} em produtos`;
            root.querySelector("[data-policy-shipping]").textContent = `${standardShipping} · grátis acima de ${freeShippingLimit}`;
            root.querySelector("[data-policy-payment]").textContent = `Boleto ${COMMERCIAL_POLICY.boletoTerm} ou ${pixPercent}% de desconto no PIX sobre os produtos; frete sem desconto`;
            root.querySelector("[data-policy-pix-detail]").textContent = `(${pixPercent}% nos produtos)`;
            minimumLabel.textContent = minimum;
        }

        const state = {
            products: [],
            variationsBySku: Object.create(null),
            variationsLoaded: false,
            variationsFailed: false,
            variationsPromise: null,
            cart: new Map(),
            search: "",
            category: "",
            shippingMethod: "entrega",
            pricing: null
        };

        function setStatus(message, type = "") {
            catalogStatus.className = `orcamento-status${type ? ` orcamento-status--${type}` : ""}`;
            catalogStatus.textContent = message;
        }

        function buildCategories() {
            const categories = [...new Set(state.products.map(product => String(product.CATEGORIA || "").trim()).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, "pt-BR"));
            categorySelect.innerHTML = `<option value="">Todas as categorias</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
        }

        function priceDescription(product) {
            if (product.pricing.invalid) return "A faixa de preço cadastrada precisa ser confirmada com a equipe.";
            if (!product.pricing.tiers.length) {
                return product.pricing.fallbackPrice === null
                    ? "Preço por confirmar com a equipe."
                    : `Preço cadastrado: ${formatCurrency(product.pricing.fallbackPrice)} por unidade.`;
            }
            const priceBands = product.pricing.bands.map(band =>
                `${getPricingBandLabel(band)}: ${formatCurrency(band.price)}`
            );
            return `Faixas do grupo por unidade: ${priceBands.join(" · ")}`;
        }

        function normalizedFacet(value) {
            return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("pt-BR");
        }

        function loadProductVariations() {
            if (state.variationsLoaded) return Promise.resolve();
            if (state.variationsPromise) return state.variationsPromise;

            state.variationsPromise = (async () => {
                const apiUrl = await waitForApiConfig();
                const variationsUrl = new URL(apiUrl, window.location.origin);
                variationsUrl.searchParams.set("tipo", "variacoes");
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
                try {
                    const response = await fetch(variationsUrl, { signal: controller.signal });
                    if (!response.ok) throw new Error(`Falha ao carregar variações (HTTP ${response.status}).`);
                    const variations = await response.json();
                    if (!Array.isArray(variations)) throw new Error("A lista de variações não veio como uma lista.");

                    const variationsBySku = Object.create(null);
                    variations.forEach(variation => {
                        const sku = String(variation.COD_SKU_PAI || "").trim().toLocaleUpperCase("pt-BR");
                        if (!sku || !String(variation.VARIACAO || "").trim()) return;
                        (variationsBySku[sku] ||= []).push(variation);
                    });
                    state.variationsBySku = variationsBySku;
                    state.variationsLoaded = true;
                } finally {
                    window.clearTimeout(timeoutId);
                }
            })().catch(error => {
                console.warn("Não foi possível carregar as variações do produto:", error);
                state.variationsFailed = true;
                state.variationsLoaded = true;
            });

            return state.variationsPromise;
        }

        function renderVariations(product) {
            if (!state.variationsLoaded) return "<p>Carregando variações…</p>";
            if (state.variationsFailed) return "<p>Não foi possível carregar as variações agora.</p>";

            const sku = String(product.COD_SKU_PAI || "").trim().toLocaleUpperCase("pt-BR");
            const variations = state.variationsBySku[sku] || [];
            if (!variations.length) return "<p>Nenhuma variação cadastrada.</p>";

            return "<ul class=\"orcamento-produto-dialog__variacoes\">" + variations.map(variation => {
                const image = productImageUrl(variation.URL_IMG);
                const name = String(variation.VARIACAO || "").trim();
                const type = String(variation.TIPO_VARIACAO || "Variação").trim();
                const imageMarkup = image
                    ? "<img src=\"" + escapeHtml(image) + "\" alt=\"\" loading=\"lazy\" decoding=\"async\">"
                    : "";
                const skuMarkup = String(variation.COD_SKU || "").trim()
                    ? "<small>SKU " + escapeHtml(variation.COD_SKU) + "</small>"
                    : "";
                return "<li>" + imageMarkup + "<span><strong>" + escapeHtml(type) + ":</strong> " + escapeHtml(name) + skuMarkup + "</span></li>";
            }).join("") + "</ul>";
        }

        function openProductDialog(index) {
            const product = findProduct(index);
            if (!product || !productDialog || !productDialogContent) return;

            const image = productImageUrl(product.URL_IMG);
            const imageMarkup = image
                ? "<img src=\"" + escapeHtml(image) + "\" alt=\"" + escapeHtml(product.PRODUTO || "Produto") + "\" decoding=\"async\">"
                : "<span class=\"orcamento-produto__sem-imagem\" aria-hidden=\"true\">◇</span>";
            const details = [
                ["Categoria", product.CATEGORIA],
                ["Subcategoria", product.SUBCATEGORIA],
                ["SKU Pai", product.COD_SKU_PAI],
                ["De", product.DE],
                ["Por", product.POR],
                ["Peso (g)", product.PESO],
                ["Grupo de preço", product.pricing.groupName]
            ];
            const detailMarkup = details.map(([label, value]) =>
                "<div><dt>" + escapeHtml(label) + "</dt><dd>" + getTextMarkup(value) + "</dd></div>"
            ).join("");
            const tierMarkup = product.pricing.invalid
                ? "<p class=\"orcamento-produto-dialog__pendente\">A tabela deste produto precisa ser confirmada pela equipe.</p>"
                : product.pricing.tiers.length
                    ? "<ul class=\"orcamento-produto-dialog__faixas\">" + product.pricing.bands.map(band =>
                        "<li><span>" + escapeHtml(getPricingBandLabel(band)) + " unidades</span><strong>" + formatCurrency(band.price) + " / un.</strong></li>"
                    ).join("") + "</ul>"
                    : "<p>" + (product.pricing.fallbackPrice === null ? "Preço a confirmar com a equipe." : "Preço cadastrado: " + formatCurrency(product.pricing.fallbackPrice) + " por unidade.") + "</p>";
            const videoUrl = safeExternalUrl(product.URL_VIDEO);
            const descriptionMarkup = [
                ["Itens inclusos", product.ITENS_INCLUSOS],
                ["Características", product.CARACTERISTICAS],
                ["Descrição", product.DESCRICAO]
            ].map(([label, value]) =>
                "<section class=\"orcamento-produto-dialog__texto\"><h3>" + escapeHtml(label) + "</h3><p>" + getTextMarkup(value) + "</p></section>"
            ).join("");
            const subcategory = normalizedFacet(product.SUBCATEGORIA);
            const category = normalizedFacet(product.CATEGORIA);
            const relatedProducts = subcategory
                ? state.products.filter(candidate =>
                    candidate.key !== product.key &&
                    normalizedFacet(candidate.CATEGORIA) === category &&
                    normalizedFacet(candidate.SUBCATEGORIA) === subcategory
                )
                : [];
            const relatedMarkup = relatedProducts.length
                ? "<section class=\"orcamento-produto-dialog__relacionados\" aria-labelledby=\"orcamento-produto-dialog-modelos\"><h3 id=\"orcamento-produto-dialog-modelos\">Outros modelos desta subcategoria</h3><div>" + relatedProducts.map(candidate => {
                    const candidateImage = productImageUrl(candidate.URL_IMG);
                    return "<button type=\"button\" data-view-product data-product-index=\"" + candidate.index + "\" aria-label=\"Ver " + escapeHtml(candidate.PRODUTO || "produto") + "\">" +
                        (candidateImage ? "<img src=\"" + escapeHtml(candidateImage) + "\" alt=\"\" loading=\"lazy\" decoding=\"async\">" : "") +
                        "<span>" + escapeHtml(candidate.PRODUTO || "Produto") + "</span></button>";
                }).join("") + "</div></section>"
                : "<p class=\"orcamento-produto-dialog__sem-relacionados\">Confira a categoria e a subcategoria para comparar este modelo com o catálogo.</p>";

            productDialogContent.innerHTML =
                "<div class=\"orcamento-produto-dialog__cabecalho\">" +
                    "<p class=\"orcamento-eyebrow orcamento-eyebrow--dark\">Detalhes do produto</p>" +
                    "<button type=\"button\" class=\"orcamento-produto-dialog__fechar\" data-dialog-close aria-label=\"Fechar detalhes\">×</button>" +
                "</div>" +
                "<div class=\"orcamento-produto-dialog__principal\">" +
                    "<div class=\"orcamento-produto-dialog__imagem\">" + imageMarkup + "</div>" +
                    "<div class=\"orcamento-produto-dialog__informacoes\">" +
                        "<h2 id=\"orcamento-produto-dialog-titulo\">" + escapeHtml(product.PRODUTO || "Produto") + "</h2>" +
                        "<dl>" + detailMarkup + "</dl>" +
                        "<section class=\"orcamento-produto-dialog__moq\"><h3>Preço unitário / MOQ informado</h3><p>" + getTextMarkup(product.MOQ) + "</p></section>" +
                        "<section aria-labelledby=\"orcamento-produto-dialog-faixas\">" +
                            "<h3 id=\"orcamento-produto-dialog-faixas\">Preços por faixa</h3>" +
                            "<p class=\"orcamento-produto-dialog__nota\">A faixa considera o total de unidades do grupo " + escapeHtml(product.pricing.groupName) + ".</p>" +
                            tierMarkup +
                        "</section>" +
                        "<div class=\"orcamento-produto-dialog__descricoes\">" + descriptionMarkup + "</div>" +
                        "<section class=\"orcamento-produto-dialog__variacoes-secao\"><h3>Variações</h3><div data-product-variations>" + renderVariations(product) + "</div></section>" +
                        "<p class=\"orcamento-produto-dialog__video\">" + (videoUrl
                            ? "<a href=\"" + escapeHtml(videoUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">▶ Assistir ao vídeo do produto</a>"
                            : "Nenhum vídeo informado.") + "</p>" +
                        "<div class=\"orcamento-produto-dialog__adicionar\">" +
                            "<button type=\"button\" class=\"orcamento-adicionar\" data-dialog-add-product data-product-index=\"" + product.index + "\">Adicionar 1 ao orçamento <span aria-hidden=\"true\">＋</span></button>" +
                            "<p data-dialog-feedback role=\"status\" aria-live=\"polite\"></p>" +
                        "</div>" +
                    "</div>" +
                "</div>" + relatedMarkup;
            productDialogContent.dataset.productIndex = String(product.index);
            if (!productDialog.open && typeof productDialog.showModal === "function") productDialog.showModal();
            else if (!productDialog.open) productDialog.setAttribute("open", "");
            productDialogContent.querySelector("[data-dialog-close]")?.focus();

            if (!state.variationsLoaded) {
                loadProductVariations().then(() => {
                    if (productDialogContent.dataset.productIndex !== String(product.index)) return;
                    const variationsSlot = productDialogContent.querySelector("[data-product-variations]");
                    if (variationsSlot) variationsSlot.innerHTML = renderVariations(product);
                });
            }
        }

        function renderProducts() {
            const term = state.search.toLocaleLowerCase("pt-BR");
            const filtered = state.products.filter(product => {
                const categoryMatches = !state.category || String(product.CATEGORIA || "") === state.category;
                const searchable = `${product.PRODUTO || ""} ${product.COD_SKU_PAI || ""} ${product.CATEGORIA || ""} ${product.SUBCATEGORIA || ""}`.toLocaleLowerCase("pt-BR");
                return categoryMatches && (!term || searchable.includes(term));
            });

            productCount.textContent = `${filtered.length} ${filtered.length === 1 ? "produto" : "produtos"}`;
            if (!filtered.length) {
                productsGrid.innerHTML = `<div class="orcamento-vazio"><p>Nenhum produto encontrado. Tente outro nome ou categoria.</p></div>`;
                return;
            }

            productsGrid.innerHTML = filtered.map(product => {
                const image = productImageUrl(product.URL_IMG);
                const imageMarkup = image
                    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.PRODUTO || "Produto")}" loading="lazy" decoding="async">`
                    : `<span class="orcamento-produto__sem-imagem" aria-hidden="true">◇</span>`;
                return `
                    <article class="orcamento-produto" data-product-card data-product-index="${product.index}">
                        <div class="orcamento-produto__imagem">${imageMarkup}</div>
                        <div class="orcamento-produto__conteudo">
                            <p class="orcamento-produto__categoria">${escapeHtml(product.CATEGORIA || "Produto")}${product.SUBCATEGORIA ? ` · ${escapeHtml(product.SUBCATEGORIA)}` : ""}</p>
                            <h3>${escapeHtml(product.PRODUTO || "Produto")}</h3>
                            <p class="orcamento-produto__grupo">Grupo: <strong>${escapeHtml(product.pricing.groupName)}</strong></p>
                            <p class="orcamento-produto__faixas">${priceDescription(product)}</p>
                            <div class="orcamento-produto__adicionar">
                                <label class="sr-only" for="qtd-produto-${product.index}">Quantidade de ${escapeHtml(product.PRODUTO || "produto")}</label>
                                <input id="qtd-produto-${product.index}" class="orcamento-quantidade" data-add-quantity type="number" min="1" max="${MAX_QUANTITY}" step="1" value="1" inputmode="numeric" aria-describedby="qtd-produto-${product.index}-feedback">
                                <button type="button" class="orcamento-adicionar" data-add-product aria-label="Adicionar ${escapeHtml(product.PRODUTO || "produto")} ao orçamento">Adicionar <span aria-hidden="true">＋</span></button>
                            </div>
                            <p id="qtd-produto-${product.index}-feedback" class="orcamento-add-feedback" data-add-feedback role="status" aria-live="polite" aria-atomic="true"></p>
                        </div>
                    </article>`;
            }).join("");

            productsGrid.querySelectorAll("[data-product-card]").forEach(card => {
                const product = findProduct(card.dataset.productIndex);
                const imageContainer = card.querySelector(".orcamento-produto__imagem");
                if (!product || !imageContainer) return;

                const imageButton = document.createElement("button");
                imageButton.type = "button";
                imageButton.className = "orcamento-produto__ver-imagem";
                imageButton.dataset.viewProduct = "";
                imageButton.dataset.productIndex = String(product.index);
                imageButton.setAttribute("aria-label", "Ver detalhes de " + (product.PRODUTO || "produto"));
                imageContainer.replaceWith(imageButton);
                imageButton.append(imageContainer);

                const heading = card.querySelector("h3");
                const detailsButton = document.createElement("button");
                detailsButton.type = "button";
                detailsButton.className = "orcamento-produto__ver-detalhes";
                detailsButton.dataset.viewProduct = "";
                detailsButton.dataset.productIndex = String(product.index);
                detailsButton.textContent = "Ver detalhes e modelos";
                heading?.after(detailsButton);
            });
        }

        function groupQuantity(groupKey) {
            return [...state.cart.values()].reduce((sum, item) => sum + (item.product.pricing.groupKey === groupKey ? item.quantity : 0), 0);
        }

        function getLinePrice(product, quantityInGroup) {
            const bands = product.pricing.bands;
            if (product.pricing.invalid) return { price: null, tierRange: null };
            if (!bands.length) {
                return product.pricing.fallbackPrice === null
                    ? { price: null, tierRange: null }
                    : { price: product.pricing.fallbackPrice, tierRange: null };
            }

            const matchingBand = bands.find(band => band.openEnded || quantityInGroup <= band.lastQuantity);
            return matchingBand
                ? { price: matchingBand.price, tierRange: getPricingBandLabel(matchingBand) }
                : { price: null, tierRange: null };
        }

        function getCartCalculation() {
            const lines = [...state.cart.values()].map(item => {
                const volume = groupQuantity(item.product.pricing.groupKey);
                const price = getLinePrice(item.product, volume);
                return { ...item, volume, ...price };
            });
            const complete = lines.length > 0 && lines.every(line => line.price !== null);
            const partialProductCents = lines.reduce((sum, line) => sum + (line.price === null ? 0 : cents(line.price) * line.quantity), 0);
            const productCents = complete ? partialProductCents : null;
            const shippingCents = state.shippingMethod === "retirada"
                ? 0
                : (complete ? (productCents > COMMERCIAL_POLICY.freeShippingCents ? 0 : COMMERCIAL_POLICY.standardShippingCents) : null);
            const discountCents = complete ? Math.round(productCents * COMMERCIAL_POLICY.pixDiscountRate) : null;

            return {
                lines,
                complete,
                partialProductCents,
                productCents,
                shippingCents,
                discountCents,
                boletoTotalCents: productCents === null || shippingCents === null ? null : productCents + shippingCents,
                pixTotalCents: productCents === null || shippingCents === null ? null : productCents - discountCents + shippingCents
            };
        }

        function renderTierProgress(calculation) {
            const groups = new Map();
            calculation.lines.forEach(line => {
                if (line.product.pricing.invalid || line.product.pricing.bands.length < 2) return;
                const key = line.product.pricing.groupKey;
                if (!groups.has(key)) {
                    groups.set(key, {
                        name: line.product.pricing.groupName,
                        volume: line.volume,
                        candidates: []
                    });
                }

                const bands = line.product.pricing.bands;
                const currentIndex = bands.findIndex(band => band.openEnded || line.volume <= band.lastQuantity);
                if (currentIndex < 0 || currentIndex >= bands.length - 1) return;
                const nextQuantity = bands[currentIndex + 1].firstQuantity;
                groups.get(key).candidates.push({
                    quantity: nextQuantity,
                    name: line.product.PRODUTO || "Produto",
                    price: bands[currentIndex + 1].price
                });
            });

            const messages = [...groups.values()].map(group => {
                if (!group.candidates.length) {
                    return "<article class=\"orcamento-faixa-progresso__item orcamento-faixa-progresso__item--atingida\"><strong>" +
                        escapeHtml(group.name) + "</strong><p>Os produtos deste grupo já estão na última faixa cadastrada.</p></article>";
                }

                const nextQuantity = Math.min(...group.candidates.map(candidate => candidate.quantity));
                const needed = nextQuantity - group.volume;
                const targets = group.candidates.filter(candidate => candidate.quantity === nextQuantity);
                const visibleTargets = targets.slice(0, 3).map(candidate =>
                    "<span>" + escapeHtml(candidate.name) + ": " + formatCurrency(candidate.price) + "/un.</span>"
                ).join("");
                const additionalTargets = targets.length > 3
                    ? "<span>e mais " + (targets.length - 3) + " " + (targets.length - 3 === 1 ? "produto" : "produtos") + " deste grupo</span>"
                    : "";
                return "<article class=\"orcamento-faixa-progresso__item\"><p>Faltam <strong>" + needed + " " +
                    (needed === 1 ? "unidade" : "unidades") + "</strong> somadas no grupo <strong>" +
                    escapeHtml(group.name) + "</strong> para a próxima faixa, a partir de " + nextQuantity + ".</p><div>" +
                    visibleTargets + additionalTargets + "</div></article>";
            });

            tierProgressElement.innerHTML = messages.length
                ? "<p class=\"orcamento-faixa-progresso__titulo\">Progresso para a próxima faixa</p>" +
                    "<p class=\"orcamento-faixa-progresso__explicacao\">A contagem soma somente produtos com o mesmo grupo de preço cadastrado.</p>" +
                    messages.join("")
                : "";
        }

        function renderCart() {
            const calculation = getCartCalculation();
            state.pricing = calculation;
            const unitCount = calculation.lines.reduce((sum, line) => sum + line.quantity, 0);
            cartCountElement.textContent = `${unitCount} ${unitCount === 1 ? "unidade" : "unidades"}`;
            copyButton.disabled = calculation.lines.length === 0;
            printButton.disabled = calculation.lines.length === 0;

            if (!calculation.lines.length) {
                cartItemsElement.innerHTML = `<div class="orcamento-vazio"><span aria-hidden="true">＋</span><p>Adicione produtos para começar seu orçamento.</p></div>`;
            } else {
                cartItemsElement.innerHTML = calculation.lines.map(line => {
                    let priceDetail;
                    let lineTotal;
                    if (line.price !== null) {
                        priceDetail = line.tierRange
                            ? `Grupo ${escapeHtml(line.product.pricing.groupName)}: ${line.volume} unidades · faixa ${line.tierRange} · ${formatCurrency(line.price)}/un.`
                            : `Preço unitário cadastrado: ${formatCurrency(line.price)}.`;
                        lineTotal = formatCurrency(cents(line.price) * line.quantity / 100);
                    } else if (line.product.pricing.invalid) {
                        priceDetail = "A faixa de preço cadastrada tem dados inválidos. O cálculo foi bloqueado; confirme com a equipe.";
                        lineTotal = "A confirmar";
                    } else {
                        priceDetail = "Não há preço cadastrado para este produto; confirme com a equipe.";
                        lineTotal = "A definir";
                    }
                    const pendingClass = line.price === null ? " orcamento-item__meta--pendente" : "";
                    return `
                        <article class="orcamento-item" data-cart-item data-product-index="${line.product.index}">
                            <p class="orcamento-item__nome">${escapeHtml(line.product.PRODUTO || "Produto")}</p>
                            <div class="orcamento-item__acoes">
                                <label class="sr-only" for="qtd-carrinho-${line.product.index}">Quantidade de ${escapeHtml(line.product.PRODUTO || "produto")}</label>
                                <input id="qtd-carrinho-${line.product.index}" class="orcamento-qtd" data-cart-quantity type="number" min="1" max="${MAX_QUANTITY}" step="1" value="${line.quantity}" inputmode="numeric">
                                <button type="button" class="orcamento-item__remover" data-remove-product aria-label="Remover ${escapeHtml(line.product.PRODUTO || "produto")}">×</button>
                            </div>
                            <p class="orcamento-item__meta${pendingClass}">${priceDetail}</p>
                            <p class="orcamento-item__linha-total">${lineTotal}</p>
                        </article>`;
                }).join("");
            }

            cartItemsElement.querySelectorAll("[data-cart-item]").forEach(card => {
                const quantityInput = card.querySelector("[data-cart-quantity]");
                const name = card.querySelector(".orcamento-item__nome")?.textContent || "produto";
                const quantity = quantityInput?.valueAsNumber || 1;
                if (!quantityInput) return;

                const decreaseButton = document.createElement("button");
                decreaseButton.type = "button";
                decreaseButton.className = "orcamento-item__ajuste";
                decreaseButton.dataset.adjustCart = "menos";
                decreaseButton.disabled = quantity <= 1;
                decreaseButton.setAttribute("aria-label", "Diminuir quantidade de " + name);
                decreaseButton.textContent = "−";
                quantityInput.before(decreaseButton);

                const increaseButton = document.createElement("button");
                increaseButton.type = "button";
                increaseButton.className = "orcamento-item__ajuste";
                increaseButton.dataset.adjustCart = "mais";
                increaseButton.disabled = quantity >= MAX_QUANTITY;
                increaseButton.setAttribute("aria-label", "Aumentar quantidade de " + name);
                increaseButton.textContent = "+";
                quantityInput.after(increaseButton);

                const removeButton = card.querySelector("[data-remove-product]");
                if (removeButton) removeButton.textContent = "Remover";
            });
            renderTierProgress(calculation);
            updateTotals(calculation);
        }

        function updateTotals(calculation) {
            const hasItems = calculation.lines.length > 0;
            const unitCount = calculation.lines.reduce((sum, line) => sum + line.quantity, 0);
            const displayedSubtotal = calculation.complete
                ? formatCurrency(calculation.productCents / 100)
                : (hasItems && calculation.partialProductCents ? `Parcial: ${formatCurrency(calculation.partialProductCents / 100)}` : "Aguardando faixa");
            subtotalElement.textContent = hasItems ? displayedSubtotal : formatCurrency(0);
            shippingElement.textContent = !hasItems
                ? "—"
                : calculation.shippingCents === null
                    ? "Aguardando faixa"
                    : calculation.shippingCents === 0
                        ? "Grátis"
                        : formatCurrency(calculation.shippingCents / 100);
            boletoElement.textContent = calculation.boletoTotalCents === null ? "—" : formatCurrency(calculation.boletoTotalCents / 100);
            pixElement.textContent = calculation.pixTotalCents === null ? "—" : formatCurrency(calculation.pixTotalCents / 100);

            const progressCents = calculation.complete ? calculation.productCents : calculation.partialProductCents;
            const progressPercent = Math.min(100, Math.max(0, (progressCents / COMMERCIAL_POLICY.minimumOrderCents) * 100));
            minimumProgress.style.width = `${progressPercent}%`;
            minimumElement.classList.remove("orcamento-minimo--atingido", "orcamento-minimo--incompleto");

            if (!hasItems) {
                minimumMessage.textContent = "Adicione produtos para ver o progresso do pedido mínimo.";
            } else if (!calculation.complete) {
                minimumElement.classList.add("orcamento-minimo--incompleto");
                minimumMessage.textContent = calculation.lines.some(line => line.product.pricing.invalid)
                    ? "Há uma faixa de preço inválida ou incompleta. O total está bloqueado até a equipe confirmar os dados."
                    : "Há produto sem preço cadastrado. O total está bloqueado até a equipe confirmar os dados.";
            } else if (calculation.productCents >= COMMERCIAL_POLICY.minimumOrderCents) {
                minimumElement.classList.add("orcamento-minimo--atingido");
                minimumMessage.textContent = "Pedido mínimo atingido. O mínimo considera apenas os produtos.";
            } else {
                const remaining = COMMERCIAL_POLICY.minimumOrderCents - calculation.productCents;
                minimumMessage.textContent = `Faltam ${formatCurrency(remaining / 100)} em produtos para atingir o pedido mínimo.`;
            }

            if (!hasItems) {
                quoteNote.classList.remove("orcamento-observacao--alerta");
                quoteNote.textContent = "Os valores são uma simulação com base na tabela atual. A cotação final é confirmada pela equipe antes do pedido.";
            } else if (!calculation.complete) {
                quoteNote.classList.add("orcamento-observacao--alerta");
                quoteNote.textContent = "Ainda não há total confiável porque falta um preço válido na tabela. Confirme os dados com a equipe.";
            } else {
                quoteNote.classList.remove("orcamento-observacao--alerta");
                quoteNote.textContent = `Simulação baseada na tabela atual. O desconto de ${Math.round(COMMERCIAL_POLICY.pixDiscountRate * 100)}% do PIX foi aplicado aos produtos; o frete não recebe desconto. A cotação final é confirmada pela equipe antes do pedido.`;
            }

            const quantityText = `${unitCount} ${unitCount === 1 ? "unidade" : "unidades"}`;
            mobileCount.textContent = `${quantityText} no orçamento`;
            mobileTotalLabel.textContent = !hasItems || !calculation.complete
                ? "Total no boleto"
                : calculation.productCents < COMMERCIAL_POLICY.minimumOrderCents
                    ? "Pedido abaixo do mínimo"
                    : "Total no boleto";
            mobileTotal.textContent = !hasItems
                ? "R$ 0,00"
                : calculation.complete
                    ? formatCurrency(calculation.boletoTotalCents / 100)
                    : "Total a confirmar";
            mobileSummary.hidden = !hasItems;
            document.body.classList.toggle("orcamento-com-itens", hasItems);
            updateMobileSummarySpace();

            const receiving = state.shippingMethod === "retirada"
                ? "Retirada no local, sem frete, a combinar com a equipe"
                : `Entrega com frete ${calculation.shippingCents === null ? "a confirmar" : calculation.shippingCents === 0 ? "grátis" : formatCurrency(calculation.shippingCents / 100)}`;
            const shippingRule = state.shippingMethod === "retirada"
                ? "A retirada não tem custo de frete."
                : `Frete fixo de ${formatCurrency(COMMERCIAL_POLICY.standardShippingCents / 100)}; grátis em compras acima de ${formatCurrency(COMMERCIAL_POLICY.freeShippingCents / 100)}.`;
            printContext.textContent = `${receiving}. ${shippingRule} Pagamento: boleto ${COMMERCIAL_POLICY.boletoTerm}, sem desconto; PIX com ${Math.round(COMMERCIAL_POLICY.pixDiscountRate * 100)}% de desconto nos produtos, sem desconto no frete.`;
        }

        function getQuoteText() {
            const calculation = state.pricing || getCartCalculation();
            const lines = ["SIMULAÇÃO DE ORÇAMENTO — COVIL DO JABUTI", ""];
            calculation.lines.forEach(line => {
                const unit = line.price === null ? "preço a confirmar" : `${formatCurrency(line.price)} por unidade`;
                lines.push(`• ${line.product.PRODUTO} — ${line.quantity} un. — ${unit}`);
                lines.push(`  Grupo ${line.product.pricing.groupName}: ${line.volume} unidades${line.tierRange ? ` (faixa ${line.tierRange})` : ""}`);
            });
            lines.push("");

            if (!calculation.complete) {
                lines.push("Subtotal e total: aguardando confirmação dos preços cadastrados.");
            } else {
                lines.push(`Produtos: ${formatCurrency(calculation.productCents / 100)}`);
                lines.push(`Frete: ${calculation.shippingCents === 0 ? "Grátis" : formatCurrency(calculation.shippingCents / 100)}`);
                lines.push(`Total no boleto: ${formatCurrency(calculation.boletoTotalCents / 100)}`);
                lines.push(`Total no PIX (${Math.round(COMMERCIAL_POLICY.pixDiscountRate * 100)}% de desconto nos produtos): ${formatCurrency(calculation.pixTotalCents / 100)}`);
                lines.push(calculation.productCents >= COMMERCIAL_POLICY.minimumOrderCents ? `Pedido mínimo de ${formatCurrency(COMMERCIAL_POLICY.minimumOrderCents / 100)} atingido.` : `Atenção: simulação abaixo do pedido mínimo de ${formatCurrency(COMMERCIAL_POLICY.minimumOrderCents / 100)} em produtos.`);
            }

            lines.push(`Pagamento: boleto ${COMMERCIAL_POLICY.boletoTerm}, sem desconto; PIX com ${Math.round(COMMERCIAL_POLICY.pixDiscountRate * 100)}% de desconto nos produtos, sem desconto no frete.`);
            lines.push(`Recebimento: ${state.shippingMethod === "retirada" ? "Retirada grátis, a combinar com a equipe" : `Entrega (${formatCurrency(COMMERCIAL_POLICY.standardShippingCents / 100)}; grátis acima de ${formatCurrency(COMMERCIAL_POLICY.freeShippingCents / 100)})`}.`);
            lines.push("Valores estimados com base na tabela atual. A cotação final depende de confirmação da equipe.");
            return lines.join("\n");
        }

        async function copyQuote() {
            try {
                await navigator.clipboard.writeText(getQuoteText());
                feedback.textContent = "Orçamento copiado. Você pode colar onde quiser.";
            } catch {
                const helper = document.createElement("textarea");
                helper.value = getQuoteText();
                helper.setAttribute("readonly", "");
                helper.style.position = "fixed";
                helper.style.opacity = "0";
                document.body.appendChild(helper);
                helper.select();
                const copied = document.execCommand("copy");
                helper.remove();
                feedback.textContent = copied ? "Orçamento copiado. Você pode colar onde quiser." : "Não foi possível copiar. Tente imprimir ou salvar em PDF.";
            }
        }

        function findProduct(index) {
            return state.products.find(product => product.index === Number(index));
        }

        function addProduct(index, amount) {
            const product = findProduct(index);
            if (!product) return null;
            const existing = state.cart.get(product.key);
            const quantity = (existing?.quantity || 0) + amount;
            if (quantity > MAX_QUANTITY) return null;
            state.cart.set(product.key, { product, quantity });
            feedback.textContent = `${product.PRODUTO || "Produto"} adicionado ao orçamento.`;
            renderCart();
            return quantity;
        }

        function setError(error, message = "Não foi possível carregar os produtos agora.") {
            console.error("Não foi possível carregar o simulador de orçamento:", error);
            setStatus(message, "erro");
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "orcamento-retry";
            retry.textContent = "Tentar novamente";
            retry.addEventListener("click", loadCatalog, { once: true });
            catalogStatus.append(" ", retry);
            productCount.textContent = "Indisponível";
        }

        async function loadCatalog() {
            setStatus("Carregando produtos e faixas de preço…");
            productCount.textContent = "Carregando…";
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
            try {
                const apiUrl = await waitForApiConfig();
                const response = await fetch(apiUrl, { signal: controller.signal });
                if (!response.ok) throw new Error(`Falha ao carregar o catálogo (HTTP ${response.status}).`);
                const data = await response.json();
                if (!Array.isArray(data) || !data.length) throw new Error("O catálogo não retornou produtos.");

                state.products = data.map((product, index) => ({
                    ...product,
                    index,
                    key: String(product.COD_SKU_PAI || `produto-${index}`).trim(),
                    pricing: parsePricing(product, index)
                }));
                buildCategories();
                renderProducts();
                setStatus("");
            } catch (error) {
                setError(error, error.name === "AbortError"
                    ? "O catálogo demorou mais de 12 segundos. Verifique sua conexão e tente novamente."
                    : "Não foi possível carregar os produtos agora.");
            } finally {
                window.clearTimeout(timeoutId);
            }
        }

        searchInput.addEventListener("input", () => {
            state.search = searchInput.value.trim();
            renderProducts();
        });
        categorySelect.addEventListener("change", () => {
            state.category = categorySelect.value;
            renderProducts();
        });
        productsGrid.addEventListener("click", event => {
            const detailButton = event.target.closest("[data-view-product]");
            if (detailButton) {
                openProductDialog(detailButton.dataset.productIndex);
                return;
            }
            const button = event.target.closest("[data-add-product]");
            if (!button) {
                const card = event.target.closest("[data-product-card]");
                if (card && !event.target.closest("button, input, select, a, label")) {
                    openProductDialog(card.dataset.productIndex);
                }
                return;
            }
            const card = button.closest("[data-product-card]");
            const quantityInput = card?.querySelector("[data-add-quantity]");
            const quantity = quantityInput?.valueAsNumber;
            if (!quantityInput?.validity.valid || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
                quantityInput?.focus();
                if (quantityInput) quantityInput.setAttribute("aria-invalid", "true");
                const addFeedback = card?.querySelector("[data-add-feedback]");
                if (addFeedback) {
                    addFeedback.classList.add("orcamento-add-feedback--erro");
                    addFeedback.textContent = `Digite um número inteiro entre 1 e ${MAX_QUANTITY}.`;
                }
                setStatus("Corrija a quantidade indicada no produto.", "erro");
                return;
            }
            quantityInput.removeAttribute("aria-invalid");
            const newQuantity = addProduct(card.dataset.productIndex, quantity);
            const product = findProduct(card.dataset.productIndex);
            const addFeedback = card.querySelector("[data-add-feedback]");
            if (newQuantity === null) {
                quantityInput.setAttribute("aria-invalid", "true");
                addFeedback?.classList.add("orcamento-add-feedback--erro");
                if (addFeedback) addFeedback.textContent = `O total deste produto passaria de ${MAX_QUANTITY} unidades. O carrinho manteve a quantidade anterior.`;
                setStatus(`Limite de ${MAX_QUANTITY} unidades por produto. Reduza a quantidade para adicionar.`, "erro");
                return;
            }
            setStatus("");
            if (addFeedback && product) {
                addFeedback.classList.remove("orcamento-add-feedback--erro");
                addFeedback.textContent = `${product.PRODUTO || "Produto"} adicionado. ${newQuantity} ${newQuantity === 1 ? "unidade" : "unidades"} no orçamento.`;
            }
            quantityInput.value = "1";
        });
        productsGrid.addEventListener("input", event => {
            if (!event.target.matches("[data-add-quantity]")) return;
            if (!event.target.validity.valid) return;
            event.target.removeAttribute("aria-invalid");
            const card = event.target.closest("[data-product-card]");
            const addFeedback = card?.querySelector("[data-add-feedback]");
            if (addFeedback?.classList.contains("orcamento-add-feedback--erro")) {
                addFeedback.classList.remove("orcamento-add-feedback--erro");
                addFeedback.textContent = "";
                setStatus("");
            }
        });
        cartItemsElement.addEventListener("change", event => {
            if (!event.target.matches("[data-cart-quantity]")) return;
            const card = event.target.closest("[data-cart-item]");
            const product = findProduct(card?.dataset.productIndex);
            const quantity = event.target.valueAsNumber;
            if (!product) return;
            const previousQuantity = state.cart.get(product.key)?.quantity || 1;
            if (!event.target.validity.valid || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
                event.target.value = String(previousQuantity);
                event.target.removeAttribute("aria-invalid");
                feedback.textContent = `A quantidade de ${product.PRODUTO || "produto"} precisa ser um número inteiro entre 1 e ${MAX_QUANTITY}. O valor anterior foi mantido.`;
                return;
            }
            state.cart.set(product.key, { product, quantity });
            renderCart();
            const updatedInput = cartItemsElement.querySelector(`[data-cart-item][data-product-index="${product.index}"] [data-cart-quantity]`);
            updatedInput?.focus({ preventScroll: true });
        });
        cartItemsElement.addEventListener("click", event => {
            const adjustButton = event.target.closest("[data-adjust-cart]");
            if (adjustButton) {
                const card = adjustButton.closest("[data-cart-item]");
                const product = findProduct(card?.dataset.productIndex);
                const currentQuantity = product ? state.cart.get(product.key)?.quantity : 0;
                const nextQuantity = currentQuantity + (adjustButton.dataset.adjustCart === "mais" ? 1 : -1);
                if (!product || nextQuantity < 1 || nextQuantity > MAX_QUANTITY) return;

                state.cart.set(product.key, { product, quantity: nextQuantity });
                renderCart();
                feedback.textContent = "Quantidade de " + (product.PRODUTO || "produto") + " atualizada.";
                const updatedCard = cartItemsElement.querySelector("[data-cart-item][data-product-index=\"" + product.index + "\"]");
                const nextFocus = adjustButton.dataset.adjustCart === "menos" && nextQuantity === 1
                    ? updatedCard?.querySelector("[data-cart-quantity]")
                    : updatedCard?.querySelector("[data-adjust-cart=\"" + adjustButton.dataset.adjustCart + "\"]");
                nextFocus?.focus({ preventScroll: true });
                return;
            }

            const button = event.target.closest("[data-remove-product]");
            if (!button) return;
            const card = button.closest("[data-cart-item]");
            const product = findProduct(card?.dataset.productIndex);
            if (product) state.cart.delete(product.key);
            feedback.textContent = (product?.PRODUTO || "Produto") + " removido do orçamento.";
            renderCart();
        });
        productDialogContent.addEventListener("click", event => {
            if (event.target.closest("[data-dialog-close]")) {
                if (typeof productDialog.close === "function") productDialog.close();
                else productDialog.removeAttribute("open");
                return;
            }
            const detailButton = event.target.closest("[data-view-product]");
            if (detailButton) {
                openProductDialog(detailButton.dataset.productIndex);
                return;
            }
            const addButton = event.target.closest("[data-dialog-add-product]");
            if (!addButton) return;
            const addedQuantity = addProduct(addButton.dataset.productIndex, 1);
            const dialogFeedback = productDialogContent.querySelector("[data-dialog-feedback]");
            const product = findProduct(addButton.dataset.productIndex);
            if (dialogFeedback) {
                dialogFeedback.textContent = addedQuantity === null
                    ? "O limite deste produto foi atingido. Reduza a quantidade no orçamento para adicionar mais."
                    : (product?.PRODUTO || "Produto") + " adicionado. Ajuste a quantidade no orçamento quando quiser.";
            }
        });
        productDialog.addEventListener("click", event => {
            if (event.target !== productDialog) return;
            if (typeof productDialog.close === "function") productDialog.close();
            else productDialog.removeAttribute("open");
        });
        root.querySelectorAll('input[name="orcamento-entrega"]').forEach(input => {
            input.addEventListener("change", () => {
                if (!input.checked) return;
                state.shippingMethod = input.value;
                renderCart();
            });
        });
        copyButton.addEventListener("click", copyQuote);
        printButton.addEventListener("click", () => window.print());
        viewQuoteButton.addEventListener("click", () => {
            quoteSummary.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
            quoteSummary.focus({ preventScroll: true });
        });
        mobileSummaryResizeObserver?.observe(mobileSummary);
        window.addEventListener("resize", updateMobileSummarySpace, { passive: true });

        renderPolicy();
        renderCart();
        loadCatalog();
    }

    function start() {
        initialize(document.querySelector("[data-orcamento-root]"));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
