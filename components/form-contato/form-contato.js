(async function () {
    const form = document.querySelector("#form-contato");
    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            console.log("Enviando formulário...");

            const dados = {
                nome: form.nome.value,
                email: form.email.value,
                whatsapp: form.whatsapp.value,
                mensagem: form.mensagem.value
            };

            try {
                // Adicione '/dev' após 'exec' se estiver testando em desenvolvimento
                const url = "https://script.google.com/macros/s/AKfycby5IVP3kiQrfZZ6vF7sLk6u0bkeJO_xFHL41F9G7ocg7X4nfmo4nOuUyEaqT5TsZo2f/exec";

                const response = await fetch(url, {
                    method: "POST",
                    body: JSON.stringify(dados),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    // Importante para Google Apps Script
                    mode: 'no-cors'
                });

                // Mesmo com mode: 'no-cors', você não terá acesso à resposta
                // Mas a requisição será enviada
                console.log("Requisição enviada");
                alert("Formulário enviado com sucesso!");
                form.reset();
            } catch (err) {
                console.error("Erro ao enviar:", err);
                alert("Ocorreu um erro. Tente novamente.");
            }
        });
    }
})();