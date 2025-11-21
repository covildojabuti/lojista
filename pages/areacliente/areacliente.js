// /pages/areacliente/areacliente.js
// Este é o script principal que orquestra a exibição dos componentes
// e gerencia o estado de autenticação do usuário.

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos wrappers dos componentes (os divs com data-include)
    const loginWrapper = document.getElementById('b001');
    const registerWrapper = document.getElementById('b002');
    const forgotPasswordWrapper = document.getElementById('b003');
    const filesAvailableWrapper = document.getElementById('b004');

    // Referências aos containers internos dos componentes (aqueles com 'auth-container' ou 'files-container')
    // Estes serão os elementos que terão a classe 'active' adicionada/removida.
    // Eles só estarão disponíveis DEPOIS que o app.js injetar o HTML e os scripts dos componentes individuais executarem.
    let loginComponent = null;
    let registerComponent = null;
    let forgotPasswordComponent = null;
    let filesAvailableComponent = null;

    // Variáveis para armazenar o estado do usuário logado
    let currentUser = {
        email: null,
        name: null,
        isLoggedIn: false
    };

    /**
     * Mostra um componente específico e esconde todos os outros.
     * @param {HTMLElement} componentToShow - O elemento do componente a ser exibido (o .auth-container ou .files-container).
     */
    function showActiveComponent(componentToShow) {
        // Esconde todos os componentes
        [loginComponent, registerComponent, forgotPasswordComponent, filesAvailableComponent].forEach(comp => {
            if (comp) { // Garante que o componente foi carregado e a referência existe
                comp.classList.remove('active');
            }
        });

        // Mostra o componente desejado
        if (componentToShow) {
            componentToShow.classList.add('active');
        }
    }

    /**
     * Gerencia a navegação entre os componentes da área de autenticação/cliente.
     * @param {string} action - A ação a ser executada ('show-login', 'show-register', 'show-forgot-password', 'show-files', 'logout').
     * @param {Object} [data] - Dados adicionais, como informações do usuário após o login.
     */
    function navigateTo(action, data = {}) {
        console.log(`Navegando para: ${action}`, data);
        switch (action) {
            case 'show-login':
                showActiveComponent(loginComponent);
                break;
            case 'show-register':
                showActiveComponent(registerComponent);
                break;
            case 'show-forgot-password':
                showActiveComponent(forgotPasswordComponent);
                break;
            case 'show-files':
                // Atualiza o estado do usuário e passa para o componente de arquivos
                currentUser.isLoggedIn = true;
                currentUser.email = data.email;
                currentUser.name = data.name;
                // Dispara evento para o componente de arquivos atualizar suas informações
                // O componente de arquivos deve ter um listener para 'auth:updateUserInfo'
                window.dispatchEvent(new CustomEvent('auth:updateUserInfo', { detail: { name: currentUser.name, email: currentUser.email } }));
                showActiveComponent(filesAvailableComponent);
                break;
            case 'logout':
                // Limpa o estado do usuário
                currentUser.isLoggedIn = false;
                currentUser.email = null;
                currentUser.name = null;
                // Limpa o sessionStorage para remover a persistência de login
                sessionStorage.removeItem('isLoggedIn');
                sessionStorage.removeItem('currentUserEmail');
                sessionStorage.removeItem('currentUserName');

                showActiveComponent(loginComponent); // Volta para a tela de login
                break;
            default:
                console.warn('Ação de navegação desconhecida:', action);
        }
    }

    /**
     * Tenta obter as referências dos componentes e inicializa a área do cliente.
     * Continua tentando até que todos os componentes sejam encontrados.
     */
    function tryInitializeComponents() {
        loginComponent = loginWrapper.querySelector('.auth-container');
        registerComponent = registerWrapper.querySelector('.auth-container');
        forgotPasswordComponent = forgotPasswordWrapper.querySelector('.auth-container');
        filesAvailableComponent = filesAvailableWrapper.querySelector('.files-container');

        // Verifica se todos os componentes internos foram encontrados
        if (loginComponent && registerComponent && forgotPasswordComponent && filesAvailableComponent) {
            console.log('Todos os componentes internos encontrados. Inicializando área do cliente.');
            proceedInitialization();
        } else {
            // Se algum componente ainda não foi encontrado, tenta novamente após um pequeno atraso
            console.log('Aguardando injeção de componentes internos...');
            requestAnimationFrame(tryInitializeComponents); // Tenta novamente no próximo frame de animação
        }
    }

    /**
     * Função que contém a lógica de inicialização real,
     * a ser chamada após a garantia de que os componentes estão no DOM.
     */
    function proceedInitialization() {
        // Adiciona event listeners para os eventos personalizados disparados pelos componentes
        // Estes listeners precisam estar aqui para que o script principal reaja às ações dos componentes
        window.addEventListener('auth:navigate', (event) => {
            navigateTo(event.detail.action);
        });

        // Evento disparado pelo componente de login quando o login é bem-sucedido
        window.addEventListener('auth:loggedIn', (event) => {
            // Armazena o estado de login no sessionStorage para persistência básica
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUserEmail', event.detail.email);
            sessionStorage.setItem('currentUserName', event.detail.name);
            navigateTo('show-files', event.detail); // Passa os dados do usuário
        });

        // Verifica o estado de login ao carregar a página (persistência básica)
        if (sessionStorage.getItem('isLoggedIn') === 'true' && sessionStorage.getItem('currentUserEmail')) {
            currentUser.email = sessionStorage.getItem('currentUserEmail');
            currentUser.name = sessionStorage.getItem('currentUserName');
            navigateTo('show-files', currentUser); // Vai direto para a área de arquivos
        } else {
            navigateTo('show-login'); // Mostra a tela de login por padrão
        }
    }

    // Inicia o processo de tentar encontrar e inicializar os componentes
    tryInitializeComponents();
});
