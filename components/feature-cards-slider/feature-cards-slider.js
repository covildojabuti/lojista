(async function () {
    const componentContainer = document.querySelector('div[data-include="components/feature-cards-slider/"]');

    if (!componentContainer) {
        return;
    }

    const dataItem = componentContainer.dataset.item;

    if (!dataItem) {
        console.warn("Nenhum 'data-item' especificado para o componente feature-cards-slide. Por favor, adicione data-item='seuConfigId' ao div.");
        return;
    }

    try {
        const response = await fetch('/data/feature-cards-slider.json');

        if (!response.ok) {
            throw new Error(`Erro ao carregar feature-cards-slider-data.json: ${response.statusText}`);
        }

        const allConfigs = await response.json();
        const selectedConfig = allConfigs.find(config => config.id === dataItem);

        if (selectedConfig) {
            const mainTitleElement = componentContainer.querySelector('.feature-cards-slider-main-title');
            const taglineElement = componentContainer.querySelector('.feature-cards-slider-tagline');
            const gridElement = componentContainer.querySelector('.feature-cards-slider-grid');

            if (mainTitleElement) {
                mainTitleElement.textContent = selectedConfig.mainTitle || '';
            }
            if (taglineElement) {
                taglineElement.textContent = selectedConfig.mainSubtitle || '';
            }

            if (gridElement && selectedConfig.cards) {
                gridElement.innerHTML = '';

                // Adiciona container para os cards e navegação
                const sliderContainer = document.createElement('div');
                sliderContainer.classList.add('feature-cards-slider-container');

                const cardsWrapper = document.createElement('div');
                cardsWrapper.classList.add('feature-cards-slider-wrapper');
                sliderContainer.appendChild(cardsWrapper);

                // Adiciona setas de navegação se houver mais de 3 cards
                if (selectedConfig.cards.length > 3) {
                    const prevArrow = document.createElement('button');
                    prevArrow.classList.add('feature-cards-slider-arrow', 'feature-cards-slider-prev');
                    prevArrow.innerHTML = '&larr;';
                    sliderContainer.appendChild(prevArrow);

                    const nextArrow = document.createElement('button');
                    nextArrow.classList.add('feature-cards-slider-arrow', 'feature-cards-slider-next');
                    nextArrow.innerHTML = '&rarr;';
                    sliderContainer.appendChild(nextArrow);
                }

                selectedConfig.cards.forEach(card => {
                    const cardItem = document.createElement('div');
                    cardItem.classList.add('feature-cards-slider-item');

                    if (card.imageUrl) {
                        const img = document.createElement('img');
                        img.src = card.imageUrl;
                        img.alt = card.title || 'Imagem do Card';
                        img.classList.add('feature-cards-slider-image');
                        cardItem.appendChild(img);
                    }

                    const cardContent = document.createElement('div');
                    cardContent.classList.add('feature-cards-slider-content');

                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('feature-cards-slider-title');
                    cardTitle.textContent = card.title || '';
                    cardContent.appendChild(cardTitle);

                    // Renderiza cada item do array text como um parágrafo separado
                    if (card.text && Array.isArray(card.text)) {
                        card.text.forEach(textItem => {
                            if (textItem.item) {
                                const paragraph = document.createElement('p');
                                paragraph.classList.add('feature-cards-slider-text');
                                paragraph.textContent = textItem.item;
                                cardContent.appendChild(paragraph);
                            }
                        });
                    }

                    // Adiciona botão "Leia mais" usando o link do JSON
                    if (card.link) {
                        const cardLink = document.createElement('a');
                        cardLink.href = card.link;
                        cardLink.textContent = 'Leia mais';
                        cardLink.classList.add('feature-cards-slider-link');
                        cardContent.appendChild(cardLink);
                    }

                    cardItem.appendChild(cardContent);
                    cardsWrapper.appendChild(cardItem);
                });

                gridElement.appendChild(sliderContainer);

                // Adiciona funcionalidade das setas
                if (selectedConfig.cards.length > 1) {
                    const wrapper = sliderContainer.querySelector('.feature-cards-slider-wrapper');
                    const prevBtn = sliderContainer.querySelector('.feature-cards-slider-prev');
                    const nextBtn = sliderContainer.querySelector('.feature-cards-slider-next');
                    const cardWidth = 320; // Largura aproximada de cada card + gap
                    let scrollPosition = 0;

                    nextBtn.addEventListener('click', () => {
                        scrollPosition += cardWidth * 1;
                        if (scrollPosition > wrapper.scrollWidth - wrapper.clientWidth) {
                            scrollPosition = wrapper.scrollWidth - wrapper.clientWidth;
                        }
                        wrapper.scrollTo({
                            left: scrollPosition,
                            behavior: 'smooth'
                        });
                    });

                    prevBtn.addEventListener('click', () => {
                        scrollPosition -= cardWidth * 3;
                        if (scrollPosition < 0) {
                            scrollPosition = 0;
                        }
                        wrapper.scrollTo({
                            left: scrollPosition,
                            behavior: 'smooth'
                        });
                    });
                }
            } else {
                console.warn(`Elemento '.feature-cards-slide-grid' não encontrado ou 'cards' não definidos para a configuração "${dataItem}".`);
            }

        } else {
            console.warn(`Configuração com id="${dataItem}" não encontrada em feature-cards-slide-data.json.`);
        }

    } catch (error) {
        console.error("Erro ao carregar ou processar feature-cards-slide-data.json:", error);
        componentContainer.innerHTML = `<p style="color: red;">Erro ao carregar o componente de cards.</p>`;
    }
})();