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
        const isCSS = path.endsWith('.css') || path.includes('fonts.googleapis.com');
        const isJS = path.endsWith('.js');
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
            
            // Adiciona CSS e JS específicos da página se existirem
            addAsset(`${pageBasePath}.css`);
            addAsset(`${pageBasePath}.js`);
        }
    }
})();