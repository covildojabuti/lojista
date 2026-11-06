(function () {
    const policy = Object.freeze({
        minimumOrderCents: 50000,
        freeShippingCents: 300000,
        standardShippingCents: 10000,
        pixDiscountRate: 0.02,
        boletoTerm: "15/30 dias"
    });

    window.B2B_COMMERCIAL_POLICY = policy;
    window.B2B_CRM_QUOTE_ENDPOINT = "https://covil-desktop.tail74d850.ts.net/marketing/crm/site-quote";

    function formatCurrency(cents) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
    }

    function renderPolicyText() {
        const percent = Math.round(policy.pixDiscountRate * 100);
        const copy = {
            minimum: `Pedido mínimo de ${formatCurrency(policy.minimumOrderCents)} em produtos; frete calculado à parte.`,
            shipping: `Frete fixo de ${formatCurrency(policy.standardShippingCents)}; grátis em compras acima de ${formatCurrency(policy.freeShippingCents)}.`,
            payment: `Boleto ${policy.boletoTerm}. PIX com ${percent}% de desconto nos produtos; frete sem desconto.`,
            "pix-label": `${percent}% de desconto`,
            "pix-detail": "nos produtos; frete sem desconto",
            "pix-full": `${percent}% de desconto nos produtos; o frete não recebe desconto.`,
            "pix-summary": `${percent}% nos produtos; frete sem desconto`
        };

        document.querySelectorAll("[data-commercial-policy]").forEach(element => {
            const text = copy[element.dataset.commercialPolicy];
            if (text) element.textContent = text;
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderPolicyText, { once: true });
    } else {
        renderPolicyText();
    }
})();
