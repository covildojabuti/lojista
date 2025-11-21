// authentication-login.js
// Este script lida com a lógica do formulário de login.

// Define uma função assíncrona para encapsular o código
(async function() {
    // Obtém referências aos elementos HTML do formulário de login
    const loginForm = document.getElementById('login-form');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginMessageDiv = document.getElementById('login-message'); // Div para mensagens de feedback

    // URL do seu Google Apps Script para autenticação de login
    // ESTE É UM PLACEHOLDER! VOCÊ DEVE SUBSTITUIR PELA URL REAL DO SEU SCRIPT DE LOGIN.
    const GOOGLE_APPS_SCRIPT_LOGIN_URL = "https://script.google.com/macros/s/AKfycbzvQpeW5amFcQKT7iUzBTllhXAuNYfsWIBrmFSQbmfvyDk73h7fpLEeUV38nzoH58akvw/exec";

    /**
     * Exibe uma mensagem de feedback para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo da mensagem ('success' ou 'error').
     */
    function showMessage(message, type) {
        loginMessageDiv.textContent = message;
        loginMessageDiv.className = `auth-message ${type}`; // Adiciona a classe de estilo
        loginMessageDiv.style.display = 'block'; // Mostra a div
        // Opcional: esconder a mensagem após alguns segundos
        setTimeout(() => {
            loginMessageDiv.style.display = 'none';
        }, 5000);
    }

    // Adiciona um listener para o evento de submissão do formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previne o comportamento padrão de recarregar a página

            // Obtém os valores dos campos de e-mail e senha
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;

            // Limpa mensagens anteriores
            loginMessageDiv.style.display = 'none';
            loginMessageDiv.textContent = '';

            console.log("Tentativa de login com:", { email, password: "masked" });

            // Enviar dados como 'application/x-www-form-urlencoded'
            const params = new URLSearchParams();
            params.append('action', 'login'); // Adiciona a ação de login
            params.append('email', email);
            params.append('password', password);

            try {
                // Realiza a requisição POST para o Google Apps Script
                const response = await fetch(GOOGLE_APPS_SCRIPT_LOGIN_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString() // Converte os parâmetros para string de URL
                });

                // Verifica se a resposta da rede foi bem-sucedida
                if (!response.ok) {
                    // Tenta ler a resposta como texto para obter a mensagem de erro do servidor
                    const errorText = await response.text();
                    throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
                }

                // *** MUDANÇA AQUI: Lê a resposta como JSON ***
                const result = await response.json();
                console.log("Resposta do Apps Script (JSON):", result);

                // *** MUDANÇA AQUI: Verifica a propriedade 'status' do objeto JSON ***
                if (result.status === "OK") {
                    showMessage("Login bem-sucedido! Redirecionando...", 'success');
                    // Dispara evento para o gerenciador de componentes
                    window.dispatchEvent(new CustomEvent('auth:loggedIn', { detail: { email: result.email, name: result.name } }));
                } else if (result.status === "NOK") {
                    // Se o Apps Script retornar NOK com uma mensagem, exibe-a
                    // O Apps Script retorna "NOK: Sua conta ainda não foi confirmada." ou "NOK: E-mail ou senha incorretos."
                    showMessage(result.message || "E-mail ou senha incorretos, ou sua conta não está confirmada.", 'error');
                } else {
                    // Caso o script retorne algo inesperado ou um JSON sem 'status'
                    showMessage("Resposta inesperada do servidor. Tente novamente.", 'error');
                }

            } catch (error) {
                console.error("Erro na requisição de login:", error);
                showMessage("Ocorreu um erro ao tentar logar. Verifique sua conexão ou tente novamente.", 'error');
            }
        });
    }

    // --- Lógica para Navegação entre Componentes (Delegada ao componente pai) ---
    const authLinks = document.querySelectorAll('.auth-link');
    authLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Previne o comportamento padrão do link
            const action = e.target.dataset.action; // Obtém a ação do atributo data-action

            if (action) {
                // Dispara um evento personalizado que o script principal da página pode ouvir
                window.dispatchEvent(new CustomEvent('auth:navigate', { detail: { action: action } }));
            }
        });
    });

})(); // Fim da função auto-executável