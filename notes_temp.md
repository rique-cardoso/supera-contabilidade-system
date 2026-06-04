Compreendi perfeitamente a sua necessidade. É muito comum e uma excelente prática de negócio separar o "Soft Delete" (arquivar/excluir logicamente alterando o status) do "Hard Delete" (apagar definitivamente do banco de dados), limitando ações destrutivas apenas a usuários com privilégios de administrador. 

Como você já tem o modelo Usuario com o campo role e o status EXCLUIDO mapeado no modelo Processo, vamos construir essa solução de ponta a ponta. 

Abaixo, detalho o passo a passo de como implementar as *Views* (Backend), o *Template* (HTML), o *Estilo* (CSS) e os comportamentos no *JavaScript*. 

### Passo 1: Atualizar o Backend (Views e URLs) 

Você já tem a função de *Soft Delete* (deletar_processo). Precisamos criar a função de *Hard Delete* (apagar_processo) e garantir que **apenas o admin** possa executá-la, protegendo o backend. 

Adicione ao seu core/views.py: 

```python 

from django.http import JsonResponse 

from django.shortcuts import get_object_or_404 

from django.views.decorators.http import require_http_methods 

from django.contrib.auth.decorators import login_required 

from .models import Processo 

 

# 1. SOFT DELETE (O que você já tinha) 

@login_required 

@require_http_methods(["DELETE"]) 

def deletar_processo(request, processo_id): 

    """ Deleta um processo (marca como EXCLUIDO, não remove do BD) """ 

    processo = get_object_or_404(Processo, id=processo_id) 

    processo.status = 'EXCLUIDO' 

    processo.save() 

    return JsonResponse({'mensagem': 'Processo movido para a lixeira (Status alterado).'}) 

 

# 2. HARD DELETE (Novo) 

@login_required 

@require_http_methods(["DELETE"]) 

def apagar_processo(request, processo_id): 

    """ Apaga definitivamente do BD. Exclusivo para admins. """ 

    # Proteção extra no backend 

    if request.user.role != 'admin': 

        return JsonResponse({'erro': 'Sem permissão para apagar processos.'}, status=403) 

     

    processo = get_object_or_404(Processo, id=processo_id) 

    processo.delete() # Remove de fato a linha da tabela 

    return JsonResponse({'mensagem': 'Processo apagado permanentemente do banco de dados.'}) 

 

``` 

Adicione ao seu setup/urls.py: 

```python 

path('processos/<int:processo_id>/deletar/', deletar_processo, name='deletar_processo'), 

path('processos/<int:processo_id>/apagar/', apagar_processo, name='apagar_processo'), 

 

``` 

### Passo 2: Atualizar o HTML (Template) 

Substitua o seu botão simples dos "três pontinhos" por uma estrutura de **Dropdown** (menu suspenso). Usaremos as *Template Tags* do Django ({% if request.user.role == 'admin' %}) para condicionar a exibição da opção "Apagar". 

No seu template HTML (onde o card é gerado), atualize a estrutura de ações: 

```html 

<div class="processo-card" data-processo-id="{{ processo.id }}" data-status="{{ processo.status }}"> 

     

    <div class="dropdown-opcoes-card"> 

        <button class="btn-card-acao btn-opcoes-dropdown" onclick="toggleMenuOpcoes(event, '{{ processo.id }}')" title="Mais opções"> 

            <i class="fa-solid fa-ellipsis"></i> 

        </button> 

         

        <div id="dropdown-{{ processo.id }}" class="dropdown-conteudo"> 

            <a href="#" onclick="softDeleteProcesso(event, '{{ processo.id }}')"> 

                <i class="fa-solid fa-trash-can"></i> Excluir Processo 

            </a> 

             

            {% if request.user.role == 'admin' %} 

            <a href="#" class="btn-perigo" onclick="hardDeleteProcesso(event, '{{ processo.id }}')"> 

                <i class="fa-solid fa-skull-crossbones"></i> Apagar Definitivo 

            </a> 

            {% endif %} 

        </div> 

    </div> 

</div> 

 

``` 

### Passo 3: Adicionar o CSS do Dropdown 

Para que o menu fique oculto e apareça como uma caixinha flutuante por cima do card, adicione este CSS ao seu arquivo de estilos: 

```css 

/* Container do botão de opções */ 

.dropdown-opcoes-card { 

    position: relative; 

    display: inline-block; 

} 

 

/* O conteúdo (menu em si) escondido por padrão */ 

.dropdown-conteudo { 

    display: none; 

    position: absolute; 

    right: 0; 

    top: 100%; 

    background-color: #ffffff; 

    min-width: 170px; 

    box-shadow: 0px 4px 12px rgba(0,0,0,0.15); 

    z-index: 10; /* Garante que fique por cima de outros cards */ 

    border-radius: 6px; 

    overflow: hidden; 

    border: 1px solid #e0e0e0; 

} 

 

/* Classe que será adicionada pelo JS para mostrar o menu */ 

.dropdown-conteudo.mostrar { 

    display: block; 

} 

 

/* Estilo dos links dentro do dropdown */ 

.dropdown-conteudo a { 

    color: #333333; 

    padding: 10px 14px; 

    text-decoration: none; 

    display: block; 

    font-size: 14px; 

    transition: background-color 0.2s; 

} 

 

.dropdown-conteudo a:hover { 

    background-color: #f5f5f5; 

} 

 

/* Estilo específico para o botão de apagar definitivo do admin */ 

.dropdown-conteudo a.btn-perigo { 

    color: #dc3545; /* Vermelho */ 

    font-weight: bold; 

} 

 

.dropdown-conteudo a.btn-perigo:hover { 

    background-color: #ffe6e6; 

} 

 

``` 

### Passo 4: Atualizar o seu gerenciamento_processo.js 

Adicione as funções JavaScript abaixo no final do seu arquivo gerenciamento_processo.js. Elas cuidarão de abrir/fechar o menu e fazer as requisições FETCH para o seu backend. 

```javascript 

// ===== CONTROLE DO MENU DROPDOWN (TRÊS PONTINHOS) ===== 

 

// Função para abrir/fechar o menu do card específico 

function toggleMenuOpcoes(event, processoId) { 

    event.preventDefault(); 

    event.stopPropagation(); // Evita que o evento de drag dispare acidentalmente 

     

    // Fecha qualquer outro dropdown que esteja aberto na tela 

    document.querySelectorAll('.dropdown-conteudo').forEach(menu => { 

        if (menu.id !== `dropdown-${processoId}`) { 

            menu.classList.remove('mostrar'); 

        } 

    }); 

 

    // Alterna o estado do dropdown clicado 

    const menuAtual = document.getElementById(`dropdown-${processoId}`); 

    if (menuAtual) { 

        menuAtual.classList.toggle('mostrar'); 

    } 

} 

 

// Fecha o dropdown se o usuário clicar em qualquer outro lugar da tela 

window.addEventListener('click', function(event) { 

    if (!event.target.closest('.dropdown-opcoes-card')) { 

        document.querySelectorAll('.dropdown-conteudo').forEach(menu => { 

            menu.classList.remove('mostrar'); 

        }); 

    } 

}); 

 

 

// ===== FUNÇÕES DE DELEÇÃO ===== 

 

// 1. SOFT DELETE (Excluir/Mudar Status) - Usuário Padrão e Admin 

function softDeleteProcesso(event, processoId) { 

    event.preventDefault(); 

     

    if (!confirm("Deseja realmente EXCLUIR este processo? Ele será movido para a coluna de Excluídos.")) { 

        return; // Usuário cancelou 

    } 

 

    fetch(`/processos/${processoId}/deletar/`, { 

        method: 'DELETE', 

        headers: { 

            'Content-Type': 'application/json', 

            'X-CSRFToken': getCookie('csrftoken') 

        } 

    }) 

    .then(response => { 

        if (response.ok) { 

            // Sucesso! Busca o card no DOM 

            const card = document.querySelector(`.processo-card[data-processo-id="${processoId}"]`); 

             

            // Busca a coluna Kanban de excluídos 

            const colunaExcluidos = document.querySelector('.kanban-column[data-status="EXCLUIDO"] .cards-container'); 

             

            if (card && colunaExcluidos) { 

                // Move o card visualmente para a coluna de excluídos e atualiza o status 

                colunaExcluidos.appendChild(card); 

                card.dataset.status = 'EXCLUIDO'; 

                // Opcional: esconder o dropdown após a ação 

                document.getElementById(`dropdown-${processoId}`).classList.remove('mostrar'); 

            } else if (card) { 

                // Caso você não renderize a coluna "EXCLUIDO" na tela, apenas remova o card da visão 

                card.remove(); 

            } 

        } else { 

            alert("Erro ao excluir o processo."); 

        } 

    }) 

    .catch(error => console.error("Erro na requisição:", error)); 

} 

 

 

// 2. HARD DELETE (Apagar/Limpar) - Apenas Admin 

function hardDeleteProcesso(event, processoId) { 

    event.preventDefault(); 

     

    if (!confirm("ATENÇÃO: Você está prestes a APAGAR DEFINITIVAMENTE este processo do banco de dados. Esta ação é irreversível. Continuar?")) { 

        return; // Usuário cancelou 

    } 

 

    fetch(`/processos/${processoId}/apagar/`, { 

        method: 'DELETE', 

        headers: { 

            'Content-Type': 'application/json', 

            'X-CSRFToken': getCookie('csrftoken') 

        } 

    }) 

    .then(response => { 

        if (response.ok) { 

            // Sucesso! Remove o card do DOM para sempre. 

            const card = document.querySelector(`.processo-card[data-processo-id="${processoId}"]`); 

            if (card) { 

                card.remove(); 

            } 

        } else if (response.status === 403) { 

            alert("Você não tem permissão para realizar esta ação."); 

        } else { 

            alert("Erro ao tentar apagar o processo do banco de dados."); 

        } 

    }) 

    .catch(error => console.error("Erro na requisição:", error)); 

} 

 

``` 