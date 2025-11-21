(async function () {
    const componentContainer = document.querySelector('div[data-include="components/feature-cards/"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item;

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente feature-cards. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        const response = await fetch('/data/feature-cards.json');

        if (!response.ok) {
            throw new Error(`Erro ao carregar feature-cards-data.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            // **AJUSTE AQUI**: Novos seletores para o título e chamada
            const mainTitleElement = componentContainer.querySelector('.feature-cards-main-title'); // Novo seletor
            const taglineElement = componentContainer.querySelector('.feature-cards-tagline');   // Novo seletor
            const gridElement = componentContainer.querySelector('.feature-cards-grid');

            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.mainTitle || ''; // 'mainTitle' do JSON vai para o h2
            }
            if (taglineElement) {
                taglineElement.textContent = selectedConfig.mainSubtitle || ''; // 'mainSubtitle' do JSON vai para o p (tagline)
            }

            if (gridElement && selectedConfig.cards) {
                gridElement.innerHTML = '';

                selectedConfig.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.classList.add('feature-card-item');

                    if (card.imageUrl) {
                        const img = document.createElement('img');
                        img.src = card.imageUrl;
                        img.alt = card.title || 'Imagem do Card';
                        img.classList.add('feature-card-image');
                        cardItem.appendChild(img);
                    }

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('feature-card-content');

                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('feature-card-title');
                    cardTitle.textContent = card.title || '';
                    cardContent.appendChild(cardTitle);

                    const cardText = document.createElement('p');
                    cardText.classList.add('feature-card-text');
                    cardText.textContent = card.text || '';
                    cardContent.appendChild(cardText);

                    if (card.linkUrl && card.linkText) {
                        const cardLink = document.createElement('a');
                        cardLink.href = card.linkUrl;
                        cardLink.textContent = card.linkText;
                        cardLink.classList.add('feature-card-link');
                        cardContent.appendChild(cardLink);
                    }

                    cardItem.appendChild(cardContent);
                    gridElement.appendChild(cardItem);
                });
            } else {
                console.warn(`Elemento '.feature-cards-grid' não encontrado ou 'cards' não definidos para a configuração "${dataItem}".`);
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em feature-cards-data.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar feature-cards-data.json:", error);
        componentContainer.innerHTML = `<p style="color: red;">Erro ao carregar o componente de cards.</p>`;
    }
})();