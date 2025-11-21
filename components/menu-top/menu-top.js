function createMenuItems(items) { /* cite: 4, 3, 2, 5 */
    return items.map(item => { /* cite: 4, 3, 2, 5 */
        let html = `<li class="menu-item ${item.submenu && item.submenu.length > 0 ? 'has-submenu' : ''}">`; // Adicionar classe para identificar itens com submenu

        html += item.url /* cite: 4, 3, 2, 5 */
            ? `<a href="${item.url}" class="menu-link">${item.text}</a>` // Adicionar classe para links
            : `<span class="menu-label">${item.text}</span>`; /* cite: 4, 3, 2, 5 */

        if (item.submenu && item.submenu.length > 0) { /* cite: 4, 3, 2, 5 */
            // REMOVEMOS O <button class="submenu-toggle"> AQUI
            html += `
                <ul class="submenu">
                    ${createMenuItems(item.submenu)}
                </ul>
            `; /* cite: 4, 3, 2, 5 */
        }

        html += `</li>`; /* cite: 4, 3, 2, 5 */
        return html; /* cite: 4, 3, 2, 5 */
    }).join(''); /* cite: 4, 3, 2, 5 */
}

(async function () {
    try {
        const response = await fetch('/data/navigation.json');
        const items = await response.json();
        const navLinks = document.querySelector('.nav-links'); /* cite: 4, 3, 2, 5 */
        if (!navLinks) return; /* cite: 4, 3, 2, 5 */

        navLinks.innerHTML = createMenuItems(items); /* cite: 4, 3, 2, 5 */

        // NOVO: Adicionar evento de clique aos itens de menu pai para abrir o submenu
        document.querySelectorAll('.menu-item.has-submenu > .menu-label, .menu-item.has-submenu > .menu-link').forEach(parentItem => {
            parentItem.addEventListener('click', function (e) {
                // Prevenir que o link padrão seja seguido se for um <a> e tiver submenu
                if (this.tagName === 'A' && this.closest('.menu-item').classList.contains('has-submenu')) {
                    e.preventDefault();
                }

                const menuItem = this.closest('.menu-item');
                const submenu = menuItem.querySelector('.submenu');

                if (submenu) {
                    const isActive = submenu.classList.contains('active');

                    // Fechar todos os outros submenus abertos
                    document.querySelectorAll('.submenu.active').forEach(sub => {
                        sub.classList.remove('active');
                    });

                    // Se este submenu não estava ativo, abra-o
                    if (!isActive) {
                        submenu.classList.add('active');
                    }
                }
            });
        });
       

        // Hamburger menu functionality (manter este bloco, pois ele controla o menu principal no mobile)
        const hamburgerMenu = document.querySelector('.hamburger-menu');
        const menuNavLinks = document.querySelector('.nav-links');

        if (hamburgerMenu && menuNavLinks) {
            hamburgerMenu.addEventListener('click', () => {
                menuNavLinks.classList.toggle('open');
                // Toggle aria-expanded for accessibility
                const isMenuOpen = menuNavLinks.classList.contains('open');
                hamburgerMenu.setAttribute('aria-expanded', isMenuOpen);
            });

            // Close menu when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (!menuNavLinks.contains(e.target) && !hamburgerMenu.contains(e.target) && menuNavLinks.classList.contains('open')) {
                    menuNavLinks.classList.remove('open');
                    hamburgerMenu.setAttribute('aria-expanded', false);
                }
            });
        }

    } catch (error) {
        console.error('Erro ao carregar menu:', error);
        const navLinks = document.querySelector('.nav-links'); /* cite: 4, 3, 2, 5 */
        if (navLinks) { /* cite: 4, 3, 2, 5 */
            navLinks.innerHTML = '<li>Menu indisponível</li>'; /* cite: 4, 3, 2, 5 */
        }
    }
})();