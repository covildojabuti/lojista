(async function () {
    const form = document.querySelector("#form-contato");
    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            console.log("Enviando formul�rio...");

            const dados = {
                razaosocial: form.razaosocial.value,
                cidade: form.cidade.value,
                estado: form.estado.value,
                nomesobrenome: form.nomesobrenome.value,
                ramoatividade: form.ramoatividade.value,
                email: form.email.value,
                whatsapp: form.whatsapp.value,
                faturamento: form.faturamento.value,
                qtdefunc: form.qtdefunc.value,
                maiorproblema: form.maiorproblema.value
            };

            try {
                // Adicione '/dev' ap�s 'exec' se estiver testando em desenvolvimento
                const url = "https://script.google.com/macros/s/AKfycbykwrdaUQHtpOJG0vzkez_MFogaILw5yu9yTgOKNfaaNvTd-5Wd0MufkhwLLTAv2r4BFQ/exec";

                const response = await fetch(url, {
                    method: "POST",
                    body: JSON.stringify(dados),
                    headers: {
                        "Content-Type": "application/json"
                    },
                    // Importante para Google Apps Script
                    mode: 'no-cors'
                });

                // Mesmo com mode: 'no-cors', voc� n�o ter� acesso � resposta
                // Mas a requisi��o ser� enviada
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