// authentication-register.js
// Este script lida com a lógica do formulário de cadastro.

(async function() {
    // Obtém referências aos elementos HTML do formulário de cadastro
    const registerForm = document.getElementById('register-form');
    const regNameInput = document.getElementById('reg-name');
    const regEmailInput = document.getElementById('reg-email');
    const regPasswordInput = document.getElementById('reg-password');
    const regConfirmPasswordInput = document.getElementById('reg-confirm-password');
    const registerMessageDiv = document.getElementById('register-message'); // Div para mensagens de feedback

    // URL do seu Google Apps Script para registro de usuário
    // ESTE É UM PLACEHOLDER! VOCÊ DEVE SUBSTITUIR PELA URL REAL DO SEU SCRIPT DE CADASTRO.
    const GOOGLE_APPS_SCRIPT_REGISTER_URL = "https://script.google.com/macros/s/AKfycbzvQpeW5amFcQKT7iUzBTllhXAuNYfsWIBrmFSQbmfvyDk73h7fpLEeUV38nzoH58akvw/exec";

    /**
     * Exibe uma mensagem de feedback para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo da mensagem ('success' ou 'error').
     */
    function showMessage(message, type) {
        registerMessageDiv.textContent = message;
        registerMessageDiv.className = `auth-message ${type}`; // Adiciona a classe de estilo
        registerMessageDiv.style.display = 'block'; // Mostra a div
        // Opcional: esconder a mensagem após alguns segundos
        setTimeout(() => {
            registerMessageDiv.style.display = 'none';
        }, 5000);
    }

    // Adiciona um listener para o evento de submissão do formulário de cadastro
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previne o comportamento padrão de recarregar a página

            // Obtém os valores dos campos
            const name = regNameInput.value;
            const email = regEmailInput.value;
            const password = regPasswordInput.value;
            const confirmPassword = regConfirmPasswordInput.value;

            // Limpa mensagens anteriores
            registerMessageDiv.style.display = 'none';
            registerMessageDiv.textContent = '';

            // Validação básica de senhas
            if (password !== confirmPassword) {
                showMessage("As senhas não coincidem. Por favor, digite novamente.", 'error');
                return; // Impede a submissão
            }
            if (password.length < 6) { // Exemplo: mínimo de 6 caracteres
                showMessage("A senha deve ter pelo menos 6 caracteres.", 'error');
                return;
            }

            console.log("Tentativa de cadastro com:", { name, email, password: "masked" }); // Não logar senha real

            // *** MUDANÇA CRUCIAL AQUI: Enviar dados como 'application/x-www-form-urlencoded' ***
            const params = new URLSearchParams();
            params.append('action', 'register');
            params.append('name', name);
            params.append('email', email);
            params.append('password', password);

            try {
                // Realiza a requisição POST para o Google Apps Script
                const response = await fetch(GOOGLE_APPS_SCRIPT_REGISTER_URL, {
                    method: 'POST',
                    headers: {
                        // MUDANÇA: Content-Type para dados de formulário
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString() // Converte os parâmetros para string de URL
                });

                // Verifica se a resposta da rede foi bem-sucedida
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                // Lê a resposta do Apps Script (assumindo que ele retorna 'OK' ou uma mensagem de erro em texto)
                const result = await response.text();
                console.log("Resposta do Apps Script:", result);

                if (result.trim() === "OK") {
                    showMessage("Cadastro realizado com sucesso! Por favor, verifique seu e-mail para confirmar sua conta.", 'success');
                    registerForm.reset(); // Limpa o formulário
                    // Dispara evento para o gerenciador de componentes voltar para a tela de login
                    window.dispatchEvent(new CustomEvent('auth:navigate', { detail: { action: 'show-login' } }));
                } else {
                    // Caso o script retorne uma mensagem de erro específica
                    showMessage(`Erro ao cadastrar: ${result}`, 'error');
                }

            } catch (error) {
                console.error("Erro na requisição de cadastro:", error);
                showMessage("Ocorreu um erro ao tentar cadastrar. Verifique sua conexão ou tente novamente.", 'error');
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