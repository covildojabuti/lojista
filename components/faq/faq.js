(async function () {
    const componentContainer = document.querySelector('div[data-include="components/faq/"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item; // Optional: if you want different FAQ sets

    try {
        const response = await fetch('data/faq.json'); // Path to the JSON

        if (!response.ok) {
            throw new Error(`Erro ao carregar faq.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        // If dataItem is provided, find a specific config, otherwise use the first one or a default
        const selectedConfig = dataItem ? allConfigs.find(config => config.id === dataItem) : allConfigs[0];


        if (selectedConfig) {
            // Header elements
            const taglineElement = componentContainer.querySelector('.faq-tagline');
            const mainTitleElement = componentContainer.querySelector('.faq-main-title');
            const faqItemsGridElement = componentContainer.querySelector('.faq-items-grid');

            // Populate the header
            if (taglineElement) {
                taglineElement.textContent = selectedConfig.tagline || '';
            }
            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.mainTitle || '';
            }
            // The yellow bar is static in HTML, no JS needed to populate.

            // Populate FAQ items
            if (faqItemsGridElement && selectedConfig.faqs && Array.isArray(selectedConfig.faqs)) {
                faqItemsGridElement.innerHTML = ''; // Clear existing content

                selectedConfig.faqs.forEach(faq => {
                    const faqItem = document.createElement('div');
                    faqItem.classList.add('faq-item');

                    const faqQuestionButton = document.createElement('button');
                    faqQuestionButton.classList.add('faq-question');
                    faqQuestionButton.innerHTML = `
                        <span>${faq.question || ''}</span>
                        <span class="faq-question-icon">+</span>
                    `;
                    faqItem.appendChild(faqQuestionButton);

                    const faqAnswerDiv = document.createElement('div');
                    faqAnswerDiv.classList.add('faq-answer');
                    faqAnswerDiv.innerHTML = `<p>${faq.answer || ''}</p>`; // Use <p> for proper paragraph
                    faqItem.appendChild(faqAnswerDiv);

                    // Add click listener to toggle active state
                    faqQuestionButton.addEventListener('click', () => {
                        const isOpen = faqItem.classList.contains('open');
                        const icon = faqQuestionButton.querySelector('.faq-question-icon');

                        if (isOpen) {
                            // Quando fechar:
                            // 1. Define max-height para a altura atual para permitir a transição do estado aberto
                            faqAnswerDiv.style.maxHeight = faqAnswerDiv.scrollHeight + "px";
                            // 2. Força um reflow para garantir que a transição seja aplicada corretamente
                            void faqAnswerDiv.offsetWidth;
                            // 3. Define max-height como '0px' para iniciar a transição de fechamento
                            faqAnswerDiv.style.maxHeight = '0px';
                            faqItem.classList.remove('open');
                            icon.textContent = '+';
                        } else {
                            // Quando abrir:
                            // 1. Remove qualquer max-height existente para obter a altura real do conteúdo
                            faqAnswerDiv.style.maxHeight = 'none';
                            const scrollHeight = faqAnswerDiv.scrollHeight;
                            // 2. Define max-height como '0px' para preparar para a transição de abertura
                            faqAnswerDiv.style.maxHeight = '0px';
                            // 3. Força um reflow
                            void faqAnswerDiv.offsetWidth;
                            // 4. Define max-height para a altura calculada, iniciando a transição
                            faqAnswerDiv.style.maxHeight = scrollHeight + "px";
                            faqItem.classList.add('open');
                            icon.textContent = 'x';
                        }
                    });

                    faqItemsGridElement.appendChild(faqItem);
                });
            } else {
                console.warn(`Nenhum 'faqs' definido ou não é um array para a configuração "${dataItem}".`);
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em faq-data.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar faq-data.json:", error);
        componentContainer.innerHTML = `<p style="color: red;">Erro ao carregar o componente FAQ.</p>`;
    }
})();
