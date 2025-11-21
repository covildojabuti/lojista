function createMenuItemsBottom(items) {
    return items.map(item => {
        let html = `<li class="menu-item-bottom">`;

        html += item.url
            ? `<a href="${item.url}">${item.text}</a>`
            : `<span class="menu-label-bottom">${item.text}</span>`;

if (Array.isArray(item.submenu) && item.submenu.length > 0) {
            html += `
                <ul class="submenu-bottom">
                    ${createMenuItemsBottom(item.submenu)}
                </ul>
            `;
        }

        html += `</li>`;
        return html;
    }).join('');
}

(async function () {
    try {
        const response = await fetch('data/navigation.json');
        const items = await response.json();
        const navLinks = document.querySelector('.links-bottom');
        if (!navLinks) return;

        navLinks.innerHTML = createMenuItemsBottom(items);

        
    } catch (error) {
        console.error('Erro ao carregar menu:', error);
        const navLinks = document.querySelector('.links-bottom');
        if (navLinks) {
            navLinks.innerHTML = '<li>Menu indisponível</li>';
        }
    }
})();
