(async function () {
    const componentContainer = document.querySelector('div[data-include=\"components/card-products/\"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item;

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente card-products. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        const response = await fetch('/data/card-products.json');

        if (!response.ok) {
            throw new Error(`Erro ao carregar card-products.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            const taglineElement = componentContainer.querySelector('.card-products-tagline');
            const mainTitleElement = componentContainer.querySelector('.card-products-main-title');
            const cardsGridElement = componentContainer.querySelector('.card-products-cards-grid');

            if (taglineElement) {
                taglineElement.textContent = selectedConfig.tagline || '';
            }
            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.title || '';
            }

            if (cardsGridElement && selectedConfig.cards && Array.isArray(selectedConfig.cards)) {
                selectedConfig.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.classList.add('card-products-item');

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-products-content');
                    cardItem.appendChild(cardContent);

                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('card-products-title');
                    cardTitle.textContent = card['card-products-title'] || '';
                    cardContent.appendChild(cardTitle);

                    // --- INÍCIO DA MUDANÇA SIGNIFICATIVA AQUI ---

                    // Adiciona o título da seção TOP (se houver)
                    if (card['card-products-title-top']) {
                        const topSectionTitle = document.createElement('h4');
                        topSectionTitle.classList.add('card-products-title-top'); // Adiciona a nova classe específica
                        topSectionTitle.textContent = card['card-products-title-top'];
                        cardContent.appendChild(topSectionTitle);
                    }

                    // Cria a lista TOP
                    const topList = document.createElement('ul');
                    topList.classList.add('card-products-list-top'); // Muda a classe para 'card-products-list-top'

                    if (card['card-products-top'] && Array.isArray(card['card-products-top'])) {
                        card['card-products-top'].forEach(itemObj => {
                            const listItem = document.createElement('li');
                            listItem.innerHTML = itemObj.item.trim();
                            topList.appendChild(listItem);
                        });
                    }
                    cardContent.appendChild(topList);

                    // Adiciona o título da seção "Indicado para" (se houver)
                    if (card['card-products-title-bottom']) {
                        const bottomSectionTitle = document.createElement('h4');
                        bottomSectionTitle.classList.add('card-products-title-bottom'); // Adiciona a nova classe específica
                        bottomSectionTitle.textContent = card['card-products-title-bottom'];
                        cardContent.appendChild(bottomSectionTitle);
                    }

                    // Cria a lista BOTTOM
                    const bottomList = document.createElement('ul');
                    bottomList.classList.add('card-products-list-bottom'); // Muda a classe para 'card-products-list-bottom'

                    if (card['card-products-bottom'] && Array.isArray(card['card-products-bottom'])) {
                        card['card-products-bottom'].forEach(itemObj => {
                            const listItem = document.createElement('li');
                            listItem.innerHTML = itemObj.item.trim();
                            bottomList.appendChild(listItem);
                        });
                    }
                    cardContent.appendChild(bottomList);

                    // --- FIM DA MUDANÇA SIGNIFICATIVA AQUI ---

                    cardsGridElement.appendChild(cardItem);
                });
            } else {
                console.warn(`Nenhum 'cards' definido ou não é um array para a configuração \"${dataItem}\".`);
            }

        } else {
            console.warn(`Configuração com id=\"${dataItem}\" não encontrada em card-products.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar card-products.json:", error);
        componentContainer.innerHTML = `<p style=\"color: red;\">Erro ao carregar o componente de cards de produtos.</p>`;
    }
})();