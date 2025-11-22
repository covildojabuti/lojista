(async function () {
    const imagesPath = "/lojista/app_produtos";
    // acha o container do componente
    const produtosContainer = document.querySelector('div[data-include="components/list-products/"]');
    if (!produtosContainer) {
        return;
    }

    try {
        // URL do seu Apps Script publicado como Web App
        const response = await fetch('https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjTeU-w-TS_0XGRT0t7nDx-oPAwDxwFs12btWC2tZyTjGa-yeXFfQuSBDqNOrHi7KzlmWbDQudV__JQRf3rXrkNnzZNuKd-xJWVwwu6nrw0bITUWPay6g-xfiaagQxfi0F1qsczJDz9Js_rGgEhO5Io6k5g7D_XglBJdgQZxyIqgI8eE1wGBTh_KeEaefQlDFEvJ2DP_zj7gQ-f2bLLeZMhJuBhzngSYbQCnuUdwXRUYtA3h8JzCG3AHKnsD4_yet-8pJFJGHL_PKsdjOSLZdM12hqL0w&lib=MIVoeNtO2B_EZbU58-N4OZFvZJuLBquZd');
        const produtos = await response.json();

        if (!Array.isArray(produtos) || produtos.length === 0) {
            produtosContainer.innerHTML = '<p>Nenhum produto encontrado.</p>';
            return;
        }

        // monta o HTML do grid
        const gridHtml = `
    <table class="produtos-tabela">
    <thead>
        <tr>
            <th>Foto</th>
            <th>Produto</th>
            <th>MOQ</th>
            <th>Video</th>
        </tr>
    </thead>
    <tbody>
        ${produtos.map(p => `
            <tr>
                <td>
                    <img class="produto-img-small" src="${imagesPath}/${p.URL_IMG}" alt="${p.PRODUTO}">
                </td>
                <td>${p.PRODUTO}</td>
                <td><pre style="white-space: pre-wrap; margin:0">${p.MOQ}</pre></td>
                <td>
                    <a href="${p.URL_VIDEO}" target="_blank">
                        <i class="fab fa-youtube youtube-icon"></i>
                    </a>
                </td>
            </tr>
        `).join('')}
    </tbody>
</table>
`;

        produtosContainer.innerHTML = gridHtml;

    } catch (error) {
        console.error('Erro ao carregar produtos do Google Sheets:', error);
        produtosContainer.innerHTML = '<p style="color:red">Erro ao carregar produtos.</p>';
    }
})();
