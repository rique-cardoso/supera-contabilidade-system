// ===== FUNÇÕES AUXILIARES GLOBAIS =====

// Função auxiliar padrão do Django para pegar o CSRF Token pelo JS
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// ===== VARIÁVEIS GLOBAIS DE AUTO-SCROLL =====
// Definidas aqui em cima para serem acessadas por todo o arquivo
let direcaoRolagem = 0; // 0 = parado, 1 = direita, -1 = esquerda
const zonaGatilho = 100; // Distância da borda em pixels para ativar a rolagem
const velocidadeRolagem = 12; // Velocidade do auto-scroll


// ===== INICIALIZAÇÃO DO KANBAN =====
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.processo-card');
    const containers = document.querySelectorAll('.cards-container');

    // Adiciona os eventos em cada card
    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            // NOVO: Para o auto-scroll imediatamente se o usuário soltar o card
            direcaoRolagem = 0; 
        });
    });

    // Adiciona os eventos nas colunas (zonas de soltar)
    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });

        // Evento de drop para atualizar o status e salvar no banco
        container.addEventListener('drop', () => {
            const draggable = document.querySelector('.dragging');
            const colunaPai = container.closest('.kanban-column');
            const novoStatus = colunaPai.dataset.status;

            if (draggable.dataset.status !== novoStatus) {
                draggable.dataset.status = novoStatus;
                atualizarStatusNoBanco(draggable.dataset.processoId, novoStatus);
            }
        });
    });

    // Função para enviar a atualização para sua view no Django
    function atualizarStatusNoBanco(processoId, novoStatus) {
        fetch(`/api/processos/${processoId}/status/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ status: novoStatus })
        })
        .then(response => {
            if (!response.ok) {
                console.error("Erro ao atualizar o status no banco.");
            }
        })
        .catch(error => console.error("Erro de conexão:", error));
    }

    // Função matemática auxiliar para descobrir em qual vão do Kanban o mouse está
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.processo-card:not(.dragging):not(.oculto)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
});


// ===== CONTROLES DE ROLAGEM DO KANBAN (GRAB & AUTO-SCROLL) =====

// Seleciona o contêiner do Kanban
const slider = document.getElementById('kanbanBoard');

// Variáveis de controle do Grab to Scroll
let isDown = false; // Indica se o mouse está pressionando
let startX; // Posição inicial do clique no eixo X
let scrollLeft; // Posição inicial da barra de rolagem

// 1. Grab to Scroll: Quando o usuário CLICA (Aperta o botão do mouse)
slider.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
});

// 2. Grab to Scroll: Quando o usuário SOLTA o clique
slider.addEventListener('mouseup', () => {
    isDown = false;
});

// 3. Grab to Scroll: Quando o mouse SAI da área do Kanban
slider.addEventListener('mouseleave', () => {
    isDown = false;
});

// 4. Grab to Scroll: Quando o usuário MOVIMENTA o mouse
slider.addEventListener('mousemove', e => {
    if(!isDown) return;
    e.preventDefault(); 
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 2;
    slider.scrollLeft = scrollLeft - walk;
});

// 5. NOVO: Eventos para acionar o Auto-scroll ao arrastar um card
slider.addEventListener('dragover', (e) => {
    // Pega as medidas exatas do quadro na tela do usuário
    const quadroRect = slider.getBoundingClientRect();
    const posicaoMouseX = e.clientX;

    // Lógica para definir a direção com base nas zonas invisíveis da borda
    if (posicaoMouseX > quadroRect.right - zonaGatilho) {
        direcaoRolagem = 1; // Rolar para a direita
    } else if (posicaoMouseX < quadroRect.left + zonaGatilho) {
        direcaoRolagem = -1; // Rolar para a esquerda
    } else {
        direcaoRolagem = 0; // Ficar parado
    }
});

// Garante que o motor pare se o evento de soltar acontecer direto no contêiner
slider.addEventListener('drop', () => direcaoRolagem = 0);
slider.addEventListener('dragleave', () => direcaoRolagem = 0);

// 6. NOVO: O Motor de Animação do Auto-scroll
function motorDeRolagemAutomatica() {
    if (direcaoRolagem !== 0) {
        slider.scrollLeft += (direcaoRolagem * velocidadeRolagem);
    }
    // Loop infinito otimizado rodando em segundo plano (60fps)
    requestAnimationFrame(motorDeRolagemAutomatica);
}

// Dá a partida no motor quando a página carrega
motorDeRolagemAutomatica();


// ===== CONTROLE DO MODAL DE PROCESSOS =====
function fecharModalProcesso(){
    document.getElementById('modalProcessoOverlay').style.display = 'none';
}

function abrirModalCriacao(statusDestino = 'ATIVO'){
    const form = document.getElementById('formProcesso');
    form.reset();
    document.getElementById('modalTitle').childNodes[0].nodeValue = "Novo Processo ";
    document.getElementById('modalProtocoloBadge').style.display = 'none'
    form.action = '/processos/criar/';
    document.getElementById('modalProcessoOverlay').style.display = 'flex';
}

function editarProcesso(processoId) {
    fetch(`/api/processos/${processoId}/obter/`)
        .then(response => {
            if(!response.ok) throw new Error("Erro ao buscar dados do processo");
            return response.json();
        })
        .then(data => {
            document.getElementById('id_nome').value = data.nome || '';
            document.getElementById('id_protocolo').value = data.protocolo || '';
            document.getElementById('id_descricao').value = data.descricao || '';
            document.getElementById('id_orgao').value = data.orgao || 'PREFEITURA';
            document.getElementById('id_categoria').value = data.categoria || 'FUNCIONAMENTO';

            if (data.empresa_id) {
                document.getElementById('id_empresa').value = data.empresa_id;
            }
            if (data.data_vencimento) {
                document.getElementById('id_data_vencimento').value = data.data_vencimento;
            }

            document.getElementById('modalTitle').childNodes[0].nodeValue = data.nome || '';
            const badge = document.getElementById('modalProtocoloBadge');
            badge.innerText = `Protocolo: ${data.protocolo}`;
            badge.style.display = 'inline-block';
            document.getElementById('formProcesso').action = `/processos/editar/${processoId}/`;
            document.getElementById('modalProcessoOverlay').style.display = 'flex';
        })
        .catch(error => {
            console.error(error);
            alert("Não foi possível carregar as informações do processo.")
        })
}


// ===== CONTROLE DO MENU DROPDOWN =====
function toggleMenuOpcoes(event, processoId){
    event.preventDefault();
    event.stopPropagation(); 

    document.querySelectorAll('.dropdown-conteudo').forEach(menu => {
        if(menu.id !== `dropdown-${processoId}`){
            menu.classList.remove('mostrar');
        }
    })

    const menuAtual = document.getElementById(`dropdown-${processoId}`);
    if(menuAtual){
        menuAtual.classList.toggle('mostrar');
    }
}

window.addEventListener('click', function(event){
    if(!event.target.closest('.dropdown-opcoes-card')){
        document.querySelectorAll('.dropdown-conteudo').forEach(menu => {
            menu.classList.remove('mostrar');
        });
    }
});


// ===== FUNÇÕES DE DELEÇÃO =====
function softDeleteProcesso(event, processoId){
    event.preventDefault();

    if(!confirm("Deseja realmente EXCLUIR este processo? Ele será movido para a coluna de Excluídos.")){
        return; 
    }

    fetch(`/processos/${processoId}/deletar/`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => {
        if(response.ok){
            const card = document.querySelector(`.processo-card[data-processo-id="${processoId}"]`);
            const colunaExcluidos = document.querySelector('.kanban-column[data-status="EXCLUIDO"] .cards-container');

            if(card && colunaExcluidos){
                colunaExcluidos.appendChild(card);
                card.dataset.status = 'EXCLUIDO';
                document.getElementById(`dropdown-${processoId}`).classList.remove('mostrar');
            } else if(card){
                card.remove();
            }
        }else{
            alert("Erro ao excluir o processo.");
        }
    })
    .catch(error => console.error("Erro na requisição:", error));
}

function hardDeleteProcesso(event, processoId){
    event.preventDefault();

    if(!confirm("ATENÇÃO: Você está prestes a APAGAR DEFINITIVAMENTE este processo do banco de dados. Esta ação é irreversível. Continuar?")){
        return; 
    }

    fetch(`/processos/${processoId}/apagar/`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => {
        if(response.ok){
            const card = document.querySelector(`.processo-card[data-processo-id="${processoId}"]`);
            if(card){
                card.remove();
            }
        }else if(response.status === 403){
            alert("Você não tem permissão para realizar esta ação.");
        }else{
            alert("Erro ao tentar apagar o processo do banco de dados.");
        }
    })
    .catch(error => console.error("Erro na requisição:", error));
}

// ===== FILTRAGEM E BUSCA =====
const btns_filtro = document.querySelectorAll('.btn-filtro');

// 1. Função central que executa a filtragem
function aplicarFiltro() {
    // Descobre qual botão está com a classe ativada
    const botaoAtivo = document.querySelector('.btn-filtro.btn-filtro__actived');
    if (!botaoAtivo) return;

    // Pega o nome do órgão (ex: "PREFEITURA") e transforma em maiúsculo por segurança
    const orgaoSelecionado = botaoAtivo.dataset.filtro.toUpperCase();
    
    // Seleciona todos os cards do quadro
    const todos_cards = document.querySelectorAll('.processo-card');

    todos_cards.forEach(card => {
        // Pega a informação do card
        const orgaoCard = card.dataset.orgao ? card.dataset.orgao.toUpperCase() : '';
        
        // Se bater com o botão ativo, remove a classe oculto. Se não, adiciona a classe.
        if (orgaoCard === orgaoSelecionado) {
            card.classList.remove('oculto');
        } else {
            card.classList.add('oculto');
        }
    });
}

// 2. Adiciona o evento de clique em cada botão
btns_filtro.forEach(botaoClicado => {
    botaoClicado.addEventListener('click', () => {
        // Alterna o visual (desativa todos, ativa o clicado)
        btns_filtro.forEach(btn => btn.classList.remove('btn-filtro__actived'));
        botaoClicado.classList.add('btn-filtro__actived');
        
        // Dispara a filtragem
        aplicarFiltro();
    });
});

// 3. Aplica o filtro inicial ao carregar a tela
// Como o botão "Prefeitura" já vem com a classe actived no HTML, 
// ele já iniciará a tela mostrando apenas a Prefeitura.
document.addEventListener('DOMContentLoaded', aplicarFiltro);