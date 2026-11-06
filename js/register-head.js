(function () {
    const head = document.head || document.getElementsByTagName('head')[0];

    // Insere <base href="/lightus/"> se ainda não houver
    if (!document.querySelector('base')) {


        const base = document.createElement('base');

        if (location.pathname.startsWith('/teste')) {
            base.href = '/';
        } else {
            base.href = '/';
        }


        document.head.appendChild(base);
    }

    // Função para adicionar um recurso ao head, evitando duplicação
    function addAsset(path) {
        const isCSS = /\.css(?:\?|$)/.test(path) || path.includes('fonts.googleapis.com');
        const isJS = /\.js(?:\?|$)/.test(path);
        const isFavicon = path.endsWith('.ico') || path.includes('favicon');

        // Evita duplicação
        const alreadyExists = Array.from(head.children).some(el => {
            return (isCSS && el.tagName === 'LINK' && el.href.includes(path)) ||
                   (isJS && el.tagName === 'SCRIPT' && el.src.includes(path)) ||
                   (isFavicon && el.tagName === 'LINK' && el.rel.includes('icon'));
        });

        if (alreadyExists) return;

        if (isCSS) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = path;
            link.type = 'text/css';
            head.prepend(link);
        } else if (isJS) {
            const script = document.createElement('script');
            script.src = path;
            head.prepend(script);
        } else if (isFavicon) {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = path;
            link.type = 'image/x-icon';
            head.prepend(link);
        }
    }

    // Assets globais que sempre serão carregados
    const globalAssets = [
        'config.js',
        'components/common.css',
        'https://fonts.googleapis.com/css2?family=Manrope:wght@100;200;300;400;500;600;700;800;900&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
        'favicon.ico'
    ];

    // Carrega os assets globais
    globalAssets.forEach(addAsset);

    // Detecta a página atual e carrega os assets específicos
    const currentPath = window.location.pathname;
    
    // Verifica se estamos em uma página dentro de /lightus/pages/
    if (currentPath.includes('/pages/')) {
        // Extrai o nome da página (último diretório antes do index.html)
        const pagePathMatch = currentPath.match(/\/pages\/([^\/]+)/);
        
        if (pagePathMatch && pagePathMatch[1]) {
            const pageName = pagePathMatch[1];
            const pageBasePath = `pages/${pageName}/${pageName}`;
            const pageAssetVersion = pageName === 'orcamento'
                ? '20261106-orcamento15'
                : '20261106-orcamento4';
            
            // Adiciona CSS e JS específicos da página se existirem
            addAsset(`${pageBasePath}.css?v=${pageAssetVersion}`);
            addAsset(`${pageBasePath}.js?v=${pageAssetVersion}`);
        }
    }
    // Keep preview clicks out of the live GA4/Google Ads properties.
    const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const googleAdsId = 'AW-17697272500';
    const googleAnalyticsId = 'G-QXCH0V4VK2';

    window.dataLayer = window.dataLayer || [];
    if (isLocalPreview) {
        // Record events locally so preview QA cannot pollute production reports.
        window.sitePreviewAnalytics = window.sitePreviewAnalytics || [];
        window.gtag = function () {
            const call = Array.from(arguments);
            window.dataLayer.push(call);
            if (call[0] === 'event') {
                window.sitePreviewAnalytics.push({ event: call[1], params: call[2] || {} });
            }
        };
    } else {
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', googleAdsId);
        window.gtag('config', googleAnalyticsId);

        // Keep GA4 as the primary loader; the Ads destination is configured above.
        const googleTagUrl = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
        const googleTagAlreadyLoaded = Array.from(head.querySelectorAll('script')).some(script => script.src === googleTagUrl);
        if (!googleTagAlreadyLoaded) {
            const googleTag = document.createElement('script');
            googleTag.async = true;
            googleTag.src = googleTagUrl;
            head.appendChild(googleTag);
        }
    }

    // Delegation covers buttons and links rendered by shared components too.
    document.addEventListener('click', function (event) {
        const clickedElement = event.target instanceof Element
            ? event.target.closest('a[href], button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], summary')
            : null;

        if (!clickedElement || clickedElement.matches('[disabled], [aria-disabled="true"]')) return;

        const isPrivateArea = Boolean(clickedElement.closest('.auth-container, [data-private="true"]'));
        const clickedDestination = clickedElement instanceof HTMLAnchorElement
            ? new URL(clickedElement.href, window.location.href)
            : null;
        const isWhatsAppDestination = clickedDestination && (
            clickedDestination.hostname === 'wa.me' ||
            clickedDestination.hostname === 'whatsapp.com' ||
            clickedDestination.hostname.endsWith('.whatsapp.com')
        );
        const rawClickText = isWhatsAppDestination ? 'WhatsApp' : (
            clickedElement.getAttribute('aria-label') ||
            clickedElement.getAttribute('title') ||
            clickedElement.dataset.analyticsLabel ||
            clickedElement.dataset.action ||
            (!isPrivateArea && (clickedElement.innerText || clickedElement.textContent)) ||
            clickedElement.id ||
            clickedElement.tagName.toLowerCase()
        );
        const clickText = rawClickText
            .replace(/\s+/g, ' ')
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
            .replace(/\+?\d[\d ().-]{7,}\d/g, '[phone]')
            .trim()
            .slice(0, 100);

        const params = {
            click_text: clickText,
            click_type: clickedElement.tagName.toLowerCase()
        };

        if (clickedElement.id) params.click_id = clickedElement.id.slice(0, 100);

        if (clickedDestination) {
            params.click_destination = ['http:', 'https:'].includes(clickedDestination.protocol)
                ? `${clickedDestination.origin}${clickedDestination.pathname}`.slice(0, 100)
                : clickedDestination.protocol.replace(':', '');
        }

        const selectedProduct = isWhatsAppDestination ? window.siteAnalyticsSelectedProduct : null;
        if (selectedProduct) {
            if (selectedProduct.name) params.selected_product_name = selectedProduct.name.slice(0, 100);
            if (selectedProduct.sku) params.selected_product_sku = selectedProduct.sku.slice(0, 100);
        }

        window.gtag('event', 'site_click', { ...params, send_to: googleAnalyticsId });
    }, true);

})();