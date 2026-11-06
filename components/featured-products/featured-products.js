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

    try {
        // API original
        const response = await fetch(Config.APIS.BD_Produtos);
        const produtos = await response.json();

        if (!Array.isArray(produtos) || produtos.length === 0) {
            produtosContainer.innerHTML = '<p>Nenhum produto encontrado.</p>';
            return;
        }

        // filtra somente destaque = Sim
        const destaques = produtos.filter(p => {
            const flag = String(p.DESTAQUE || p.destaque || '').trim().toLowerCase();
            return flag === 'sim' || flag === 's';
        });

        if (destaques.length === 0) {
            produtosContainer.innerHTML = '<p>Nenhum produto em destaque no momento.</p>';
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
                        ${image ? `<a href="/pages/produtos/" aria-label="Ver ${name} no catálogo"><img src="${escapeHtml(image)}" alt="${name}" loading="lazy" decoding="async"></a>` : ''}
                        <div class="produto-nome"><a href="/pages/produtos/">${name}</a>${video ? ` <a href="${escapeHtml(video)}" target="_blank" rel="noopener noreferrer" aria-label="Assistir ao vídeo de ${name}"><i class="fab fa-youtube youtube-icon" aria-hidden="true"></i></a>` : ''}</div>
                        <div class="produto-moq">
                            <a href="/pages/produtos/" aria-label="Consultar ${name} no catálogo">
                                <span>De <s>${formatCurrency(p.DE)}</s></span>
                                <span>Por <strong>${formatCurrency(p.POR)}</strong></span>
                                <small>A partir do preço unitário</small>
                            </a>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        `;

        // mantém o título fixo + cards
        produtosContainer.innerHTML = `
            <div class="produtos-destaque-titulo">PRODUTOS EM DESTAQUE</div>
            ${cardsHtml}
        `;

    } catch (error) {
        console.error('Erro ao carregar produtos em destaque:', error);
        produtosContainer.innerHTML = '<p style="color:red">Erro ao carregar produtos em destaque.</p>';
    }
})();
