document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.processo-card');
    const containers = document.querySelectorAll('.cards-container');

    // Adiciona os eventos em cada card
    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            // Adiciona uma classe para dar o efeito de opacidade enquanto arrasta
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
    });

    // Adiciona os eventos nas colunas (zonas de soltar)
    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault(); // Previne o comportamento padrão para permitir o "drop"
            
            // Descobre em qual posição o card deve entrar (antes ou depois de outro card)
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (afterElement == null) {
                container.appendChild(draggable); // Solta no final da lista
            } else {
                container.insertBefore(draggable, afterElement); // Solta entre os cards
            }
        });

        // NOVO: Evento de drop para atualizar o status e salvar no banco
        container.addEventListener('drop', () => {
            const draggable = document.querySelector('.dragging');
            
            // Descobre qual é a coluna atual onde o card foi solto
            const colunaPai = container.closest('.kanban-column');
            const novoStatus = colunaPai.dataset.status;

            // Se o status mudou, atualiza a interface e o banco
            if (draggable.dataset.status !== novoStatus) {
                // 1. Atualiza o visual instantaneamente (o CSS faz o resto)
                draggable.dataset.status = novoStatus;

                // 2. Chama a função para atualizar no Django
                atualizarStatusNoBanco(draggable.dataset.processoId, novoStatus);
            }
        });
    });

    // Função para enviar a atualização para sua view no Django
    function atualizarStatusNoBanco(processoId, novoStatus) {
        // Exemplo usando Fetch API. Lembre-se de criar a URL e a View correspondente no Django.
        fetch(`/processos/atualizar-status/${processoId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Necessário para o Django aceitar a requisição POST
                'X-CSRFToken': getCookie('csrftoken') 
            },
            body: JSON.stringify({ status: novoStatus })
        })
        .then(response => {
            if (!response.ok) {
                console.error("Erro ao atualizar o status no banco.");
                // Opcional: Reverter o card para a coluna anterior caso dê erro no servidor
            }
        })
        .catch(error => console.error("Erro de conexão:", error));
    }

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

    // Função matemática auxiliar para descobrir em qual vão do Kanban o mouse está
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.processo-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // Pega o meio do card para saber se o mouse está acima ou abaixo da metade dele
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
});