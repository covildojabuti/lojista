// /components/button-start/button-start.js

// Este código será executado assim que o navegador carregar o arquivo JS.
// Como o HTML do botão já estará no DOM (conforme seu index renderizado),
// ele será encontrado imediatamente.
(function() { // Isso é uma IIFE (Immediately Invoked Function Expression)
               // para manter as variáveis e funções encapsuladas e não poluir o escopo global.

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    // Verifica se o botão foi encontrado no DOM
    if (scrollToTopBtn) {
        // Função para mostrar/esconder o botão baseado na posição de rolagem
        const toggleScrollToTopButton = () => {
            // Se a rolagem for maior que 200 pixels, adiciona a classe 'show' (para torná-lo visível)
            if (window.scrollY > 200) {
                scrollToTopBtn.classList.add('show');
            } else {
                // Caso contrário, remove a classe 'show' (para escondê-lo)
                scrollToTopBtn.classList.remove('show');
            }
        };

        // Adiciona um "listener" para o evento de rolagem da janela.
        // Toda vez que o usuário rolar a página, a função 'toggleScrollToTopButton' será chamada.
        window.addEventListener('scroll', toggleScrollToTopButton);

        // Chama a função uma vez logo que o script é executado.
        // Isso garante que o botão esteja no estado correto (visível ou escondido)
        // logo ao carregar a página, caso ela já inicie rolada (ex: se o link tem #hash).
        toggleScrollToTopButton();

        // Adiciona um "listener" para o evento de clique no botão.
        // Quando o botão for clicado, ele rolará a página para o topo.
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,        // Rola para a posição 0 (o topo da página)
                behavior: 'smooth' // Faz a rolagem ser suave, não instantânea
            });
        });
    } else {
        // Opcional: Para depuração, caso o botão não seja encontrado.
        console.warn('Botão "Voltar ao Topo" (#scrollToTopBtn) não encontrado no DOM. Verifique o HTML.');
    }
})();