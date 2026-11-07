(async function () {
    // container do componente
    const produtosContainer = document.querySelector('div[data-include="components/featured-products/"]');
    if (!produtosContainer) {
        return;
    }

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
    const formatCurrency = value => {
        const raw = String(value ?? '').trim();
        const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
        const amount = Number(normalized);
        return Number.isFinite(amount)
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
            : 'Consulte';
    };

    const policyHeading = `
        <div class="featured-policy-heading">
            <p class="featured-products-section__eyebrow">Condições especiais para lojistas</p>
            <h2 id="featured-policy-title">Mais valor em cada reposição.</h2>
            <p>Vantagens claras para você planejar suas compras, aproveitar melhores faixas e cuidar da margem da sua loja.</p>
        </div>
    `;
    const policyDetails = `
        <div class="featured-policy-grid" aria-label="Condições para lojistas">
            <article class="featured-policy-card">
                <span class="featured-policy-card__icon" aria-hidden="true"><i class="fas fa-receipt"></i></span>
                <div class="featured-policy-card__content">
                    <h3>Pedido mínimo</h3>
                    <p class="featured-policy-card__value">R$ 500,00</p>
                    <p class="featured-policy-card__detail">Em produtos; frete calculado à parte.</p>
                </div>
            </article>
            <article class="featured-policy-card">
                <span class="featured-policy-card__icon" aria-hidden="true"><i class="fas fa-truck"></i></span>
                <div class="featured-policy-card__content">
                    <h3>Frete para entrega</h3>
                    <p class="featured-policy-card__value">R$ 100,00 fixo</p>
                    <p class="featured-policy-card__detail">Grátis em compras acima de R$ 3.000,00.</p>
                </div>
            </article>
            <article class="featured-policy-card">
                <span class="featured-policy-card__icon" aria-hidden="true"><i class="fas fa-layer-group"></i></span>
                <div class="featured-policy-card__content">
                    <h3>Desconto por volume</h3>
                    <p class="featured-policy-card__value">Mais unidades, melhor preço</p>
                    <p class="featured-policy-card__detail">As faixas consideram a quantidade somada de produtos do mesmo grupo.</p>
                </div>
            </article>
            <article class="featured-policy-card">
                <span class="featured-policy-card__icon" aria-hidden="true"><i class="fas fa-credit-card"></i></span>
                <div class="featured-policy-card__content">
                    <h3>Pagamento</h3>
                    <p class="featured-policy-card__value">2% de desconto no PIX</p>
                    <p class="featured-policy-card__detail">Nos produtos; frete sem desconto. Boleto 15/30 dias.</p>
                </div>
            </article>
        </div>
    `;
    const productHeading = `
        <div class="featured-products-section__heading">
            <p class="featured-products-section__eyebrow">Uma seleção do nosso catálogo</p>
            <h2 id="featured-products-title">Destaques para sua loja</h2>
            <p>Conheça produtos que chamam atenção na mesa. Os valores exibidos são unitários de referência; a faixa aplicada depende da quantidade somada no grupo e aparece no orçamento.</p>
        </div>
    `;
    const renderSection = content => `
        <section class="featured-products-section" aria-labelledby="featured-policy-title" aria-busy="false">
            ${policyHeading}
            ${policyDetails}
            ${productHeading}
            ${content}
        </section>
    `;

    try {
        // API original
        const response = await fetch(Config.APIS.BD_Produtos);
        const produtos = await response.json();

        if (!Array.isArray(produtos) || produtos.length === 0) {
            produtosContainer.innerHTML = renderSection('<p class="featured-products-empty">Nenhum produto em destaque está disponível agora.</p><div class="featured-products-section__footer"><a class="featured-products-section__link" href="/pages/produtos/#orcamento-catalogo-titulo">Ver catálogo <span aria-hidden="true">→</span></a></div>');
            return;
        }

        // filtra somente destaque = Sim
        const destaques = produtos.filter(p => {
            const flag = String(p.DESTAQUE || p.destaque || '').trim().toLowerCase();
            return flag === 'sim' || flag === 's';
        });

        if (destaques.length === 0) {
            produtosContainer.innerHTML = renderSection('<p class="featured-products-empty">Não há destaques disponíveis agora.</p><div class="featured-products-section__footer"><a class="featured-products-section__link" href="/pages/produtos/#orcamento-catalogo-titulo">Ver catálogo <span aria-hidden="true">→</span></a></div>');
            return;
        }

        // monta HTML
        const cardsHtml = `
            <div class="produtos-grid">
                ${destaques.map(p => {
                    const name = escapeHtml(p.PRODUTO || 'Produto');
                    const image = safeHttpUrl(p.URL_IMG);
                    const video = safeExternalUrl(p.URL_VIDEO);
                    return `
                    <div class="produto-card">
                        ${image ? `<a href="/pages/produtos/#orcamento-catalogo-titulo" aria-label="Escolher ${name} para o orçamento"><img src="${escapeHtml(image)}" alt="${name}" loading="lazy" decoding="async"></a>` : ''}
                        <div class="produto-nome"><a href="/pages/produtos/#orcamento-catalogo-titulo">${name}</a>${video ? ` <a href="${escapeHtml(video)}" target="_blank" rel="noopener noreferrer" aria-label="Assistir ao vídeo de ${name}"><i class="fab fa-youtube youtube-icon" aria-hidden="true"></i></a>` : ''}</div>
                        <div class="produto-moq">
                            <a href="/pages/produtos/#orcamento-catalogo-titulo" aria-label="Simular ${name} para revenda">
                                <span>De <s>${formatCurrency(p.DE)}</s></span>
                                <span>Por <strong>${formatCurrency(p.POR)}</strong></span>
                                <small>Valor inicial por unidade · veja as faixas no orçamento</small>
                            </a>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        `;

        produtosContainer.innerHTML = renderSection(`${cardsHtml}
            <div class="featured-products-section__footer">
                <a class="featured-products-section__link" href="/pages/produtos/#orcamento-catalogo-titulo">Montar meu orçamento <span aria-hidden="true">→</span></a>
            </div>
        `);

    } catch (error) {
        console.error('Erro ao carregar produtos em destaque:', error);
        produtosContainer.innerHTML = renderSection('<p class="featured-products-empty">Não foi possível carregar os destaques agora. O catálogo completo continua disponível.</p><div class="featured-products-section__footer"><a class="featured-products-section__link" href="/pages/produtos/#orcamento-catalogo-titulo">Ver catálogo <span aria-hidden="true">→</span></a></div>');
    }
})();
