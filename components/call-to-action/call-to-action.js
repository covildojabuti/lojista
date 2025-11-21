(async function () {
    const componentContainer = document.querySelector('div[data-include="components/call-to-action/"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item; // Optional: if you want different CTA sets

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente call-to-action. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        const response = await fetch('/data/call-to-action.json'); // Caminho para o JSON

        if (!response.ok) {
            throw new Error(`Erro ao carregar call-to-action.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            const phraseElement = componentContainer.querySelector('.call-to-action-phrase');
            const buttonElement = componentContainer.querySelector('.call-to-action-button');

            if (phraseElement) {
                phraseElement.textContent = selectedConfig.phrase || '';
            }

            if (buttonElement) {
                buttonElement.href = selectedConfig.linkUrl || '#';
                buttonElement.textContent = selectedConfig.linkText || 'Saiba Mais';

                // Adiciona o atributo target se ele existir no JSON
                if (selectedConfig.target) {
                    buttonElement.target = selectedConfig.target;
                }
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em call-to-action.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar call-to-action.json:", error);
        componentContainer.innerHTML = `<p style="color: red; text-align: center;">Erro ao carregar o componente de Call to Action.</p>`;
    }
})();
