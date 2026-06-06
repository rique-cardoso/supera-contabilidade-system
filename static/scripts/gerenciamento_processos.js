/* ════════════════════════════════════════════════════════════════
   gerenciamento_processos.js

   1. Utilitários
   2. Estado do Modal
   3. Kanban (drag-drop e scroll)
   4. Modal Principal
   5. Chips de Responsáveis
   6. Empresa e Cliente
   7. Fases do Processo
   8. Vistorias
   9. Processos Relacionados
   10. Sub-modais (Endereço e Anexos)
   11. Menus, Deleção e Filtros
   ════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════
   1. UTILITÁRIOS
   ══════════════════════════════════════════ */

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        document.cookie.split(';').forEach(cookie => {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            }
        });
    }
    return cookieValue;
}

// Atrasa a execução de uma função — evita disparar uma request
// a cada tecla digitada nos campos de busca
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Clona o conteúdo de um <template> e retorna o elemento raiz.
// Mais seguro e legível do que construir HTML como string no JS.
function clonarTemplate(templateId) {
    return document.getElementById(templateId).content.cloneNode(true).firstElementChild;
}

// Wrapper para fetch: injeta CSRF, define Content-Type quando necessário
// e converte erros HTTP em exceções JS para tratamento uniforme com .catch()
async function fetchJSON(url, options = {}) {
    const headers = { 'X-CSRFToken': getCookie('csrftoken') };

    // Não define Content-Type para FormData:
    // o browser precisa definir sozinho para incluir o "boundary" do multipart
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.erro || `Erro HTTP ${response.status}`);
    }

    return response.json();
}


/* ══════════════════════════════════════════
   2. ESTADO DO MODAL
   ══════════════════════════════════════════ */

// Fonte de verdade centralizada — evita variáveis globais espalhadas.
// Qualquer função sabe qual processo está aberto lendo estado.processoId.
const estado = {
    processoId: null,       // null = modo criação; número = modo edição
    itemAnexosId: null,     // item de checklist com sub-modal de anexos aberto
    enderecoCompleto: '',   // texto completo do endereço para o sub-modal
};

// Map de responsáveis selecionados: id (string) → nome
// Map preserva ordem de inserção e facilita verificar duplicatas
const chipsSelecionados = new Map();


/* ══════════════════════════════════════════
   3. KANBAN — DRAG & DROP E SCROLL
   ══════════════════════════════════════════ */

let direcaoRolagem = 0;
const zonaGatilho = 100;
const velocidadeRolagem = 12;

document.addEventListener('DOMContentLoaded', () => {
    // Drag & drop nos cards do Kanban
    document.querySelectorAll('.processo-card').forEach(card => {
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            direcaoRolagem = 0;
        });
    });

    document.querySelectorAll('.cards-container').forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            const afterEl = getDragAfterElement(container, e.clientY);
            if (afterEl == null) container.appendChild(draggable);
            else container.insertBefore(draggable, afterEl);
        });

        container.addEventListener('drop', () => {
            const draggable = document.querySelector('.dragging');
            const novoStatus = container.closest('.kanban-column').dataset.status;
            if (draggable.dataset.status !== novoStatus) {
                draggable.dataset.status = novoStatus;
                atualizarStatusNoBanco(draggable.dataset.processoId, novoStatus);
            }
        });
    });

    // Inicializa os elementos interativos do modal (eventos em elementos estáticos,
    // configurados uma única vez, não a cada abertura do modal)
    inicializarChips();
    inicializarBuscaRelacionado();

    // Aplica o filtro inicial conforme o botão ativo no HTML
    aplicarFiltro();
});

function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll('.processo-card:not(.dragging):not(.oculto)')];
    return elements.reduce((closest, child) => {
        const offset = y - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function atualizarStatusNoBanco(processoId, novoStatus) {
    fetchJSON(`/api/processos/${processoId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: novoStatus }),
    }).catch(err => console.error('Erro ao atualizar status no banco:', err));
}

// Grab-to-scroll no quadro Kanban
const slider = document.getElementById('kanbanBoard');
let isDown = false, startX, scrollLeft;

slider.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
});
slider.addEventListener('mouseup', () => isDown = false);
slider.addEventListener('mouseleave', () => isDown = false);
slider.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 2;
});

// Auto-scroll ao arrastar cards até a borda do quadro
slider.addEventListener('dragover', e => {
    const rect = slider.getBoundingClientRect();
    if (e.clientX > rect.right - zonaGatilho) direcaoRolagem = 1;
    else if (e.clientX < rect.left + zonaGatilho) direcaoRolagem = -1;
    else direcaoRolagem = 0;
});
slider.addEventListener('drop', () => direcaoRolagem = 0);
slider.addEventListener('dragleave', () => direcaoRolagem = 0);

function motorDeRolagemAutomatica() {
    if (direcaoRolagem !== 0) slider.scrollLeft += direcaoRolagem * velocidadeRolagem;
    requestAnimationFrame(motorDeRolagemAutomatica);
}
motorDeRolagemAutomatica();


/* ══════════════════════════════════════════
   4. MODAL PRINCIPAL
   ══════════════════════════════════════════ */

function fecharModalProcesso() {
    document.getElementById('modalProcessoOverlay').style.display = 'none';
    // Limpa o estado ao fechar para não "vazar" dados de um processo
    // para a próxima abertura do modal
    estado.processoId = null;
    chipsSelecionados.clear();
}

function abrirModalCriacao() {
    estado.processoId = null;

    document.getElementById('formProcesso').reset();
    document.getElementById('formProcesso').action = '/processos/criar/';

    document.getElementById('modalTitle').textContent = 'Novo Processo';
    document.getElementById('modalProtocoloBadge').style.display = 'none';
    document.getElementById('modalInfoBadges').style.display = 'none';
    document.getElementById('btnSubmitProcesso').textContent = 'Criar Processo';

    // Seções que só fazem sentido após o processo existir no banco
    document.getElementById('grupoProcessoRelacionado').style.display = 'none';
    document.getElementById('btnAdicionarVistoria').style.display = 'none';
    document.getElementById('formNovaVistoria').style.display = 'none';

    document.getElementById('fasesContainer').innerHTML =
        '<p class="modal-empty-state">As fases serão criadas automaticamente após salvar.</p>';
    document.getElementById('vistoriasContainer').innerHTML =
        '<p class="modal-empty-state">Nenhuma vistoria agendada.</p>';
    document.getElementById('relacionadosContainer').innerHTML =
        '<p class="modal-empty-state">Nenhum processo relacionado.</p>';

    limparCardEmpresa();
    limparCardCliente();
    resetarChips();

    document.getElementById('modalProcessoOverlay').style.display = 'flex';
}

function editarProcesso(processoId) {
    estado.processoId = processoId;

    // Abre o modal imediatamente com estado de "carregando" para dar
    // feedback visual enquanto a request está em andamento
    document.getElementById('modalTitle').textContent = 'Carregando...';
    document.getElementById('modalProtocoloBadge').style.display = 'none';
    document.getElementById('modalInfoBadges').style.display = 'none';
    document.getElementById('btnSubmitProcesso').textContent = 'Salvar Alterações';
    document.getElementById('modalProcessoOverlay').style.display = 'flex';

    fetchJSON(`/api/processos/${processoId}/completo/`)
        .then(data => popularModalEdicao(data))
        .catch(err => {
            alert(`Não foi possível carregar o processo: ${err.message}`);
            fecharModalProcesso();
        });
}

function popularModalEdicao(data) {
    document.getElementById('formProcesso').action = `/processos/${data.id}/editar/`;

    popularCamposBasicos(data);
    popularBadgesHeader(data);
    popularChipsIniciais(data.responsaveis);
    popularFases(data.fases);
    popularVistorias(data.vistorias);
    popularRelacionados(data.processos_relacionados);

    if (data.empresa) {
        renderizarCardEmpresa(data.empresa);
        estado.enderecoCompleto = data.empresa.endereco?.completo || 'Endereço não cadastrado.';
    } else {
        limparCardEmpresa();
    }

    data.cliente ? renderizarCardCliente(data.cliente) : limparCardCliente();

    // Exibe as seções exclusivas do modo edição
    document.getElementById('grupoProcessoRelacionado').style.display = '';
    document.getElementById('btnAdicionarVistoria').style.display = '';
}

function popularCamposBasicos(data) {
    document.getElementById('modalTitle').textContent = data.nome;

    const badge = document.getElementById('modalProtocoloBadge');
    badge.textContent = `Protocolo: ${data.protocolo}`;
    badge.style.display = 'inline-flex';

    document.getElementById('id_nome').value = data.nome || '';
    document.getElementById('id_protocolo').value = data.protocolo || '';
    document.getElementById('id_descricao').value = data.descricao || '';
    document.getElementById('id_orgao').value = data.orgao || 'PREFEITURA';
    document.getElementById('id_categoria').value = data.categoria || 'FUNCIONAMENTO';
    document.getElementById('id_data_vencimento').value = data.data_vencimento || '';

    if (data.empresa_id) {
        document.getElementById('id_empresa').value = data.empresa_id;
    }
}

function popularBadgesHeader(data) {
    // data-status é lido pelo CSS para aplicar a cor correta — sem lógica JS de cores
    const badgeStatus = document.getElementById('badgeStatus');
    badgeStatus.dataset.status = data.status;
    document.getElementById('badgeStatusTexto').textContent = data.status_display;
    document.getElementById('badgeCategoriaTexto').textContent = data.categoria_display;
    document.getElementById('badgeDataTexto').textContent = data.data_vencimento_formatada;
    document.getElementById('modalInfoBadges').style.display = 'flex';
}


/* ══════════════════════════════════════════
   5. CHIPS DE RESPONSÁVEIS
   ══════════════════════════════════════════ */

// Configurado UMA VEZ no DOMContentLoaded — os elementos são estáticos
// (sempre presentes no DOM, apenas ocultos quando o modal está fechado)
function inicializarChips() {
    const searchInput = document.getElementById('responsaveisSearch');
    const dropdown = document.getElementById('responsaveisDropdown');

    searchInput.addEventListener('input', () => {
        renderizarDropdownChips(searchInput.value.trim());
    });

    // Abre o dropdown ao focar, mesmo sem digitar (mostra todos disponíveis)
    searchInput.addEventListener('focus', () => {
        renderizarDropdownChips(searchInput.value.trim());
    });

    // Fecha o dropdown ao clicar fora do campo
    document.addEventListener('click', e => {
        if (!e.target.closest('#responsaveisField') &&
            !e.target.closest('#responsaveisDropdown')) {
            dropdown.style.display = 'none';
        }
    });
}

function renderizarDropdownChips(termo) {
    const dropdown = document.getElementById('responsaveisDropdown');
    const opcoes = [...document.getElementById('id_responsaveis').options];

    const filtradas = opcoes.filter(opt =>
        opt.text.toLowerCase().includes(termo.toLowerCase())
    );

    dropdown.innerHTML = '';

    if (filtradas.length === 0) {
        dropdown.innerHTML =
            '<div class="chips-dropdown-item" style="pointer-events:none;color:var(--icons)">Nenhum usuário encontrado</div>';
        dropdown.style.display = 'block';
        return;
    }

    filtradas.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'chips-dropdown-item';
        item.textContent = opt.text;

        // Itens já selecionados ficam esmaecidos e não podem ser clicados
        if (chipsSelecionados.has(String(opt.value))) {
            item.classList.add('selecionado');
        }

        item.addEventListener('click', () => {
            adicionarChip(opt.value, opt.text);
            document.getElementById('responsaveisSearch').value = '';
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function adicionarChip(id, nome) {
    const sid = String(id);
    if (chipsSelecionados.has(sid)) return; // Evita duplicata silenciosamente

    chipsSelecionados.set(sid, nome);

    const chip = clonarTemplate('tplChipResponsavel');
    chip.dataset.usuarioId = sid;
    chip.querySelector('.chip-nome').textContent = nome;
    chip.querySelector('.chip-remover').addEventListener('click', () => removerChip(sid));

    document.getElementById('responsaveisChips').appendChild(chip);
    sincronizarSelectOculto();
}

function removerChip(id) {
    const sid = String(id);
    chipsSelecionados.delete(sid);
    document.querySelector(`#responsaveisChips [data-usuario-id="${sid}"]`)?.remove();
    sincronizarSelectOculto();
}

// O select[multiple] oculto é o que envia os IDs no submit do formulário Django.
// Esta função mantém ele em sincronia com o Map de chips visuais.
function sincronizarSelectOculto() {
    [...document.getElementById('id_responsaveis').options].forEach(opt => {
        opt.selected = chipsSelecionados.has(String(opt.value));
    });
}

function resetarChips() {
    chipsSelecionados.clear();
    document.getElementById('responsaveisChips').innerHTML = '';
    document.getElementById('responsaveisSearch').value = '';
    document.getElementById('responsaveisDropdown').style.display = 'none';
    sincronizarSelectOculto();
}

function popularChipsIniciais(responsaveis) {
    resetarChips();
    responsaveis.forEach(r => adicionarChip(r.id, r.nome));
}


/* ══════════════════════════════════════════
   6. EMPRESA E CLIENTE
   ══════════════════════════════════════════ */

// Chamado pelo onchange do <select id="id_empresa"> no HTML.
// Busca os dados completos e atualiza os dois cards dinamicamente.
function onEmpresaChange(empresaId) {
    if (!empresaId) {
        limparCardEmpresa();
        limparCardCliente();
        return;
    }

    fetchJSON(`/api/empresas/${empresaId}/detalhes/`)
        .then(data => {
            renderizarCardEmpresa(data);
            renderizarCardCliente(data.cliente);
            estado.enderecoCompleto = data.endereco?.completo || 'Endereço não cadastrado.';
        })
        .catch(err => console.error('Erro ao buscar empresa:', err));
}

function renderizarCardEmpresa(empresa) {
    const tbody = document.getElementById('tabelaEmpresaBody');
    tbody.innerHTML = '';

    const linhas = [
        { label: 'Nome',     valor: empresa.nome_empresa,          clicavel: false },
        { label: 'CNPJ',     valor: empresa.cnpj,                  clicavel: false },
        { label: 'CNAE',     valor: empresa.cnae,                  clicavel: false },
        { label: 'Endereço', valor: empresa.endereco?.resumo || '—', clicavel: !!empresa.endereco },
    ];

    linhas.forEach(({ label, valor, clicavel }) => {
        const tr = clonarTemplate('tplInfoCardRow');
        tr.querySelector('.info-card-label').textContent = label;

        const tdValor = tr.querySelector('.info-card-value');
        tdValor.textContent = valor || '—';

        // Endereço truncado é clicável e abre o sub-modal com o texto completo
        if (clicavel) {
            tdValor.classList.add('clicavel');
            tdValor.addEventListener('click', abrirSubModalEndereco);
        }

        tbody.appendChild(tr);
    });
}

function renderizarCardCliente(cliente) {
    const tbody = document.getElementById('tabelaClienteBody');
    tbody.innerHTML = '';

    [
        ['Nome',     cliente.nome_responsavel],
        ['CPF',      cliente.cpf],
        ['Telefone', cliente.telefone],
        ['E-mail',   cliente.email],
    ].forEach(([label, valor]) => {
        const tr = clonarTemplate('tplInfoCardRow');
        tr.querySelector('.info-card-label').textContent = label;
        tr.querySelector('.info-card-value').textContent = valor || '—';
        tbody.appendChild(tr);
    });
}

function limparCardEmpresa() {
    document.getElementById('tabelaEmpresaBody').innerHTML =
        '<tr><td colspan="2" class="modal-empty-state">Selecione uma empresa acima.</td></tr>';
}

function limparCardCliente() {
    document.getElementById('tabelaClienteBody').innerHTML =
        '<tr><td colspan="2" class="modal-empty-state">Selecione uma empresa acima.</td></tr>';
}


/* ══════════════════════════════════════════
   7. FASES DO PROCESSO
   ══════════════════════════════════════════ */

function popularFases(fases) {
    const container = document.getElementById('fasesContainer');
    container.innerHTML = '';

    if (!fases || fases.length === 0) {
        container.innerHTML = '<p class="modal-empty-state">Nenhuma fase cadastrada.</p>';
        return;
    }

    // Fases específicas do órgão primeiro, documentação geral por último
    const ordenadas = [
        ...fases.filter(f => !f.is_geral),
        ...fases.filter(f =>  f.is_geral),
    ];

    ordenadas.forEach(fase => container.appendChild(criarGrupoFase(fase)));
}

function criarGrupoFase(fase) {
    const grupo = document.createElement('div');
    grupo.className = 'fase-grupo';

    const titulo = document.createElement('div');
    titulo.className = 'fase-titulo';
    titulo.textContent = fase.nome;

    const listaItens = document.createElement('div');
    listaItens.className = 'fase-itens';
    listaItens.dataset.faseId = fase.id;

    fase.itens.forEach(item => listaItens.appendChild(criarItemChecklist(item)));

    const btnAdicionar = clonarTemplate('tplBtnAdicionarItem');
    btnAdicionar.dataset.faseId = fase.id;
    btnAdicionar.addEventListener('click', () => {
        mostrarInputNovoItem(fase.id, btnAdicionar, listaItens);
    });

    grupo.appendChild(titulo);
    grupo.appendChild(listaItens);
    grupo.appendChild(btnAdicionar);
    return grupo;
}

function criarItemChecklist(item) {
    const el = clonarTemplate('tplItemChecklist');
    el.dataset.itemId = item.id;

    const checkbox = el.querySelector('.checklist-checkbox');
    checkbox.checked = item.is_concluido;
    if (item.is_concluido) el.classList.add('concluido');

    el.querySelector('.checklist-item-nome').textContent = item.nome;

    checkbox.addEventListener('change', () => toggleItemChecklist(item.id, checkbox, el));

    el.querySelector('.btn-item-anexo').addEventListener('click', () => {
        abrirSubModalAnexos(item.id, item.nome);
    });

    return el;
}

function toggleItemChecklist(itemId, checkbox, itemEl) {
    fetchJSON(`/api/itens/${itemId}/toggle/`, { method: 'POST' })
        .then(data => {
            checkbox.checked = data.is_concluido;
            itemEl.classList.toggle('concluido', data.is_concluido);
        })
        .catch(err => {
            // Reverte o checkbox visualmente se a request falhar
            checkbox.checked = !checkbox.checked;
            alert(`Erro ao atualizar item: ${err.message}`);
        });
}

function mostrarInputNovoItem(faseId, btnEl, listaItens) {
    btnEl.style.display = 'none';

    const inputContainer = clonarTemplate('tplInputNovoItem');
    const input = inputContainer.querySelector('.input-novo-item');

    const confirmar = () => salvarNovoItem(faseId, input, inputContainer, listaItens, btnEl);
    const cancelar  = () => { inputContainer.remove(); btnEl.style.display = ''; };

    inputContainer.querySelector('.btn-confirmar-novo-item').addEventListener('click', confirmar);
    inputContainer.querySelector('.btn-cancelar-novo-item').addEventListener('click', cancelar);

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
        if (e.key === 'Escape') { cancelar(); }
    });

    btnEl.parentNode.insertBefore(inputContainer, btnEl);
    input.focus();
}

function salvarNovoItem(faseId, input, inputContainer, listaItens, btnEl) {
    const nome = input.value.trim();
    if (!nome) { input.focus(); return; }

    fetchJSON(`/api/fases/${faseId}/itens/criar/`, {
        method: 'POST',
        body: JSON.stringify({ nome }),
    })
        .then(data => {
            listaItens.appendChild(criarItemChecklist(data));
            inputContainer.remove();
            btnEl.style.display = '';
        })
        .catch(err => alert(`Erro ao criar item: ${err.message}`));
}


/* ══════════════════════════════════════════
   8. VISTORIAS
   ══════════════════════════════════════════ */

function popularVistorias(vistorias) {
    const container = document.getElementById('vistoriasContainer');
    container.innerHTML = '';

    if (!vistorias || vistorias.length === 0) {
        container.innerHTML = '<p class="modal-empty-state">Nenhuma vistoria agendada.</p>';
        return;
    }

    vistorias.forEach(v => container.appendChild(criarVistoriaItem(v)));
}

function criarVistoriaItem(v) {
    const el = clonarTemplate('tplVistoria');
    el.dataset.vistoriaId = v.id;
    el.dataset.status = v.status; // CSS usa este atributo para colorir o card

    el.querySelector('.vistoria-local').textContent = v.local;
    el.querySelector('.vistoria-data-hora').textContent = v.data_hora;

    const chk = el.querySelector('.vistoria-checkbox-realizada');
    chk.checked = v.status === 'REALIZADA';

    chk.addEventListener('change', () => {
        const novoStatus = chk.checked ? 'REALIZADA' : 'AGENDADA';
        atualizarStatusVistoria(v.id, novoStatus, el);
    });

    el.querySelector('.btn-cancelar-vistoria-item').addEventListener('click', () => {
        if (confirm('Deseja realmente cancelar esta vistoria?')) {
            atualizarStatusVistoria(v.id, 'CANCELADA', el);
        }
    });

    return el;
}

function atualizarStatusVistoria(vistoriaId, novoStatus, el) {
    fetchJSON(`/api/vistorias/${vistoriaId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: novoStatus }),
    })
        .then(data => {
            el.dataset.status = data.status; // Atualiza a cor via CSS automaticamente
            el.querySelector('.vistoria-checkbox-realizada').checked = data.status === 'REALIZADA';
        })
        .catch(err => alert(`Erro ao atualizar vistoria: ${err.message}`));
}

function toggleFormNovaVistoria() {
    const form = document.getElementById('formNovaVistoria');
    const abrindo = form.style.display === 'none';
    form.style.display = abrindo ? 'flex' : 'none';
    if (abrindo) document.getElementById('novaVistoriaDataHora').focus();
}

function salvarNovaVistoria() {
    const dataHora = document.getElementById('novaVistoriaDataHora').value;
    const local    = document.getElementById('novaVistoriaLocal').value.trim();
    const obs      = document.getElementById('novaVistoriaObs').value.trim();

    if (!dataHora || !local) {
        alert('Preencha a data/hora e o local da vistoria.');
        return;
    }

    fetchJSON(`/api/processos/${estado.processoId}/vistorias/criar/`, {
        method: 'POST',
        body: JSON.stringify({ data_hora: dataHora, local, observacoes: obs }),
    })
        .then(novaVistoria => {
            const container = document.getElementById('vistoriasContainer');
            container.querySelector('.modal-empty-state')?.remove();
            container.appendChild(criarVistoriaItem(novaVistoria));

            // Limpa e fecha o formulário após salvar
            document.getElementById('novaVistoriaDataHora').value = '';
            document.getElementById('novaVistoriaLocal').value = '';
            document.getElementById('novaVistoriaObs').value = '';
            toggleFormNovaVistoria();
        })
        .catch(err => alert(`Erro ao criar vistoria: ${err.message}`));
}


/* ══════════════════════════════════════════
   9. PROCESSOS RELACIONADOS
   ══════════════════════════════════════════ */

// Configurado UMA VEZ no DOMContentLoaded
function inicializarBuscaRelacionado() {
    const input    = document.getElementById('buscaRelacionadoInput');
    const dropdown = document.getElementById('buscaRelacionadoDropdown');

    // debounce de 350ms: só busca quando o usuário para de digitar
    const buscarComDebounce = debounce(buscarProcessos, 350);
    input.addEventListener('input', () => buscarComDebounce(input.value.trim()));

    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaRelacionadoInput') &&
            !e.target.closest('#buscaRelacionadoDropdown')) {
            dropdown.style.display = 'none';
        }
    });
}

function buscarProcessos(termo) {
    const dropdown = document.getElementById('buscaRelacionadoDropdown');

    if (termo.length < 2) { dropdown.style.display = 'none'; return; }

    // excluir_id garante que o processo atual não aparece nos resultados
    const params = new URLSearchParams({ q: termo, excluir_id: estado.processoId });

    fetchJSON(`/api/processos/buscar/?${params}`)
        .then(data => renderizarDropdownRelacionados(data.processos))
        .catch(err => console.error('Erro na busca:', err));
}

function renderizarDropdownRelacionados(processos) {
    const dropdown = document.getElementById('buscaRelacionadoDropdown');
    dropdown.innerHTML = '';

    if (processos.length === 0) {
        dropdown.innerHTML =
            '<div class="busca-dropdown-item" style="pointer-events:none;color:var(--icons)">Nenhum processo encontrado</div>';
        dropdown.style.display = 'block';
        return;
    }

    processos.forEach(p => {
        const item = document.createElement('div');
        item.className = 'busca-dropdown-item';
        item.innerHTML = `
            <div class="busca-dropdown-item-info">
                <span>${p.nome}</span>
                <span class="busca-dropdown-item-empresa">${p.empresa} · ${p.protocolo}</span>
            </div>
        `;
        item.addEventListener('click', () => {
            adicionarRelacionado(p);
            document.getElementById('buscaRelacionadoInput').value = '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

function adicionarRelacionado(processoData) {
    fetchJSON(`/api/processos/${estado.processoId}/relacionados/adicionar/`, {
        method: 'POST',
        body: JSON.stringify({ relacionado_id: processoData.id }),
    })
        .then(data => {
            const container = document.getElementById('relacionadosContainer');
            container.querySelector('.modal-empty-state')?.remove();
            container.appendChild(criarMiniCardRelacionado(data));
        })
        .catch(err => alert(`Erro ao vincular processo: ${err.message}`));
}

function criarMiniCardRelacionado(p) {
    const card = clonarTemplate('tplProcessoRelacionado');
    card.dataset.relacionadoId = p.id;
    card.dataset.status = p.status; // CSS cuida da cor do badge de protocolo

    card.querySelector('.relacionado-nome').textContent = p.nome;
    card.querySelector('.relacionado-protocolo-badge').textContent = `Protocolo: ${p.protocolo}`;

    // Editar → fecha o modal atual e abre o do processo relacionado
    card.querySelector('.btn-editar-relacionado').addEventListener('click', () => {
        fecharModalProcesso();
        // Delay mínimo para o modal fechar visualmente antes de reabrir
        setTimeout(() => editarProcesso(p.id), 150);
    });

    card.querySelector('.btn-desvincular-relacionado').addEventListener('click', () => {
        if (confirm(`Deseja realmente desvincular o processo "${p.nome}"?\n\nEsta ação não pode ser desfeita.`)) {
            desvincularRelacionado(p.id, card);
        }
    });

    return card;
}

function desvincularRelacionado(relacionadoId, cardEl) {
    fetchJSON(`/api/processos/${estado.processoId}/relacionados/${relacionadoId}/remover/`, {
        method: 'DELETE',
    })
        .then(() => {
            cardEl.remove();
            const container = document.getElementById('relacionadosContainer');
            if (container.children.length === 0) {
                container.innerHTML = '<p class="modal-empty-state">Nenhum processo relacionado.</p>';
            }
        })
        .catch(err => alert(`Erro ao desvincular: ${err.message}`));
}

function popularRelacionados(relacionados) {
    const container = document.getElementById('relacionadosContainer');
    container.innerHTML = '';

    if (!relacionados || relacionados.length === 0) {
        container.innerHTML = '<p class="modal-empty-state">Nenhum processo relacionado.</p>';
        return;
    }

    relacionados.forEach(p => container.appendChild(criarMiniCardRelacionado(p)));
}


/* ══════════════════════════════════════════
   10. SUB-MODAIS
   ══════════════════════════════════════════ */

// ─── Endereço ───────────────────────────

function abrirSubModalEndereco() {
    document.getElementById('enderecoCompletoTexto').textContent = estado.enderecoCompleto;
    document.getElementById('subModalEndereco').style.display = 'flex';
}

function fecharSubModalEndereco() {
    document.getElementById('subModalEndereco').style.display = 'none';
}

// ─── Anexos ─────────────────────────────

function abrirSubModalAnexos(itemId, itemNome) {
    estado.itemAnexosId = itemId;

    document.getElementById('subModalAnexosTitulo').innerHTML =
        `<i class="fa-solid fa-paperclip"></i> Anexos — ${itemNome}`;

    document.getElementById('listaAnexos').innerHTML =
        '<p class="modal-empty-state">Carregando...</p>';

    document.getElementById('subModalAnexos').style.display = 'flex';

    carregarAnexos(itemId);
    inicializarUploadAnexo(itemId);
}

function fecharSubModalAnexos() {
    document.getElementById('subModalAnexos').style.display = 'none';
    estado.itemAnexosId = null;
    document.getElementById('inputAnexoUpload').value = '';
}

function carregarAnexos(itemId) {
    fetchJSON(`/api/itens/${itemId}/listar-anexos/`)
        .then(data => renderizarListaAnexos(data.anexos))
        .catch(() => {
            document.getElementById('listaAnexos').innerHTML =
                '<p class="modal-empty-state">Erro ao carregar anexos.</p>';
        });
}

function renderizarListaAnexos(anexos) {
    const lista = document.getElementById('listaAnexos');
    lista.innerHTML = '';

    if (anexos.length === 0) {
        lista.innerHTML = '<p class="modal-empty-state">Nenhum arquivo anexado ainda.</p>';
        return;
    }

    const icones = { pdf: 'fa-file-pdf', png: 'fa-file-image', jpg: 'fa-file-image', jpeg: 'fa-file-image' };

    anexos.forEach(a => {
        const item = document.createElement('div');
        item.className = 'anexo-item';
        item.innerHTML = `
            <i class="fa-solid ${icones[a.tipo_arquivo] || 'fa-file'} anexo-item-icone"></i>
            <span class="anexo-item-nome" title="${a.nome_original}">${a.nome_original}</span>
            <a class="anexo-item-link" href="${a.url}" target="_blank" rel="noopener">Visualizar</a>
        `;
        lista.appendChild(item);
    });
}

function inicializarUploadAnexo(itemId) {
    const input = document.getElementById('inputAnexoUpload');

    // Substitui o elemento para remover listeners acumulados de aberturas anteriores.
    // Clonar o nó é mais seguro do que gerenciar referências manualmente.
    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoInput.addEventListener('change', () => {
        const arquivo = novoInput.files[0];
        if (!arquivo) return;

        const formData = new FormData();
        formData.append('arquivo', arquivo);

        // fetchJSON detecta FormData e NÃO define Content-Type,
        // deixando o browser definir corretamente com o boundary do multipart
        fetchJSON(`/api/itens/${itemId}/anexos/`, { method: 'POST', body: formData })
            .then(() => carregarAnexos(itemId)) // Recarrega a lista após upload bem-sucedido
            .catch(err => alert(`Erro no upload: ${err.message}`));
    });
}


/* ══════════════════════════════════════════
   11. MENUS, DELEÇÃO E FILTROS
   ══════════════════════════════════════════ */

function toggleMenuOpcoes(event, processoId) {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll('.dropdown-conteudo').forEach(menu => {
        if (menu.id !== `dropdown-${processoId}`) menu.classList.remove('mostrar');
    });
    document.getElementById(`dropdown-${processoId}`)?.classList.toggle('mostrar');
}

window.addEventListener('click', e => {
    if (!e.target.closest('.dropdown-opcoes-card')) {
        document.querySelectorAll('.dropdown-conteudo').forEach(m => m.classList.remove('mostrar'));
    }
});

function softDeleteProcesso(event, processoId) {
    event.preventDefault();
    if (!confirm('Deseja realmente EXCLUIR este processo? Ele será movido para a coluna de Excluídos.')) return;

    fetchJSON(`/processos/${processoId}/deletar/`, { method: 'DELETE' })
        .then(() => {
            const card = document.querySelector(`.processo-card[data-processo-id="${processoId}"]`);
            const colunaExcluidos = document.querySelector('.kanban-column[data-status="EXCLUIDO"] .cards-container');
            if (card && colunaExcluidos) {
                colunaExcluidos.appendChild(card);
                card.dataset.status = 'EXCLUIDO';
                document.getElementById(`dropdown-${processoId}`)?.classList.remove('mostrar');
            }
        })
        .catch(err => alert(`Erro ao excluir: ${err.message}`));
}

function hardDeleteProcesso(event, processoId) {
    event.preventDefault();
    if (!confirm('ATENÇÃO: Você está prestes a APAGAR DEFINITIVAMENTE este processo do banco de dados. Esta ação é irreversível. Continuar?')) return;

    fetchJSON(`/processos/${processoId}/apagar/`, { method: 'DELETE' })
        .then(() => {
            document.querySelector(`.processo-card[data-processo-id="${processoId}"]`)?.remove();
        })
        .catch(err => alert(`Erro: ${err.message}`));
}

// ─── Filtros ─────────────────────────────

const btns_filtro = document.querySelectorAll('.btn-filtro');

function aplicarFiltro() {
    const botaoAtivo = document.querySelector('.btn-filtro.btn-filtro__actived');
    if (!botaoAtivo) return;

    const orgaoSelecionado = botaoAtivo.dataset.filtro.toUpperCase();
    document.querySelectorAll('.processo-card').forEach(card => {
        card.classList.toggle('oculto', (card.dataset.orgao || '').toUpperCase() !== orgaoSelecionado);
    });
}

btns_filtro.forEach(btn => {
    btn.addEventListener('click', () => {
        btns_filtro.forEach(b => b.classList.remove('btn-filtro__actived'));
        btn.classList.add('btn-filtro__actived');
        aplicarFiltro();
    });
});