/**
 * Caminho base para todos os componentes.
 * No GitHub Pages, se seu site estiver em /lightus/, isso é obrigatório.
 */
const basePath = '/';
const componentScriptVersion = '20261107-home-polish10';

/**
 * Função para injetar componentes com estrutura padronizada
 * (nomecomponente.css, nomecomponente.html, nomecomponente.js)
 * com recursividade para componentes aninhados
 */
async function injectComponent(element) {
    try {
        const componentPath = element.getAttribute('data-include').replace(/\/$/, '');
        const componentName = componentPath.split('/').pop();
        const componentBase = componentPath.substring(0, componentPath.lastIndexOf('/') + 1);

        // Corrige todos os caminhos para respeitar o basePath
        const fullComponentPath = `${basePath}${componentPath}`;

        // 1. Carrega o CSS
        const cssPath = `${fullComponentPath}/${componentName}.css?v=${componentScriptVersion}`;
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssPath;
        cssLink.onerror = () => console.warn(`CSS não encontrado ou erro ao carregar: ${cssPath}`);
        document.head.appendChild(cssLink);

        // 2. Carrega o HTML
        const htmlPath = `${fullComponentPath}/${componentName}.html?v=${componentScriptVersion}`;
        const htmlResponse = await fetch(htmlPath);

        if (!htmlResponse.ok) {
            console.warn(`HTML não encontrado ou vazio: ${htmlPath}`);
            element.innerHTML = '';
        } else {
            const html = await htmlResponse.text();
            element.innerHTML = html;

            if (element.classList.contains("home-contact")) {
                const contactHeading = element.querySelector(".contact-header h1");
                if (contactHeading) {
                    const sectionHeading = document.createElement("h2");
                    sectionHeading.id = contactHeading.id;
                    sectionHeading.className = contactHeading.className;
                    sectionHeading.textContent = "Fale com a nossa equipe";
                    contactHeading.replaceWith(sectionHeading);
                }
                const formDescription = element.querySelector(".contact-header p");
                if (formDescription) formDescription.textContent = "Conte o que a sua loja precisa. A equipe do Covil do Jabuti entrarÃ¡ em contato.";
                const specialistTitle = element.querySelector(".specialist-section h2");
                if (specialistTitle) specialistTitle.textContent = "Prefere conversar com alguÃ©m?";
                const specialistHeading = element.querySelector(".specialist-section h3");
                if (specialistHeading) specialistHeading.textContent = "A gente ajuda a montar o seu pedido.";
                const specialistDescription = element.querySelector(".specialist-section p");
                if (specialistDescription) specialistDescription.textContent = "Tire dÃºvidas sobre produtos, faixas de preÃ§o e condiÃ§Ãµes para lojistas pelo WhatsApp. Sem compromisso.";
                const specialistLink = element.querySelector(".specialist-section .specialist-btn");
                if (specialistLink) specialistLink.textContent = "Conversar no WhatsApp";
            }

            // Processa componentes aninhados
            const nestedComponents = element.querySelectorAll('[data-include]');
            for (const nestedComponent of nestedComponents) {
                await injectComponent(nestedComponent);
            }
        }

        // 3. Carrega o JS
        const jsPath = `${fullComponentPath}/${componentName}.js?v=${componentScriptVersion}`;
        const jsScript = document.createElement('script');
        jsScript.src = jsPath;
        jsScript.onerror = () => console.warn(`JS não encontrado ou erro ao carregar: ${jsPath}`);
        document.body.appendChild(jsScript);

    } catch (error) {
        console.error(`Erro ao carregar componente:`, error);
        element.innerHTML = `<div class="component-error" style="color: red; border: 1px dashed red; padding: 10px;">
            Erro ao carregar componente: ${element.getAttribute('data-include')}
        </div>`;
    }
}

// Iniciação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const components = document.querySelectorAll('[data-include]');

    Promise.all([...components].map(injectComponent)).catch(error => {
        console.error('Erro ao carregar componentes raiz:', error);
    });

    window.addEventListener('error', (event) => {
        console.error('Erro global:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Promise rejeitada não tratada:', event.reason);
    });
});
