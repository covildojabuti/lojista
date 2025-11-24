// banner-home.js

(async function () {
    const carouselContainer = document.querySelector('.banner-carousel');
    const prevButton = document.querySelector('.prev-slide');
    const nextButton = document.querySelector('.next-slide');
    const dotsContainer = document.querySelector('.dots');

    let slides = []; // Inicialmente vazia, será preenchida pelo JSON
    let slideIndex = 0;
    let autoSlideInterval;
    const slideDuration = 10000; // 5 segundos. Ajuste este valor.

    // Função para criar o HTML de um slide
    function createBannerSlide(bannerData) {
        let html = `
            <div class="banner-slide">
                <div class="banner-card" style="background-image: url('${bannerData["image-url"]}');">
                    <div class="banner-overlay"></div>
                    <div class="banner-text-button-container">
                        <h2>${bannerData.title}</h2>
                        <p>${bannerData.text}</p>
                        <a href="${bannerData["button-url"]}" class="cta-button">${bannerData.button}</a>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    // Função para renderizar todos os slides
    function renderBannerSlides(items) {
        if (!carouselContainer) {
            console.error('Container do carrossel não encontrado.');
            return;
        }

        carouselContainer.innerHTML = items.map(createBannerSlide).join('');
        slides = document.querySelectorAll('.banner-slide'); // Atualiza a NodeList de slides
    }

    // Cria os indicadores (bolinhas)
    function createDots() {
        dotsContainer.innerHTML = ''; // Limpa os dots existentes antes de criar novos
        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.addEventListener('click', () => goToSlide(index));
            dotsContainer.appendChild(dot);
        });
        updateDots();
    }

    // Atualiza os indicadores
    function updateDots() {
        const dots = document.querySelectorAll('.dots button');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === slideIndex);
        });
    }

    // Move para o slide especificado
    function goToSlide(index) {
        slideIndex = index;
        if (slideIndex < 0) {
            slideIndex = slides.length - 1;
        } else if (slideIndex >= slides.length) {
            slideIndex = 0;
        }
        updateCarousel();
        updateDots();
        resetAutoSlide();
    }

    // Atualiza a posição do carrossel
    function updateCarousel() {
        if (carouselContainer && slides.length > 0) {
            carouselContainer.style.transform = `translateX(-${slideIndex * 100}%)`;
        }
    }

    // Inicia o auto-avanço
    function startAutoSlide() {
        if (slides.length > 1) { // Só inicia o auto-slide se houver mais de um slide
            autoSlideInterval = setInterval(() => {
                goToSlide(slideIndex + 1);
            }, slideDuration);
        }
    }

    // Para e reinicia o auto-avanço
    function resetAutoSlide() {
        clearInterval(autoSlideInterval);
        startAutoSlide();
    }

    // Lógica principal: carregar JSON e iniciar carrossel
    try {
        const response = await fetch(Config.COMPONENTS.banner_home.json); // Caminho para o JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const bannerData = await response.json();

        if (bannerData && bannerData.length > 0) {
            renderBannerSlides(bannerData); // Renderiza os slides baseados nos dados do JSON
            createDots();
            updateCarousel();
            // Adiciona event listeners para navegação APÓS os slides serem renderizados
            if (prevButton && nextButton) {
                prevButton.addEventListener('click', () => goToSlide(slideIndex - 1));
                nextButton.addEventListener('click', () => goToSlide(slideIndex + 1));
            }
            startAutoSlide(); // Inicia o auto-avanço
        } else {
            console.warn('Nenhum dado encontrado no banner-home.json ou JSON vazio.');
            // Opcional: exibir uma mensagem de fallback no HTML
            if (carouselContainer) {
                carouselContainer.innerHTML = '<p style="text-align:center; color: #555;">Conteúdo do banner indisponível.</p>';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do banner:', error);
        if (carouselContainer) {
            carouselContainer.innerHTML = '<p style="text-align:center; color: red;">Erro ao carregar o banner.</p>';
        }
    }
})();