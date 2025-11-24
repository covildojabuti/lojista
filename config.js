window.APP_CONFIG = {
    apis: {
        BD_Produtos: 'https://script.google.com/macros/s/AKfycbxq6BAFL-epHFPDP52rgCYexbRELc9qYbdt6kMq5h8d_ZP57RBbDQV32Uy4tOVuD5Xy/exec',
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
