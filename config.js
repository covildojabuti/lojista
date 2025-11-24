window.APP_CONFIG = {
    apis: {
        BD_Produtos: 'https://script.google.com/macros/s/AKfycbykdzOpowOXAjIwkzTRVmdl0mstVcY7e8heaYVlLRnp2m7D4kfLP8dISeW7NXqM_jim/exec',
        Blog: 'https://covildojabuti.blogspot.com/',
    },

    paths: {
        imagesProdutos: '/lojista/app_produtos',
        bannerData: 'data/banner-static.json',
    },

    components: {
        banner_home: {
            json: 'data/banner-home.json',
        },
        banner_static: {
            json: 'data/banner-static.json',
        }
    },

    defaults: {
        moeda: 'BRL',
        locale: 'pt-BR',
    },
};

// Alias mais curto (opcional, mas facilita)
window.Config = {
    APIS: window.APP_CONFIG.apis,
    PATHS: window.APP_CONFIG.paths,
    COMPONENTS: window.APP_CONFIG.components,
    DEFAULTS: window.APP_CONFIG.defaults
};
