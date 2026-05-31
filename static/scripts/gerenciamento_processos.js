document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.kanban-card');
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
    });

    // Função matemática auxiliar para descobrir em qual vão do Kanban o mouse está
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];

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