(async function () {
    const bannerContainer = document.querySelector('div[data-include="components/banner-static/"]'); //
    if (!bannerContainer) { //
        return; //
    }

    const dataItem = bannerContainer.dataset.item; // Get the data-item value, which should be the 'id' (e.g., "ipe")

    if (!dataItem) { //
        console.warn("No 'data-item' specified for banner-static component. Please add data-item='yourBannerId' to the div."); //
        return; //
    }

    try {
        // Assuming your banner-static.json is located relative to the components folder.
        // Adjust this path if your file structure is different.
        const response = await fetch('data/banner-static.json'); //
        const banners = await response.json(); //

        // Find the banner object in the array that matches the dataItem 'id'
        const selectedBanner = banners.find(banner => banner.id === dataItem); //

        if (selectedBanner) { //
            const bannerHtml = `
                <div class="banner-static">
                    <div class="banner-static-card" style="background-image: url('${selectedBanner["image-url"]}');">
                        <div class="banner-static-overlay"></div>
                        <div class="banner-static-container">
                            <h1 class="banner-static-title">${selectedBanner.title}</h1>
                            <p class="banner-static-text">${selectedBanner.text}</p>
                            <a class="banner-static-button" href="${selectedBanner['button-url']}" class="banner-button" target="${selectedBanner['target']}">${selectedBanner.button}</a>
                        </div>
                    </div>
                </div>
            `;
            bannerContainer.innerHTML = bannerHtml; //
        } else {
            console.warn(`Banner with id="${dataItem}" not found in banner-static.json.`); //
        }

    } catch (error) {
        console.error("Error loading or parsing banner-static.json:", error); //
    }
})();