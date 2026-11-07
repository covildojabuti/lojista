(async function () {
    const section = document.querySelector('.banner-section');
    const carouselContainer = section?.querySelector('.banner-carousel');
    const prevButton = section?.querySelector('.prev-slide');
    const nextButton = section?.querySelector('.next-slide');
    const autoToggle = section?.querySelector('.toggle-autoplay');
    const dotsContainer = section?.querySelector('.dots');

    if (!section || !carouselContainer || !dotsContainer) return;

    let slides = [];
    let slideIndex = 0;
    let autoSlideInterval;
    let isManuallyPaused = false;
    let isPointerPaused = false;
    let isFocusPaused = false;
    const slideDuration = 9000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function safeUrl(value) {
        try {
            const raw = String(value || '').trim();
            if (!raw) return '';
            const url = new URL(raw, window.location.href);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function createBannerSlide(data, index) {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${index + 1}`);

        const card = document.createElement('div');
        card.className = 'banner-card';
        if (/dados de led/i.test(data.title || '')) card.classList.add('banner-card--led');
        const imageUrl = safeUrl(data['image-url']);
        if (imageUrl) card.style.backgroundImage = `url("${imageUrl.replace(/["\\]/g, '\\$&')}")`;

        const overlay = document.createElement('div');
        overlay.className = 'banner-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'banner-text-button-container';
        const eyebrow = document.createElement('span');
        eyebrow.className = 'banner-eyebrow';
        eyebrow.textContent = 'Catálogo para lojistas';

        const title = document.createElement('h1');
        title.textContent = data.title || '';
        const description = document.createElement('p');
        description.textContent = data.text || '';
        const link = document.createElement('a');
        link.className = 'cta-button';
        link.textContent = data.button || 'Ver catálogo';
        const linkUrl = safeUrl(data['button-url']);
        link.href = linkUrl || '/pages/produtos/';

        content.append(eyebrow, title, description, link);
        card.append(overlay, content);
        slide.append(card);
        return slide;
    }

    function updateDots() {
        [...dotsContainer.children].forEach((dot, index) => {
            const active = index === slideIndex;
            dot.classList.toggle('active', active);
            dot.setAttribute('aria-current', active ? 'true' : 'false');
        });
    }

    function updateCarousel() {
        if (!slides.length) return;
        carouselContainer.style.transform = `translateX(-${slideIndex * 100}%)`;
        slides.forEach((slide, index) => {
            const active = index === slideIndex;
            slide.setAttribute('aria-hidden', active ? 'false' : 'true');
            slide.inert = !active;
        });
        updateDots();
    }

    function startAutoSlide() {
        clearInterval(autoSlideInterval);
        if (slides.length > 1 && !isManuallyPaused && !isPointerPaused && !isFocusPaused && !reducedMotion.matches && !document.hidden) {
            autoSlideInterval = setInterval(() => goToSlide(slideIndex + 1, false), slideDuration);
        }
    }

    function updateAutoToggle() {
        if (!autoToggle) return;
        autoToggle.setAttribute('aria-pressed', String(isManuallyPaused));
        autoToggle.setAttribute('aria-label', isManuallyPaused
            ? 'Retomar troca automática dos destaques'
            : 'Pausar troca automática dos destaques');
        autoToggle.textContent = isManuallyPaused ? '▶' : 'Ⅱ';
    }

    function goToSlide(index, restartTimer = true) {
        if (!slides.length) return;
        slideIndex = (index + slides.length) % slides.length;
        updateCarousel();
        if (restartTimer) startAutoSlide();
    }

    function renderSlides(items) {
        carouselContainer.replaceChildren(...items.map(createBannerSlide));
        slides = [...carouselContainer.querySelectorAll('.banner-slide')];
        dotsContainer.replaceChildren(...slides.map((_, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', `Mostrar destaque ${index + 1}`);
            dot.addEventListener('click', () => goToSlide(index));
            return dot;
        }));
        updateCarousel();
    }

    section.addEventListener('mouseenter', () => {
        isPointerPaused = true;
        clearInterval(autoSlideInterval);
    });
    section.addEventListener('mouseleave', () => {
        isPointerPaused = false;
        startAutoSlide();
    });
    section.addEventListener('focusin', () => {
        isFocusPaused = true;
        clearInterval(autoSlideInterval);
    });
    section.addEventListener('focusout', event => {
        isFocusPaused = section.contains(event.relatedTarget);
        if (!isFocusPaused) startAutoSlide();
    });
    document.addEventListener('visibilitychange', startAutoSlide);
    reducedMotion.addEventListener?.('change', startAutoSlide);

    prevButton?.addEventListener('click', () => goToSlide(slideIndex - 1));
    nextButton?.addEventListener('click', () => goToSlide(slideIndex + 1));
    autoToggle?.addEventListener('click', () => {
        isManuallyPaused = !isManuallyPaused;
        updateAutoToggle();
        startAutoSlide();
    });
    updateAutoToggle();

    try {
        const response = await fetch(Config.COMPONENTS.banner_home.json);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bannerData = await response.json();
        if (!Array.isArray(bannerData) || !bannerData.length) throw new Error('Banner sem slides.');
        renderSlides(bannerData);
        startAutoSlide();
    } catch (error) {
        console.error('Erro ao carregar os destaques da home:', error);
        carouselContainer.innerHTML = '<div class="banner-fallback"><p>Conheça nossos produtos para lojistas.</p><a class="cta-button" href="/pages/produtos/">Ver catálogo</a></div>';
    }
})();
