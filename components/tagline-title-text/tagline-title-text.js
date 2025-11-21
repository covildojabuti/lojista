(async function () {
    // Seleciona o contêiner do componente
    const componentContainer = document.querySelector('div[data-include="components/tagline-title-text/"]');

    if (!componentContainer) {
        return;
    }

    // Pega o valor do atributo 'data-item'. Este será o ID da configuração que queremos carregar.
    const dataItem = componentContainer.dataset.item;

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente tagline-title-text. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        // Assume que seu arquivo JSON está em 'js/data/tagline-title-text.json'
        // Ajuste este caminho se sua estrutura de arquivos for diferente.
        const response = await fetch('/data/tagline-title-text.json'); // Caminho atualizado para /js/data/

        if (!response.ok) {
            throw new Error(`Erro ao carregar tagline-title-text.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();

        // Encontra a configuração de dados que corresponde ao 'dataItem' (ID)
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            // Seletores para a tagline, título principal e texto descritivo
            const taglineElement = componentContainer.querySelector('.text-block-tagline');
            const mainTitleElement = componentContainer.querySelector('.text-block-main-title');
            const descriptionElement = componentContainer.querySelector('.text-block-description'); // Novo seletor

            if (taglineElement) {
                taglineElement.textContent = selectedConfig.tagline || ''; // 'tagline' do JSON vai para o <p>
            }
            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.mainTitle || ''; // 'mainTitle' do JSON vai para o <h2>
            }
            if (descriptionElement) {
                descriptionElement.innerHTML = selectedConfig.text || ''; // 'text' do JSON vai para o <p>
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em tagline-title-text.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar tagline-title-text.json:", error);
        componentContainer.innerHTML = `<p style="color: red;">Erro ao carregar o componente de texto.</p>`;
    }
})();