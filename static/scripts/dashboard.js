// ============================================================
// UTILITÁRIOS
// Duplicado do gerenciamento_processos.js por ora.
// Em um projeto maior, isso estaria em um utils.js compartilhado.
// ============================================================
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


// ============================================================
// GRÁFICO DE PIZZA (Chart.js)
// dadosGrafico vem do bloco <script> no template (dashboard.html)
// ============================================================
const canvasGrafico = document.getElementById('graficoPorStatus');

if (canvasGrafico) {
    // Caso extremo: sem processos cadastrados ainda.
    // Chart.js mostra uma pizza vazia, o que é confuso.
    // Melhor mostrar uma mensagem amigável.
    const totalProcessos = dadosGrafico.data.reduce((soma, val) => soma + val, 0);

    if (totalProcessos === 0) {
        const container = canvasGrafico.parentElement;
        container.innerHTML = '<p style="text-align:center;margin:auto;color:#A2A2A2;font-size:0.85rem;">Nenhum processo cadastrado.</p>';
    } else {
        new Chart(canvasGrafico, {
            type: 'pie',
            data: {
                labels: dadosGrafico.labels,
                datasets: [{
                    data: dadosGrafico.data,
                    backgroundColor: dadosGrafico.cores,
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    hoverOffset: 8, // Fatia "cresce" levemente no hover
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 14,
                            font: { size: 11, family: 'Inter' },
                            usePointStyle: true, // Bolinha em vez de quadrado
                            pointStyle: 'circle',
                        }
                    },
                    tooltip: {
                        callbacks: {
                            // Customiza o texto do tooltip para incluir percentual
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `  ${context.parsed} processos (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}


// ============================================================
// ATUALIZAÇÃO DE VISTORIA
// Chamado pelo onclick nos botões de concluir/cancelar no template
// ============================================================
function atualizarVistoria(vistoriaId, novoStatus) {
    const rotulos = {
        REALIZADA: 'marcar como realizada',
        CANCELADA: 'cancelar',
    };

    const confirmacao = confirm(`Deseja realmente ${rotulos[novoStatus] || 'alterar'} esta vistoria?`);
    if (!confirmacao) return;

    fetch(`/api/vistorias/${vistoriaId}/status/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({ status: novoStatus }),
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro na requisição');
        return response.json();
    })
    .then(() => {
        // Feedback visual: anima a saída do item antes de removê-lo do DOM.
        // Isso é muito melhor do que sumir abruptamente.
        const item = document.getElementById(`vistoria-item-${vistoriaId}`);
        if (item) {
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            item.style.opacity = '0';
            item.style.transform = 'translateX(15px)';

            // Remove o elemento depois que a animação termina
            setTimeout(() => {
                item.remove();

                // Se a lista ficou vazia, mostra mensagem de estado vazio
                const lista = document.getElementById('lista-vistorias');
                if (lista && lista.children.length === 0) {
                    lista.innerHTML = '<p class="panel-empty">Nenhuma vistoria agendada.</p>';
                }
            }, 300);
        }
    })
    .catch(error => {
        console.error('Erro ao atualizar vistoria:', error);
        alert('Não foi possível atualizar a vistoria. Tente novamente.');
    });
}
// ============================================================
// LIMPAR NOTIFICAÇÃO (marcar como lida)
// NÃO deleta do banco — apenas set is_lida=True.
// O dashboard filtra is_lida=False, então não reaparece.
// ============================================================
function limparNotificacao(notificacaoId) {
    fetch(`/api/notificacoes/${notificacaoId}/lida/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro na requisição');
        return response.json();
    })
    .then(() => {
        const card = document.getElementById(`notificacao-item-${notificacaoId}`);
        if (!card) return;

        // Passo 1: anima a saída — desliza para a direita enquanto some
        card.style.opacity = '0';
        card.style.transform = 'translateX(15px)';

        // Passo 2: após a animação de fade, colapsa a altura para
        // que os cartões abaixo subam suavemente (sem "pulo" brusco)
        setTimeout(() => {
            card.style.maxHeight = card.offsetHeight + 'px'; // trava altura atual
            card.style.transition = 'max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease';
            card.style.maxHeight = '0';
            card.style.paddingTop = '0';
            card.style.paddingBottom = '0';
            card.style.marginBottom = '0';

            // Passo 3: remove do DOM depois que tudo colapsar
            setTimeout(() => {
                card.remove();

                // Estado vazio: se não há mais notificações, mostra mensagem
                const lista = document.getElementById('lista-notificacoes');
                if (lista && lista.children.length === 0) {
                    lista.innerHTML = '<p class="panel-empty">Nenhuma notificação pendente. ✅</p>';
                }
            }, 350);
        }, 300);
    })
    .catch(error => {
        console.error('Erro ao marcar notificação como lida:', error);
        alert('Não foi possível limpar a notificação. Tente novamente.');
    });
}