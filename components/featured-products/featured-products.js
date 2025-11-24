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
            'https://script.google.com/macros/s/AKfycbxq6BAFL-epHFPDP52rgCYexbRELc9qYbdt6kMq5h8d_ZP57RBbDQV32Uy4tOVuD5Xy/exec'
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
                    
                        <a href="/lojista/pages/produtos/"><img src="${p.URL_IMG}" alt="${p.PRODUTO}"></a>

                        <div class="produto-nome"><a href="/lojista/pages/produtos/">${p.PRODUTO}</a> <a href="${p.URL_VIDEO}" target="_blank"><i class="fab fa-youtube youtube-icon"></i></a></div>


                    

                        <div class="produto-moq">
                           <a href="/lojista/pages/produtos/"> <span>De <span><span style="text-decoration: line-through;">${(p.DE ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }</span> por <span style="font-size:xx-small;">(a partir de) </span><span>${(p.POR ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }</span> </a>
                        </div>
                        
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
