(async function () {
    const imagesPath = "/lojista/app_produtos";
    // container do componente
    const produtosContainer = document.querySelector('div[data-include="components/featured-products/"]');
    if (!produtosContainer) {
        return;
    }

    try {
        // API original
        const response = await fetch(
            'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjTeU-w-TS_0XGRT0t7nDx-oPAwDxwFs12btWC2tZyTjGa-yeXFfQuSBDqNOrHi7KzlmWbDQudV__JQRf3rXrkNnzZNuKd-xJWVwwu6nrw0bITUWPay6g-xfiaagQxfi0F1qsczJDz9Js_rGgEhO5Io6k5g7D_XglBJdgQZxyIqgI8eE1wGBTh_KeEaefQlDFEvJ2DP_zj7gQ-f2bLLeZMhJuBhzngSYbQCnuUdwXRUYtA3h8JzCG3AHKnsD4_yet-8pJFJGHL_PKsdjOSLZdM12hqL0w&lib=MIVoeNtO2B_EZbU58-N4OZFvZJuLBquZd'
        );

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
                ${destaques.map(p => `
                    <div class="produto-card">
                    <a href="/lojista/pages/produtos/">
                        <img src="${imagesPath}/${p.URL_IMG}" alt="${p.PRODUTO}">

                        <div class="produto-nome">${p.PRODUTO}</div>

                        <div class="produto-moq">
                            A partir de <span>${p.MOQ || ''}</span>
                        </div>
                        </a>
                    </div>
                `).join('')}
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
