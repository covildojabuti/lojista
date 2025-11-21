// A função main para encapsular a lógica do componente
async function loadCardCasesComponent() {
    // Seleciona TODOS os containers do componente card-cases na página
    const componentContainers = document.querySelectorAll('div[data-include="components/card-cases/"]');

    if (componentContainers.length === 0) {
        // Se não houver containers, não há nada para fazer
        return;
    }

    // Carrega o JSON apenas UMA VEZ para todas as instâncias do componente
    let allConfigs = [];
    try {
        const response = await fetch('/data/card-cases.json');
        if (!response.ok) {
            throw new Error(`Erro ao carregar card-cases.json: ${response.statusText}`);
        }
        allConfigs = await response.json();
    } catch (error) {
        console.error("Erro ao carregar ou processar card-cases.json:", error);
        // Exibe uma mensagem de erro em todos os containers
        componentContainers.forEach(container => {
            container.innerHTML = `<p style="color: red;">Erro ao carregar o componente de cases.</p>`;
        });
        return; // Sai da função se o JSON não puder ser carregado
    }

    // Itera sobre cada container encontrado
    for (const componentContainer of componentContainers) { // Usar for...of para async/await se necessário, ou apenas forEach
        // Verifica se o componente já foi processado para evitar duplicação
        if (componentContainer.dataset.processed === 'true') {
            continue; // Pula para a próxima iteração se já foi processado
        }

        const dataItem = componentContainer.dataset.item;

        if (!dataItem) {
            console.warn("Nenhum 'data-item' especificado para um componente card-cases. Adicione data-item='seuConfigId' ao div.", componentContainer);
            continue; // Pula para a próxima iteração
        }

        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            // AQUI ESTÁ A MUDANÇA CRÍTICA:
            // O componente já foi injetado pelo sistema de `data-include`.
            // Agora, vamos encontrar o grid DENTRO DESTE CONTAINER ESPECÍFICO.
            const cardsGridElement = componentContainer.querySelector('.card-cases-grid');

            if (cardsGridElement && selectedConfig.cards && Array.isArray(selectedConfig.cards)) {
                // Limpa o conteúdo *apenas do grid* antes de popular
                cardsGridElement.innerHTML = '';

                selectedConfig.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.classList.add('card-cases-item');

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-cases-content');
                    cardItem.appendChild(cardContent);

                    const cardTagline = document.createElement('p');
                    cardTagline.classList.add('card-cases-tagline');
                    cardTagline.textContent = card['card-cases-tagline'] || '';
                    cardContent.appendChild(cardTagline);

                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('card-cases-title');
                    cardTitle.textContent = card['card-cases-title'] || '';
                    cardContent.appendChild(cardTitle);

                    const cardText = document.createElement('p');
                    cardText.classList.add('card-cases-text');
                    cardText.textContent = card['card-cases-text'] || '';
                    cardContent.appendChild(cardText);

                    cardsGridElement.appendChild(cardItem);
                });
                // Marca o componente como processado
                componentContainer.dataset.processed = 'true';

            } else {
                console.warn(`Nenhum '.card-cases-grid' encontrado no container ou nenhum 'cards' definido para a configuração \"${dataItem}\".`, componentContainer);
            }

        } else {
            console.warn(`Configuração com id=\"${dataItem}\" não encontrada em card-cases.json.`, componentContainer);
        }
    } // Fim do for...of
}

// Verifica se o DOM já está carregado. Se estiver, executa a função.
// Caso contrário, adiciona um listener para quando o DOM estiver pronto.
// Isso garante que o script só manipule o DOM após ele estar totalmente disponível.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCardCasesComponent);
} else {
    loadCardCasesComponent();
}