(async function () {
    const imagesPath = "/lojista/app_produtos";

    const produtosContainer = document.querySelector('div[data-include="components/list-products/"]');
    if (!produtosContainer) {
        return;
    }

    function normalizar(valor) {
        if (valor === undefined || valor === null || valor === '') return '-';
        return String(valor);
    }

    function parsePreco(valorBruto) {
        if (!valorBruto) return NaN;
        let s = String(valorBruto).trim();

        // remove R$, espaços e pontos de milhar
        s = s.replace(/R\$/i, '').replace(/\./g, '').replace(/\s/g, '');
        // troca vírgula por ponto
        s = s.replace(/,/g, '.');

        const num = parseFloat(s);
        return isNaN(num) ? NaN : num;
    }

    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbyWlXvDNMRxE31A85_EUzJlcDI-1WxSYMxfzv6JRrOcEpvvVZ_S8myUodEaky2xy72w/exec');
        const produtos = await response.json();

        if (!Array.isArray(produtos) || produtos.length === 0) {
            produtosContainer.innerHTML = '<p>Nenhum produto encontrado.</p>';
            return;
        }

        // listas únicas de categoria e subcategoria para os filtros
        const categorias = [...new Set(produtos.map(p => p.CATEGORIA).filter(Boolean))].sort();
        const subcategorias = [...new Set(produtos.map(p => p.SUBCATEGORIA).filter(Boolean))].sort();

        const filtrosHtml = `
      <div class="produtos-filtros">
        <h3>Filtros</h3>

        <label for="filtro-categoria">Categoria</label>
        <select id="filtro-categoria">
          <option value="">Todas</option>
          ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>

        <label for="filtro-subcategoria">Subcategoria</label>
        <select id="filtro-subcategoria">
          <option value="">Todas</option>
          ${subcategorias.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>

        <label for="filtro-preco-max">Preço máximo</label>
        <input id="filtro-preco-max" type="number" min="0" step="0.01" placeholder="Sem limite" />
        <small>Deixe em branco para não filtrar por preço.</small>
      </div>
        `;

        const gridHtml = `
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
      <tbody>
        <!-- linhas geradas via JS -->
      </tbody>
    </table>
  </div>

  <div class="produto-detalhes-card hidden" id="produto-detalhes-card">
    <p>Selecione um produto na tabela para ver os detalhes.</p>
  </div>
</div>
        `;

        produtosContainer.innerHTML = gridHtml;

        const tabelaBody = produtosContainer.querySelector('.produtos-tabela tbody');
        const detalhesCard = produtosContainer.querySelector('#produto-detalhes-card');

        const filtroCategoria = produtosContainer.querySelector('#filtro-categoria');
        const filtroSubcategoria = produtosContainer.querySelector('#filtro-subcategoria');
        const filtroPrecoMax = produtosContainer.querySelector('#filtro-preco-max');

        // índice dos produtos atualmente filtrados (sempre referenciando o array original)
        let indicesFiltrados = produtos.map((_, i) => i);
        let linhaSelecionada = null;

        function montarConteudoDetalhes(p) {
            const imgUrl = p.URL_IMG ? `${imagesPath}/${p.URL_IMG}` : '';

            const skuPai = normalizar(p.COD_SKU_PAI);
            const categoria = normalizar(p.CATEGORIA);
            const subcategoria = normalizar(p.SUBCATEGORIA);
            const produtoNome = normalizar(p.PRODUTO);
            const descricao = normalizar(p.DESCRICAO);
            const dePreco = normalizar(p.DE);
            const porPreco = normalizar(p.POR);
            const mqq = normalizar(p.MOQ);
            const peso = normalizar(p.PESO);
            const tamanhoLados = normalizar(p["TAMANHO LADOS (MM)"]);
            const destaque = normalizar(p.DESTAQUE);
            const videoUrl = p.URL_VIDEO || '';
            const itens_inclusos = normalizar(p.ITENS_INCLUSOS);
            const caracteristicas = normalizar(p.CARACTERISTICAS);

            return `
  <div class="produto-detalhes-header">
    ${imgUrl
                    ? `<img src="${imgUrl}" alt="${produtoNome}">`
                    : ''
                }
    <div>
      <div class="produto-detalhes-titulo">${produtoNome}</div>
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

    <div class="produto-detalhes-descricao">
      <span class="produto-detalhes-label">Descrição:</span><br>
      ${descricao}<br>
      <span class="produto-detalhes-label">Itens Inclusos:</span><br>
      ${itens_inclusos}<br>
      <span class="produto-detalhes-label">Características:</span><br>
      ${caracteristicas}<br>
    </div>

    <div class="produto-detalhes-video" style="margin-top:8px;">
      <span class="produto-detalhes-label">Vídeo:</span><br>
      ${videoUrl
                    ? `<a href="${videoUrl}" target="_blank" rel="noopener noreferrer">
             <i class="fab fa-youtube"></i> Abrir vídeo
           </a>`
                    : 'Nenhum video informado.'
                }
    </div>
  </div>
            `;
        }

        function renderTabela() {
            // limpa corpo
            tabelaBody.innerHTML = '';

            // remove qualquer linha de detalhes mobile anterior
            const detalhesRowAnterior = produtosContainer.querySelector('.produto-detalhes-row');
            if (detalhesRowAnterior) {
                detalhesRowAnterior.remove();
            }

            // remove seleção visual
            linhaSelecionada = null;

            const linhasHtml = indicesFiltrados.map(indexOriginal => {
                const p = produtos[indexOriginal];
                return `
          <tr data-index="${indexOriginal}">
            <td>
              <img class="produto-img-small" src="${imagesPath}/${p.URL_IMG}" alt="${p.PRODUTO || ''}">
            </td>
            <td>${p.PRODUTO || ''}</td>
            <td><pre style="white-space: pre-wrap; margin:0">${p.MOQ || ''}</pre></td>
            <td>
              ${p.URL_VIDEO
                        ? `<a href="${p.URL_VIDEO}" target="_blank" rel="noopener noreferrer">
                     <i class="fab fa-youtube youtube-icon"></i>
                   </a>`
                        : '-'
                    }
            </td>
          </tr>
                `;
            }).join('');

            tabelaBody.innerHTML = linhasHtml;

            attachRowListeners();
        }

        function attachRowListeners() {
            const linhas = tabelaBody.querySelectorAll('tr');

            linhas.forEach(linha => {
                linha.addEventListener('click', () => {
                    const index = parseInt(linha.getAttribute('data-index'), 10);
                    const p = produtos[index];

                    // feedback visual
                    if (linhaSelecionada) {
                        linhaSelecionada.classList.remove('selecionado');
                    }
                    linhaSelecionada = linha;
                    linhaSelecionada.classList.add('selecionado');

                    const conteudo = montarConteudoDetalhes(p);

                    const isDesktop = window.innerWidth >= 768;

                    if (isDesktop) {
                        // mostra no card lateral (desktop)
                        detalhesCard.innerHTML = conteudo;
                        detalhesCard.classList.remove('hidden');

                        // garante que não fica detalhe duplicado no mobile
                        const detalhesRow = produtosContainer.querySelector('.produto-detalhes-row');
                        if (detalhesRow) detalhesRow.remove();
                    } else {
                        // mobile: abaixo da linha clicada
                        const tabela = produtosContainer.querySelector('.produtos-tabela');
                        const detalhesRowAnterior = tabela.querySelector('.produto-detalhes-row');
                        if (detalhesRowAnterior) {
                            detalhesRowAnterior.remove();
                        }

                        const detalhesRow = document.createElement('tr');
                        detalhesRow.className = 'produto-detalhes-row';
                        const cell = document.createElement('td');
                        cell.colSpan = 4;
                        cell.innerHTML = conteudo;
                        detalhesRow.appendChild(cell);

                        linha.insertAdjacentElement('afterend', detalhesRow);
                    }
                });
            });
        }

        function aplicarFiltros() {
            const categoriaSelecionada = filtroCategoria.value;
            const subcategoriaSelecionada = filtroSubcategoria.value;
            const precoMaxStr = filtroPrecoMax.value;
            const precoMax = precoMaxStr ? parseFloat(precoMaxStr) : NaN;

            indicesFiltrados = produtos
                .map((p, idx) => ({ p, idx }))
                .filter(({ p }) => {
                    // categoria
                    if (categoriaSelecionada && p.CATEGORIA !== categoriaSelecionada) {
                        return false;
                    }
                    // subcategoria
                    if (subcategoriaSelecionada && p.SUBCATEGORIA !== subcategoriaSelecionada) {
                        return false;
                    }
                    // preço máximo
                    if (!isNaN(precoMax)) {
                        const precoPor = parsePreco(p.POR);
                        if (isNaN(precoPor) || precoPor > precoMax) {
                            return false;
                        }
                    }
                    return true;
                })
                .map(({ idx }) => idx);

            renderTabela();

            // no desktop, já abre o primeiro produto filtrado
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop && indicesFiltrados.length > 0) {
                const primeiraLinha = tabelaBody.querySelector('tr');
                if (primeiraLinha) {
                    primeiraLinha.click();
                }
            } else {
                // limpa card lateral se mobile ou se não há itens
                detalhesCard.classList.add('hidden');
                detalhesCard.innerHTML = '<p>Selecione um produto na tabela para ver os detalhes.</p>';
            }
        }

        // listeners dos filtros
        filtroCategoria.addEventListener('change', aplicarFiltros);
        filtroSubcategoria.addEventListener('change', aplicarFiltros);
        filtroPrecoMax.addEventListener('input', aplicarFiltros);

        // render inicial (sem filtros)
        renderTabela();

        // no desktop, já abre o primeiro produto ao carregar
        if (window.innerWidth >= 768 && indicesFiltrados.length > 0) {
            const primeiraLinha = tabelaBody.querySelector('tr');
            if (primeiraLinha) {
                primeiraLinha.click();
            }
        }

    } catch (error) {
        console.error('Erro ao carregar produtos do Google Sheets:', error);
        produtosContainer.innerHTML = '<p style="color:red">Erro ao carregar produtos.</p>';
    }
})();
