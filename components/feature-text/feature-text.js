(async function () {
    const componentContainer = document.querySelector('div[data-include="components/feature-text/"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item;

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente feature-text. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        const response = await fetch('data/feature-text.json'); // Caminho para o JSON

        if (!response.ok) {
            throw new Error(`Erro ao carregar feature-text-data.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            // Elementos do cabeçalho
            const taglineElement = componentContainer.querySelector('.feature-text-tagline');
            const mainTitleElement = componentContainer.querySelector('.feature-text-main-title');
            const cardsGridElement = componentContainer.querySelector('.feature-text-cards-grid');

            // Preenche o cabeçalho
            if (taglineElement) {
                taglineElement.textContent = selectedConfig.tagline || '';
            }
            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.mainTitle || '';
            }
            // A barra amarela é estática no HTML, não precisa de JS para preencher.

            // Preenche os cards
            if (cardsGridElement && selectedConfig.cards && Array.isArray(selectedConfig.cards)) {
                cardsGridElement.innerHTML = ''; // Limpa qualquer conteúdo pré-existente

                selectedConfig.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.classList.add('feature-text-card-item');

                    const topColorBar = document.createElement('div');
                    topColorBar.classList.add('feature-text-card-top-color');
                    // Opcional: se quiser cores diferentes para cada card, pode adicionar aqui:
                    // if (card.color) {
                    //     topColorBar.style.backgroundColor = card.color;
                    // }
                    cardItem.appendChild(topColorBar);

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('feature-text-card-content');

                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('feature-text-card-title');
                    cardTitle.textContent = card.title || '';
                    cardContent.appendChild(cardTitle);

                    const separator1 = document.createElement('div');
                    separator1.classList.add('feature-text-card-separator-line');
                    cardContent.appendChild(separator1);

                    const cardText = document.createElement('p');
                    cardText.classList.add('feature-text-card-text');
                    cardText.innerHTML = card.text || ''; // Usar innerHTML para quebras de linha
                    cardContent.appendChild(cardText);

                    const separator2 = document.createElement('div');
                    separator2.classList.add('feature-text-card-separator-line');
                    cardContent.appendChild(separator2);

                    const cardSmallText = document.createElement('p');
                    cardSmallText.classList.add('feature-text-card-small-text');
                    cardSmallText.innerHTML = card.smallText || ''; // Usar innerHTML para quebras de linha
                    cardContent.appendChild(cardSmallText);

                    cardItem.appendChild(cardContent);
                    cardsGridElement.appendChild(cardItem);
                });
            } else {
                console.warn(`Nenhum 'cards' definido ou não é um array para a configuração "${dataItem}".`);
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em feature-text-data.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar feature-text-data.json:", error);
        componentContainer.innerHTML = `<p style="color: red;">Erro ao carregar o componente de texto com cards.</p>`;
    }
})();