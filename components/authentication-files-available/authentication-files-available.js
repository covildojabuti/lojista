// authentication-files-available.js
// Este script lida com a lógica da área de arquivos disponíveis, carregando-os de um JSON.

(async function() {
    // Obtém referências aos elementos HTML
    const filesContainer = document.getElementById('files-container');
    const displayNameSpan = document.getElementById('display-user-name');
    const logoutLink = document.querySelector('.logout-btn'); // O botão de logout
    const filesMessageDiv = document.getElementById('files-message'); // Div para mensagens de feedback
    const excelFilesGrid = document.getElementById('excel-files-grid');
    const pdfFilesGrid = document.getElementById('pdf-files-grid');
    const businessSegmentSelect = document.getElementById('business-segment-select'); // O select para o segmento

    // URL do seu Google Apps Script para rastreamento de downloads e envio de e-mail
    const GOOGLE_APPS_SCRIPT_DOWNLOAD_TRACKING_URL = "https://script.google.com/macros/s/AKfycbzvQpeW5amFcQKT7iUzBTllhXAuNYfsWIBrmFSQbmfvyDk73h7fpLEeUV38nzoH58akvw/exec";
    // URL do arquivo JSON com a lista de arquivos
    const FILES_JSON_URL = "./data/authentication-files-available.json"; // Ajuste o caminho se necessário
    // URL do arquivo JSON com os tipos de negócio/segmentos
    const BUSINESS_TYPES_JSON_URL = "./data/business-types.json";

    // Variáveis para armazenar o e-mail e nome do usuário logado (serão preenchidas pelo script principal)
    let currentUserEmail = null;
    let currentUserName = null;
    let allFilesData = []; // Armazenará todos os arquivos carregados
    let businessTypesData = []; // Armazenará todos os tipos de negócio/segmentos

    /**
     * Exibe uma mensagem de feedback para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo da mensagem ('success' ou 'error').
     */
    function showMessage(message, type) {
        filesMessageDiv.textContent = message;
        filesMessageDiv.className = `auth-message ${type}`; // Adiciona a classe de estilo
        filesMessageDiv.style.display = 'block'; // Mostra a div
        // Opcional: esconder a mensagem após alguns segundos
        const displayDuration = (type === 'success') ? 10000 : 5000;
        setTimeout(() => {
            filesMessageDiv.style.display = 'none';
        }, displayDuration);
        console.log(`showMessage: Exibindo mensagem de ${type}: "${message}" por ${displayDuration / 1000} segundos.`);
    }

    /**
     * Atualiza as informações do usuário na interface.
     * Esta função será chamada pelo script principal da página.
     * @param {string} name - O nome do usuário.
     * @param {string} email - O e-mail do usuário.
     */
    function updateUserInfo(name, email) {
        currentUserName = name;
        currentUserEmail = email;
        if (displayNameSpan) {
            displayNameSpan.textContent = name || email; // Exibe o nome ou e-mail
        }
        console.log("updateUserInfo: Usuário atualizado para:", { name, email });
    }

    // Adiciona listener para o botão de logout
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Previne o comportamento padrão do link
            console.log("Logout clicado.");
            // Dispara um evento personalizado para o gerenciador de componentes lidar com o logout
            window.dispatchEvent(new CustomEvent('auth:navigate', { detail: { action: 'logout' } }));
        });
    }

    /**
     * Adiciona listeners de clique aos links de download.
     * Esta função é chamada após os arquivos serem renderizados dinamicamente.
     */
    function attachDownloadListeners() {
        // Seleciona TODOS os links de download (agora criados dinamicamente)
        const downloadLinks = document.querySelectorAll('.file-link');

        downloadLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault(); // Impede o download direto!
                console.log("Download link clicado.");

                if (!currentUserEmail) {
                    console.warn("Usuário não logado. Não é possível processar o download. currentUserName:", currentUserName, "currentUserEmail:", currentUserEmail);
                    showMessage("Por favor, faça login para acessar os downloads.", 'error');
                    return;
                }
                console.log("currentUserEmail está definido:", currentUserEmail);

                // Encontra o link pai mais próximo para obter os dados
                const clickedLink = e.target.closest('.file-link');
                if (!clickedLink) {
                    console.error("Elemento clicado não é um link de arquivo ou não está dentro de um.");
                    showMessage("Erro ao processar o clique no arquivo. Tente novamente.", 'error');
                    return;
                }

                const fileName = clickedLink.dataset.filename; // Obtém o nome do arquivo do atributo data-filename
                const fileUrl = clickedLink.href; // Obtém o URL direto do arquivo

                console.log(`Solicitação de download para '${fileName}' (${fileUrl}) por '${currentUserEmail}'`);

                // Enviar dados como 'application/x-www-form-urlencoded'
                const params = new URLSearchParams();
                params.append('action', 'track_download'); // Ação para o Apps Script
                params.append('email', currentUserEmail);
                params.append('fileName', fileName);
                params.append('fileUrl', fileUrl); // Envia o URL do arquivo
                console.log("Parâmetros para o fetch:", params.toString());

                try {
                    console.log("Iniciando requisição fetch...");
                    const response = await fetch(GOOGLE_APPS_SCRIPT_DOWNLOAD_TRACKING_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: params.toString()
                    });
                    console.log("Resposta fetch recebida:", response);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Erro HTTP na resposta do servidor: ${response.status} - ${errorText}`);
                        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
                    }

                    const result = await response.text();
                    console.log(`Resposta do Apps Script para solicitação de download: ${result}`);

                    if (result.trim() === "OK") {
                        console.log("Download registrado e e-mail enviado com sucesso (resposta OK do Apps Script).");
                        // Mensagem de sucesso aprimorada
                        showMessage(`🎉 O link para baixar "${fileName}" foi enviado com sucesso para o seu e-mail (${currentUserEmail}). Verifique sua caixa de entrada!`, 'success');
                    } else {
                        console.warn(`Apps Script retornou um status diferente de OK: ${result}`);
                        showMessage(`Erro ao processar o download: ${result}`, 'error');
                    }

                } catch (error) {
                    console.error("Erro na requisição de download (catch block):", error);
                    showMessage("Ocorreu um erro ao tentar processar o download. Verifique sua conexão ou tente novamente.", 'error');
                }
            });
        });
    }

    /**
     * Filtra e renderiza os arquivos com base no segmento selecionado.
     * @param {string} selectedSegmentId - O ID do segmento selecionado (ou 'all' para todos).
     */
    function filterAndRenderFiles(selectedSegmentId) {
        let filteredFiles = [];

        if (selectedSegmentId === 'all') {
            filteredFiles = allFilesData; // Mostra todos os arquivos se 'all' for selecionado
        } else {
            // Encontra o tipo de negócio selecionado para verificar seu setor pai, se houver
            const selectedBusinessType = businessTypesData.find(type => type.id === selectedSegmentId);
            const parentSectorId = selectedBusinessType ? selectedBusinessType.parent_sector : null;

            filteredFiles = allFilesData.filter(file => {
                // Se o arquivo está disponível para 'all', ele sempre é mostrado
                if (file.available_for && file.available_for.includes('all')) {
                    return true;
                }
                // Verifica se o ID do segmento selecionado está na lista de 'available_for' do arquivo
                if (file.available_for && file.available_for.includes(selectedSegmentId)) {
                    return true;
                }
                // Se um setor pai existe para o segmento selecionado, verifica se o setor pai está na lista
                if (parentSectorId && file.available_for && file.available_for.includes(parentSectorId)) {
                    return true;
                }
                return false;
            });
        }
        renderFiles(filteredFiles); // Renderiza apenas os arquivos filtrados
    }

    /**
     * Renderiza os arquivos na interface a partir dos dados JSON.
     * @param {Array} filesToRender - Array de objetos de arquivo a serem renderizados.
     */
    function renderFiles(filesToRender) {
        excelFilesGrid.innerHTML = ''; // Limpa os grids existentes
        pdfFilesGrid.innerHTML = '';

        if (filesToRender.length === 0) {
            excelFilesGrid.innerHTML = '<p class="no-files-message">Nenhum arquivo disponível para este segmento.</p>';
            pdfFilesGrid.innerHTML = '<p class="no-files-message">Nenhum arquivo disponível para este segmento.</p>';
            return;
        }

        filesToRender.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-grid-item';

            const fileLink = document.createElement('a');
            fileLink.href = file.url;
            fileLink.target = '_blank';
            fileLink.className = 'file-link';
            fileLink.dataset.filename = file.name; // Armazena o nome do arquivo no data-attribute

            const fileIconDiv = document.createElement('div');
            fileIconDiv.className = `file-icon ${file.type}-icon`; // Usa o tipo para a classe do ícone

            const icon = document.createElement('i');
            if (file.type === 'excel') {
                icon.className = 'fas fa-file-excel';
            } else if (file.type === 'pdf') {
                icon.className = 'fas fa-file-pdf';
            }
            fileIconDiv.appendChild(icon);

            const fileNameH4 = document.createElement('h4');
            fileNameH4.className = 'file-name';
            fileNameH4.textContent = file.name;

            const fileDescriptionP = document.createElement('p');
            fileDescriptionP.className = 'file-description';
            fileDescriptionP.textContent = file.description;

            fileLink.appendChild(fileIconDiv);
            fileLink.appendChild(fileNameH4);
            fileLink.appendChild(fileDescriptionP);
            fileItem.appendChild(fileLink);

            if (file.type === 'excel') {
                excelFilesGrid.appendChild(fileItem);
            } else if (file.type === 'pdf') {
                pdfFilesGrid.appendChild(fileItem);
            }
        });

        attachDownloadListeners(); // Anexa os listeners após a renderização
    }

    /**
     * Carrega os dados dos arquivos e os tipos de negócio.
     */
    async function loadAllData() {
        try {
            // Carrega os tipos de negócio/segmentos
            console.log(`loadAllData: Carregando tipos de negócio de: ${BUSINESS_TYPES_JSON_URL}`);
            const businessTypesResponse = await fetch(BUSINESS_TYPES_JSON_URL);
            if (!businessTypesResponse.ok) {
                if (businessTypesResponse.status === 404) {
                    throw new Error(`Arquivo JSON de tipos de negócio não encontrado em ${BUSINESS_TYPES_JSON_URL}. Verifique o caminho.`);
                }
                throw new Error(`Erro ao carregar tipos de negócio: ${businessTypesResponse.status} ${businessTypesResponse.statusText}`);
            }
            businessTypesData = await businessTypesResponse.json();
            console.log("loadAllData: Tipos de negócio carregados com sucesso:", businessTypesData);

            // Popula o select de segmentos
            populateSegmentSelect();

            // Carrega os dados dos arquivos
            console.log(`loadAllData: Carregando arquivos de: ${FILES_JSON_URL}`);
            const filesResponse = await fetch(FILES_JSON_URL);
            if (!filesResponse.ok) {
                if (filesResponse.status === 404) {
                    throw new Error(`Arquivo JSON de arquivos não encontrado em ${FILES_JSON_URL}. Verifique o caminho.`);
                }
                throw new Error(`Erro ao carregar arquivos: ${filesResponse.status} ${filesResponse.statusText}`);
            }
            allFilesData = await filesResponse.json();
            console.log("loadAllData: Arquivos carregados com sucesso:", allFilesData);

            // Tenta carregar o segmento salvo do localStorage
            const savedSegment = localStorage.getItem('selectedBusinessSegment');
            if (savedSegment && businessTypesData.some(type => type.id === savedSegment)) {
                businessSegmentSelect.value = savedSegment;
                console.log(`loadAllData: Segmento '${savedSegment}' carregado do localStorage.`);
            } else {
                businessSegmentSelect.value = 'all'; // Padrão para 'Todos os Segmentos'
                localStorage.setItem('selectedBusinessSegment', 'all');
                console.log("loadAllData: Nenhum segmento salvo ou inválido, definindo para 'all'.");
            }

            // Filtra e renderiza os arquivos com base na seleção inicial (ou padrão)
            filterAndRenderFiles(businessSegmentSelect.value);

            // Adiciona o event listener para o dropdown de segmento APÓS o carregamento de dados
            businessSegmentSelect.addEventListener('change', (event) => {
                const selectedSegment = event.target.value;
                localStorage.setItem('selectedBusinessSegment', selectedSegment); // Salva a seleção
                filterAndRenderFiles(selectedSegment); // Filtra e renderiza os arquivos
                console.log(`Segmento alterado para: ${selectedSegment}. Arquivos filtrados.`);
            });


        } catch (error) {
            console.error("loadAllData: Erro ao carregar dados JSON:", error);
            showMessage(`Erro ao carregar dados: ${error.message}. Tente novamente mais tarde.`, 'error');
        }
    }

    /**
     * Popula o dropdown de seleção de segmento com os dados carregados.
     */
    function populateSegmentSelect() {
        if (!businessSegmentSelect) {
            console.error("populateSegmentSelect: businessSegmentSelect não encontrado. Não é possível popular o dropdown.");
            return;
        }
        businessSegmentSelect.innerHTML = ''; // Limpa as opções existentes

        // Adiciona a opção "Todos os Segmentos" primeiro
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Todos os Segmentos';
        businessSegmentSelect.appendChild(allOption);

        // Adiciona os setores
        const sectors = businessTypesData.filter(type => type.type === 'sector');
        sectors.forEach(sector => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = sector.name;
            businessSegmentSelect.appendChild(optgroup);

            // Adiciona os tipos de negócio que pertencem a este setor
            const businessTypesInSector = businessTypesData.filter(type => type.parent_sector === sector.id);
            businessTypesInSector.forEach(bt => {
                const option = document.createElement('option');
                option.value = bt.id;
                option.textContent = bt.name;
                optgroup.appendChild(option);
            });
        });

        // Adiciona tipos de negócio sem setor pai explícito (se houver, embora nossa estrutura atual os tenha)
        const standaloneBusinessTypes = businessTypesData.filter(type => type.type === 'business_type' && !type.parent_sector);
        standaloneBusinessTypes.forEach(bt => {
            const option = document.createElement('option');
            option.value = bt.id;
            option.textContent = bt.name;
            businessSegmentSelect.appendChild(option);
        });
        console.log("populateSegmentSelect: Dropdown de segmentos populado.");
    }

    // --- Event Listener para receber informações do usuário logado do script principal ---
    window.addEventListener('auth:updateUserInfo', (event) => {
        const { name, email } = event.detail;
        updateUserInfo(name, email);
        // Carrega e filtra os arquivos assim que as informações do usuário estiverem disponíveis
        loadAllData(); // Agora chama loadAllData para carregar ambos os JSONs
    });

    // Log inicial para verificar se o script foi carregado
    console.log("authentication-files-available.js carregado.");

    // Tenta carregar os arquivos imediatamente se o usuário já estiver logado
    // Isso cobre o caso de recarregar a página após o login, onde 'auth:updateUserInfo'
    // pode já ter sido disparado antes de este script estar pronto para ouvi-lo.
    if (currentUserName && currentUserEmail) {
        console.log("Usuário já logado na inicialização do script. Carregando arquivos...");
        loadAllData(); // Agora chama loadAllData
    } else {
        console.log("Usuário não logado na inicialização do script. Aguardando evento 'auth:updateUserInfo'...");
    }

})(); // Fim da função auto-executável
