/**
 * Caminho base para todos os componentes.
 * No GitHub Pages, se seu site estiver em /lightus/, isso é obrigatório.
 */
const basePath = '/';

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
        const cssPath = `${fullComponentPath}/${componentName}.css`;
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssPath;
        cssLink.onerror = () => console.warn(`CSS não encontrado ou erro ao carregar: ${cssPath}`);
        document.head.appendChild(cssLink);

        // 2. Carrega o HTML
        const htmlPath = `${fullComponentPath}/${componentName}.html`;
        const htmlResponse = await fetch(htmlPath);

        if (!htmlResponse.ok) {
            console.warn(`HTML não encontrado ou vazio: ${htmlPath}`);
            element.innerHTML = '';
        } else {
            const html = await htmlResponse.text();
            element.innerHTML = html;

            // Processa componentes aninhados
            const nestedComponents = element.querySelectorAll('[data-include]');
            for (const nestedComponent of nestedComponents) {
                await injectComponent(nestedComponent);
            }
        }

        // 3. Carrega o JS
        const jsPath = `${fullComponentPath}/${componentName}.js`;
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
