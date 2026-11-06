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
            const tiers = product.pricing.tiers.map(tier => `${tier.quantity}+ ${formatCurrency(tier.price)}`).join(" · ");
            return `Faixas do grupo: ${tiers} <strong>por unidade</strong>`;
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
        }

        function groupQuantity(groupKey) {
            return [...state.cart.values()].reduce((sum, item) => sum + (item.product.pricing.groupKey === groupKey ? item.quantity : 0), 0);
        }

        function getLinePrice(product, quantityInGroup) {
            const tiers = product.pricing.tiers;
            if (product.pricing.invalid) return { price: null, tier: null, minimum: null };
            if (!tiers.length) {
                return product.pricing.fallbackPrice === null
                    ? { price: null, tier: null, minimum: null }
                    : { price: product.pricing.fallbackPrice, tier: null, minimum: null };
            }

            const matchingTier = tiers.filter(tier => tier.quantity <= quantityInGroup).at(-1);
            return matchingTier
                ? { price: matchingTier.price, tier: matchingTier.quantity, minimum: tiers[0].quantity }
                : { price: null, tier: null, minimum: tiers[0].quantity };
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
                        priceDetail = line.tier
                            ? `Grupo ${escapeHtml(line.product.pricing.groupName)}: ${line.volume} unidades · faixa ${line.tier}+ · ${formatCurrency(line.price)}/un.`
                            : `Preço unitário cadastrado: ${formatCurrency(line.price)}.`;
                        lineTotal = formatCurrency(cents(line.price) * line.quantity / 100);
                    } else if (line.minimum) {
                        const needed = Math.max(0, line.minimum - line.volume);
                        priceDetail = `Faixa inicial: ${line.minimum} unidades no grupo ${escapeHtml(line.product.pricing.groupName)}. ${needed ? `Faltam ${needed} para alcançar a primeira faixa.` : "Preço desta faixa precisa ser confirmado."}`;
                        lineTotal = "A definir";
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
                    : "Há grupos abaixo da primeira faixa. Ajuste as quantidades para calcular um subtotal completo.";
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
                quoteNote.textContent = "Ainda não há total confiável: a quantidade pode estar abaixo da primeira faixa, ou a tabela pode conter um preço ausente ou inválido. Ajuste as quantidades ou confirme com a equipe.";
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
                lines.push(`  Grupo ${line.product.pricing.groupName}: ${line.volume} unidades${line.tier ? ` (faixa ${line.tier}+)` : ""}`);
            });
            lines.push("");

            if (!calculation.complete) {
                lines.push("Subtotal e total: aguardando quantidade mínima da faixa ou confirmação de preço.");
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
            const button = event.target.closest("[data-add-product]");
            if (!button) return;
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
            const button = event.target.closest("[data-remove-product]");
            if (!button) return;
            const card = button.closest("[data-cart-item]");
            const product = findProduct(card?.dataset.productIndex);
            if (product) state.cart.delete(product.key);
            feedback.textContent = "Produto removido do orçamento.";
            renderCart();
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
