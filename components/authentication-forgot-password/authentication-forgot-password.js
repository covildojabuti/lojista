// authentication-forgot-password.js
// Este script lida com a lógica do formulário de recuperação de senha.

(async function() {
    // Obtém referências aos elementos HTML do formulário de recuperação de senha
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const forgotPasswordMessageDiv = document.getElementById('forgot-password-message'); // Div para mensagens de feedback

    // URL do seu Google Apps Script para redefinição de senha
    // ESTE É UM PLACEHOLDER! VOCÊ DEVE SUBSTITUIR PELA URL REAL DO SEU SCRIPT DE REDEFINIÇÃO DE SENHA.
    const GOOGLE_APPS_SCRIPT_FORGOT_PASSWORD_URL = "https://script.google.com/macros/s/AKfycbzvQpeW5amFcQKT7iUzBTllhXAuNYfsWIBrmFSQbmfvyDk73h7fpLEeUV38nzoH58akvw/exec";

    /**
     * Exibe uma mensagem de feedback para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo da mensagem ('success' ou 'error').
     */
    function showMessage(message, type) {
        forgotPasswordMessageDiv.textContent = message;
        forgotPasswordMessageDiv.className = `auth-message ${type}`; // Adiciona a classe de estilo
        forgotPasswordMessageDiv.style.display = 'block'; // Mostra a div
        // Opcional: esconder a mensagem após alguns segundos
        setTimeout(() => {
            forgotPasswordMessageDiv.style.display = 'none';
        }, 5000);
    }

    // Adiciona um listener para o evento de submissão do formulário de recuperação de senha
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Previne o comportamento padrão de recarregar a página

            // Obtém o valor do campo de e-mail
            const email = forgotEmailInput.value;

            // Limpa mensagens anteriores
            forgotPasswordMessageDiv.style.display = 'none';
            forgotPasswordMessageDiv.textContent = '';

            console.log("Tentativa de redefinição de senha para:", { email });

            // *** MUDANÇA CRUCIAL AQUI: Enviar dados como 'application/x-www-form-urlencoded' ***
            const params = new URLSearchParams();
            params.append('action', 'forgot_password'); // Adiciona a ação
            params.append('email', email);

            try {
                // Realiza a requisição POST para o Google Apps Script
                const response = await fetch(GOOGLE_APPS_SCRIPT_FORGOT_PASSWORD_URL, {
                    method: 'POST',
                    headers: {
                        // MUDANÇA: Content-Type para dados de formulário
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

                // Lê a resposta do Apps Script (assumindo que ele retorna 'OK' ou uma mensagem de erro em texto)
                const result = await response.text();
                console.log("Resposta do Apps Script:", result);

                if (result.trim() === "OK") {
                    showMessage("Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha em breve.", 'success');
                    forgotPasswordForm.reset(); // Limpa o formulário
                    // Opcional: Disparar evento para o gerenciador de componentes voltar para a tela de login
                    // window.dispatchEvent(new CustomEvent('auth:navigate', { detail: { action: 'show-login' } }));
                } else {
                    // Caso o script retorne uma mensagem de erro específica ou 'NOK'
                    showMessage(`Erro ao solicitar redefinição de senha: ${result}`, 'error');
                }

            } catch (error) {
                console.error("Erro na requisição de redefinição de senha:", error);
                showMessage("Ocorreu um erro ao tentar redefinir a senha. Verifique sua conexão ou tente novamente.", 'error');
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
