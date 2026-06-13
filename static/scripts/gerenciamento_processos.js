/* ════════════════════════════════════════════════════════════════
   gerenciamento_processos.js

   1. Estado do Modal
   2. Kanban (drag-drop e scroll)
   3. Modal Principal
   4. Chips de Responsáveis
   5. Empresa e Cliente
   6. Fases do Processo
   7. Vistorias
   8. Processos Relacionados
   9. Sub-modais (Endereço e Anexos)
   10. Menus, Deleção e Filtros
   11. CRM (Clientes e Empresas)
   12. Busca Global de Processos
   ════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   1. ESTADO DO MODAL
   ══════════════════════════════════════════ */

// Fonte de verdade centralizada — evita variáveis globais espalhadas.
// Qualquer função sabe qual processo está aberto lendo estado.processoId.
const estado = {
  processoId: null, // null = modo criação; número = modo edição
  itemAnexosId: null, // item de checklist com sub-modal de anexos aberto
  enderecoCompleto: "", // texto completo do endereço para o sub-modal
};

// Map de responsáveis selecionados: id (string) → nome
// Map preserva ordem de inserção e facilita verificar duplicatas
const chipsSelecionados = new Map();

/* ══════════════════════════════════════════
   2. KANBAN — DRAG & DROP E SCROLL
   ══════════════════════════════════════════ */

let direcaoRolagem = 0;
const zonaGatilho = 100;
const velocidadeRolagem = 12;

document.addEventListener("DOMContentLoaded", () => {
  // Drag & drop nos cards do Kanban
  document.querySelectorAll(".processo-card").forEach((card) => {
    card.addEventListener("dragstart", () => card.classList.add("dragging"));
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      direcaoRolagem = 0;
    });
  });

  document.querySelectorAll(".cards-container").forEach((container) => {
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggable = document.querySelector(".dragging");
      const afterEl = getDragAfterElement(container, e.clientY);
      if (afterEl == null) container.appendChild(draggable);
      else container.insertBefore(draggable, afterEl);
    });

    container.addEventListener("drop", () => {
      const draggable = document.querySelector(".dragging");
      const novoStatus = container.closest(".kanban-column").dataset.status;
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
  inicializarBuscaGlobal();
  // Aplica o filtro inicial conforme o botão ativo no HTML
  aplicarFiltro();

  // ============================================================
  // ABRIR PROCESSO VIA URL PARAM (vindo do Dashboard)
  // Ex: /gerenciamento_processos/?abrir_processo=42
  // ============================================================
  const urlParams = new URLSearchParams(window.location.search);
  const idParaAbrir = urlParams.get("abrir_processo");

  if (idParaAbrir) {
    // Pequeno delay para garantir que o DOM está totalmente renderizado
    // e que a função editarProcesso já está disponível.
    setTimeout(() => {
      editarProcesso(parseInt(idParaAbrir, 10));

      // Limpa o parâmetro da URL sem recarregar a página.
      // Assim, se o usuário apertar F5, o modal não reabre.
      // history.replaceState substitui a entrada atual do histórico.
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 100);
  }
});

function getDragAfterElement(container, y) {
  const elements = [
    ...container.querySelectorAll(".processo-card:not(.dragging):not(.oculto)"),
  ];
  return elements.reduce(
    (closest, child) => {
      const offset =
        y -
        child.getBoundingClientRect().top -
        child.getBoundingClientRect().height / 2;
      return offset < 0 && offset > closest.offset
        ? { offset, element: child }
        : closest;
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

function atualizarStatusNoBanco(processoId, novoStatus) {
  fetchJSON(`/api/processos/${processoId}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ status: novoStatus }),
  }).catch((err) => console.error("Erro ao atualizar status no banco:", err));
}

// Grab-to-scroll no quadro Kanban
const slider = document.getElementById("kanbanBoard");
let isDown = false,
  startX,
  scrollLeft;

slider.addEventListener("mousedown", (e) => {
  isDown = true;
  startX = e.pageX - slider.offsetLeft;
  scrollLeft = slider.scrollLeft;
});
slider.addEventListener("mouseup", () => (isDown = false));
slider.addEventListener("mouseleave", () => (isDown = false));
slider.addEventListener("mousemove", (e) => {
  if (!isDown) return;
  e.preventDefault();
  slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 2;
});

// Auto-scroll ao arrastar cards até a borda do quadro
slider.addEventListener("dragover", (e) => {
  const rect = slider.getBoundingClientRect();
  if (e.clientX > rect.right - zonaGatilho) direcaoRolagem = 1;
  else if (e.clientX < rect.left + zonaGatilho) direcaoRolagem = -1;
  else direcaoRolagem = 0;
});
slider.addEventListener("drop", () => (direcaoRolagem = 0));
slider.addEventListener("dragleave", () => (direcaoRolagem = 0));

function motorDeRolagemAutomatica() {
  if (direcaoRolagem !== 0)
    slider.scrollLeft += direcaoRolagem * velocidadeRolagem;
  requestAnimationFrame(motorDeRolagemAutomatica);
}
motorDeRolagemAutomatica();

/* ══════════════════════════════════════════
   3. MODAL PRINCIPAL
   ══════════════════════════════════════════ */

function fecharModalProcesso() {
  document.getElementById("modalProcessoOverlay").style.display = "none";
  // Limpa o estado ao fechar para não "vazar" dados de um processo
  // para a próxima abertura do modal
  estado.processoId = null;
  chipsSelecionados.clear();
}

function abrirModalCriacao() {
  estado.processoId = null;

  document.getElementById("formProcesso").reset();
  document.getElementById("formProcesso").action = "/processos/criar/";

  document.getElementById("modalTitle").textContent = "Novo Processo";
  document.getElementById("modalProtocoloBadge").style.display = "none";
  document.getElementById("modalInfoBadges").style.display = "none";
  document.getElementById("btnSubmitProcesso").textContent = "Criar Processo";

  // Seções que só fazem sentido após o processo existir no banco
  document.getElementById("grupoProcessoRelacionado").style.display = "none";
  document.getElementById("btnAdicionarVistoria").style.display = "none";
  document.getElementById("formNovaVistoria").style.display = "none";

  document.getElementById("fasesContainer").innerHTML =
    '<p class="modal-empty-state">As fases serão criadas automaticamente após salvar.</p>';
  document.getElementById("vistoriasContainer").innerHTML =
    '<p class="modal-empty-state">Nenhuma vistoria agendada.</p>';
  document.getElementById("relacionadosContainer").innerHTML =
    '<p class="modal-empty-state">Nenhum processo relacionado.</p>';

  limparCardEmpresa();
  limparCardCliente();
  resetarChips();

  document.getElementById("modalProcessoOverlay").style.display = "flex";
}

function editarProcesso(processoId) {
  estado.processoId = processoId;

  // Abre o modal imediatamente com estado de "carregando" para dar
  // feedback visual enquanto a request está em andamento
  document.getElementById("modalTitle").textContent = "Carregando...";
  document.getElementById("modalProtocoloBadge").style.display = "none";
  document.getElementById("modalInfoBadges").style.display = "none";
  document.getElementById("btnSubmitProcesso").textContent =
    "Salvar Alterações";
  document.getElementById("modalProcessoOverlay").style.display = "flex";

  fetchJSON(`/api/processos/${processoId}/completo/`)
    .then((data) => popularModalEdicao(data))
    .catch((err) => {
      alert(`Não foi possível carregar o processo: ${err.message}`);
      fecharModalProcesso();
    });
}

function popularModalEdicao(data) {
  document.getElementById("formProcesso").action =
    `/processos/${data.id}/editar/`;

  popularCamposBasicos(data);
  popularBadgesHeader(data);
  popularChipsIniciais(data.responsaveis);
  popularFases(data.fases);
  popularVistorias(data.vistorias);
  popularRelacionados(data.processos_relacionados);

  if (data.empresa) {
    renderizarCardEmpresa(data.empresa);
    estado.enderecoCompleto =
      data.empresa.endereco?.completo || "Endereço não cadastrado.";
  } else {
    limparCardEmpresa();
  }

  data.cliente ? renderizarCardCliente(data.cliente) : limparCardCliente();

  // Exibe as seções exclusivas do modo edição
  document.getElementById("grupoProcessoRelacionado").style.display = "";
  document.getElementById("btnAdicionarVistoria").style.display = "";
}

function popularCamposBasicos(data) {
  document.getElementById("modalTitle").textContent = data.nome;

  const badge = document.getElementById("modalProtocoloBadge");
  badge.textContent = `Protocolo: ${data.protocolo}`;
  badge.style.display = "inline-flex";

  document.getElementById("id_nome").value = data.nome || "";
  document.getElementById("id_protocolo").value = data.protocolo || "";
  document.getElementById("id_descricao").value = data.descricao || "";
  document.getElementById("id_orgao").value = data.orgao || "PREFEITURA";
  document.getElementById("id_categoria").value =
    data.categoria || "FUNCIONAMENTO";
  document.getElementById("id_data_vencimento").value =
    data.data_vencimento || "";

  if (data.empresa_id) {
    document.getElementById("id_empresa").value = data.empresa_id;
  }
}

function popularBadgesHeader(data) {
  // data-status é lido pelo CSS para aplicar a cor correta — sem lógica JS de cores
  const badgeStatus = document.getElementById("badgeStatus");
  badgeStatus.dataset.status = data.status;
  document.getElementById("badgeStatusTexto").textContent = data.status_display;
  document.getElementById("badgeCategoriaTexto").textContent =
    data.categoria_display;
  document.getElementById("badgeDataTexto").textContent =
    data.data_vencimento_formatada;
  document.getElementById("modalInfoBadges").style.display = "flex";
}

/* ══════════════════════════════════════════
   4. CHIPS DE RESPONSÁVEIS
   ══════════════════════════════════════════ */

// Configurado UMA VEZ no DOMContentLoaded — os elementos são estáticos
// (sempre presentes no DOM, apenas ocultos quando o modal está fechado)
function inicializarChips() {
  const searchInput = document.getElementById("responsaveisSearch");
  const dropdown = document.getElementById("responsaveisDropdown");

  searchInput.addEventListener("input", () => {
    renderizarDropdownChips(searchInput.value.trim());
  });

  // Abre o dropdown ao focar, mesmo sem digitar (mostra todos disponíveis)
  searchInput.addEventListener("focus", () => {
    renderizarDropdownChips(searchInput.value.trim());
  });

  // Fecha o dropdown ao clicar fora do campo
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#responsaveisField") &&
      !e.target.closest("#responsaveisDropdown")
    ) {
      dropdown.style.display = "none";
    }
  });
}

function renderizarDropdownChips(termo) {
  const dropdown = document.getElementById("responsaveisDropdown");
  const opcoes = [...document.getElementById("id_responsaveis").options];

  const filtradas = opcoes.filter((opt) =>
    opt.text.toLowerCase().includes(termo.toLowerCase()),
  );

  dropdown.innerHTML = "";

  if (filtradas.length === 0) {
    dropdown.innerHTML =
      '<div class="chips-dropdown-item" style="pointer-events:none;color:var(--icons)">Nenhum usuário encontrado</div>';
    dropdown.style.display = "block";
    return;
  }

  filtradas.forEach((opt) => {
    const item = document.createElement("div");
    item.className = "chips-dropdown-item";
    item.textContent = opt.text;

    // Itens já selecionados ficam esmaecidos e não podem ser clicados
    if (chipsSelecionados.has(String(opt.value))) {
      item.classList.add("selecionado");
    }

    item.addEventListener("click", () => {
      adicionarChip(opt.value, opt.text);
      document.getElementById("responsaveisSearch").value = "";
      dropdown.style.display = "none";
    });

    dropdown.appendChild(item);
  });

  dropdown.style.display = "block";
}

function adicionarChip(id, nome) {
  const sid = String(id);
  if (chipsSelecionados.has(sid)) return; // Evita duplicata silenciosamente

  chipsSelecionados.set(sid, nome);

  const chip = clonarTemplate("tplChipResponsavel");
  chip.dataset.usuarioId = sid;
  chip.querySelector(".chip-nome").textContent = nome;
  chip
    .querySelector(".chip-remover")
    .addEventListener("click", () => removerChip(sid));

  document.getElementById("responsaveisChips").appendChild(chip);
  sincronizarSelectOculto();
}

function removerChip(id) {
  const sid = String(id);
  chipsSelecionados.delete(sid);
  document
    .querySelector(`#responsaveisChips [data-usuario-id="${sid}"]`)
    ?.remove();
  sincronizarSelectOculto();
}

// O select[multiple] oculto é o que envia os IDs no submit do formulário Django.
// Esta função mantém ele em sincronia com o Map de chips visuais.
function sincronizarSelectOculto() {
  [...document.getElementById("id_responsaveis").options].forEach((opt) => {
    opt.selected = chipsSelecionados.has(String(opt.value));
  });
}

function resetarChips() {
  chipsSelecionados.clear();
  document.getElementById("responsaveisChips").innerHTML = "";
  document.getElementById("responsaveisSearch").value = "";
  document.getElementById("responsaveisDropdown").style.display = "none";
  sincronizarSelectOculto();
}

function popularChipsIniciais(responsaveis) {
  resetarChips();
  responsaveis.forEach((r) => adicionarChip(r.id, r.nome));
}

/* ══════════════════════════════════════════
   5. EMPRESA E CLIENTE
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
    .then((data) => {
      renderizarCardEmpresa(data);
      renderizarCardCliente(data.cliente);
      estado.enderecoCompleto =
        data.endereco?.completo || "Endereço não cadastrado.";
    })
    .catch((err) => console.error("Erro ao buscar empresa:", err));
}

function renderizarCardEmpresa(empresa) {
  const tbody = document.getElementById("tabelaEmpresaBody");
  tbody.innerHTML = "";

  const linhas = [
    { label: "Nome", valor: empresa.nome_empresa, clicavel: false },
    { label: "CNPJ", valor: empresa.cnpj, clicavel: false },
    { label: "CNAE", valor: empresa.cnae, clicavel: false },
    {
      label: "Endereço",
      valor: empresa.endereco?.resumo || "—",
      clicavel: !!empresa.endereco,
    },
  ];

  linhas.forEach(({ label, valor, clicavel }) => {
    const tr = clonarTemplate("tplInfoCardRow");
    tr.querySelector(".info-card-label").textContent = label;

    const tdValor = tr.querySelector(".info-card-value");
    tdValor.textContent = valor || "—";

    // Endereço truncado é clicável e abre o sub-modal com o texto completo
    if (clicavel) {
      tdValor.classList.add("clicavel");
      tdValor.addEventListener("click", abrirSubModalEndereco);
    }

    tbody.appendChild(tr);
  });
}

function renderizarCardCliente(cliente) {
  const tbody = document.getElementById("tabelaClienteBody");
  tbody.innerHTML = "";

  [
    ["Nome", cliente.nome_responsavel],
    ["CPF", cliente.cpf],
    ["Telefone", cliente.telefone],
    ["E-mail", cliente.email],
  ].forEach(([label, valor]) => {
    const tr = clonarTemplate("tplInfoCardRow");
    tr.querySelector(".info-card-label").textContent = label;
    tr.querySelector(".info-card-value").textContent = valor || "—";
    tbody.appendChild(tr);
  });
}

function limparCardEmpresa() {
  document.getElementById("tabelaEmpresaBody").innerHTML =
    '<tr><td colspan="2" class="modal-empty-state">Selecione uma empresa acima.</td></tr>';
}

function limparCardCliente() {
  document.getElementById("tabelaClienteBody").innerHTML =
    '<tr><td colspan="2" class="modal-empty-state">Selecione uma empresa acima.</td></tr>';
}

/* ══════════════════════════════════════════
   6. FASES DO PROCESSO (Refatorado)
   ══════════════════════════════════════════ */

function popularFases(fases) {
  const container = document.getElementById("fasesContainer");
  container.innerHTML = "";

  if (!fases || fases.length === 0) {
    container.innerHTML =
      '<p class="modal-empty-state">Nenhuma fase cadastrada.</p>';
    return;
  }

  // Ordena: Específicas primeiro, gerais (documentação) depois
  const ordenadas = [
    ...fases.filter((f) => !f.is_geral),
    ...fases.filter((f) => f.is_geral),
  ];

  // Renderiza cada fase diretamente como um item
  ordenadas.forEach((fase) => container.appendChild(criarItemFase(fase)));

  // Adiciona o botão de criar nova fase ao final da lista
  const btnAdicionar = clonarTemplate("tplBtnAdicionarItem");
  btnAdicionar.addEventListener("click", () => {
    mostrarInputNovaFase(btnAdicionar, container);
  });
  container.appendChild(btnAdicionar);
}

function criarItemFase(fase) {
  // Reutilizamos o template tplItemChecklist, mas alimentamos com os dados da Fase
  const el = clonarTemplate("tplItemChecklist");
  el.dataset.faseId = fase.id;

  const checkbox = el.querySelector(".checklist-checkbox");
  checkbox.checked = fase.is_concluido;
  if (fase.is_concluido) el.classList.add("concluido");

  el.querySelector(".checklist-item-nome").textContent = fase.nome;

  checkbox.addEventListener("change", () =>
    toggleFaseProcesso(fase.id, checkbox, el),
  );

  // Botão de anexo agora passa o ID e Nome da Fase
  el.querySelector(".btn-item-anexo").addEventListener("click", () => {
    abrirSubModalAnexos(fase.id, fase.nome);
  });

  return el;
}

function toggleFaseProcesso(faseId, checkbox, el) {
  fetchJSON(`/api/fases/${faseId}/toggle/`, { method: "POST" })
    .then((data) => {
      checkbox.checked = data.is_concluido;
      el.classList.toggle("concluido", data.is_concluido);
    })
    .catch((err) => {
      checkbox.checked = !checkbox.checked; // Reverte visualmente
      alert(`Erro ao atualizar fase: ${err.message}`);
    });
}

function mostrarInputNovaFase(btnEl, container) {
  btnEl.style.display = "none";

  const inputContainer = clonarTemplate("tplInputNovoItem");
  const input = inputContainer.querySelector(".input-novo-item");

  const confirmar = () =>
    salvarNovaFase(input, inputContainer, container, btnEl);
  const cancelar = () => {
    inputContainer.remove();
    btnEl.style.display = "";
  };

  inputContainer
    .querySelector(".btn-confirmar-novo-item")
    .addEventListener("click", confirmar);
  inputContainer
    .querySelector(".btn-cancelar-novo-item")
    .addEventListener("click", cancelar);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    }
    if (e.key === "Escape") {
      cancelar();
    }
  });

  container.insertBefore(inputContainer, btnEl);
  input.focus();
}

function salvarNovaFase(input, inputContainer, container, btnEl) {
  const nome = input.value.trim();
  if (!nome) {
    input.focus();
    return;
  }

  const processoId = estado.processoId; // Pega o ID do processo aberto no modal

  fetchJSON(`/api/processos/${processoId}/fases/criar/`, {
    method: "POST",
    body: JSON.stringify({ nome }),
  })
    .then((data) => {
      container.insertBefore(criarItemFase(data), btnEl);
      inputContainer.remove();
      btnEl.style.display = "";
    })
    .catch((err) => alert(`Erro ao criar nova fase: ${err.message}`));
}

/* ══════════════════════════════════════════
   7. VISTORIAS
   ══════════════════════════════════════════ */

function popularVistorias(vistorias) {
  const container = document.getElementById("vistoriasContainer");
  container.innerHTML = "";

  if (!vistorias || vistorias.length === 0) {
    container.innerHTML =
      '<p class="modal-empty-state">Nenhuma vistoria agendada.</p>';
    return;
  }

  vistorias.forEach((v) => container.appendChild(criarVistoriaItem(v)));
}

function criarVistoriaItem(v) {
  const el = clonarTemplate("tplVistoria");
  el.dataset.vistoriaId = v.id;
  el.dataset.status = v.status; // CSS usa este atributo para colorir o card

  el.querySelector(".vistoria-local").textContent = v.local;
  el.querySelector(".vistoria-data-hora").textContent = v.data_hora;

  const chk = el.querySelector(".vistoria-checkbox-realizada");
  chk.checked = v.status === "REALIZADA";

  chk.addEventListener("change", () => {
    const novoStatus = chk.checked ? "REALIZADA" : "AGENDADA";
    atualizarStatusVistoria(v.id, novoStatus, el);
  });

  el.querySelector(".btn-cancelar-vistoria-item").addEventListener(
    "click",
    () => {
      if (confirm("Deseja realmente cancelar esta vistoria?")) {
        atualizarStatusVistoria(v.id, "CANCELADA", el);
      }
    },
  );

  return el;
}

function atualizarStatusVistoria(vistoriaId, novoStatus, el) {
  fetchJSON(`/api/vistorias/${vistoriaId}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ status: novoStatus }),
  })
    .then((data) => {
      el.dataset.status = data.status; // Atualiza a cor via CSS automaticamente
      el.querySelector(".vistoria-checkbox-realizada").checked =
        data.status === "REALIZADA";
    })
    .catch((err) => alert(`Erro ao atualizar vistoria: ${err.message}`));
}

function toggleFormNovaVistoria() {
  const form = document.getElementById("formNovaVistoria");
  const abrindo = form.style.display === "none";
  form.style.display = abrindo ? "flex" : "none";
  if (abrindo) document.getElementById("novaVistoriaDataHora").focus();
}

function salvarNovaVistoria() {
  const dataHora = document.getElementById("novaVistoriaDataHora").value;
  const local = document.getElementById("novaVistoriaLocal").value.trim();
  const obs = document.getElementById("novaVistoriaObs").value.trim();

  if (!dataHora || !local) {
    alert("Preencha a data/hora e o local da vistoria.");
    return;
  }

  fetchJSON(`/api/processos/${estado.processoId}/vistorias/criar/`, {
    method: "POST",
    body: JSON.stringify({ data_hora: dataHora, local, observacoes: obs }),
  })
    .then((novaVistoria) => {
      const container = document.getElementById("vistoriasContainer");
      container.querySelector(".modal-empty-state")?.remove();
      container.appendChild(criarVistoriaItem(novaVistoria));

      // Limpa e fecha o formulário após salvar
      document.getElementById("novaVistoriaDataHora").value = "";
      document.getElementById("novaVistoriaLocal").value = "";
      document.getElementById("novaVistoriaObs").value = "";
      toggleFormNovaVistoria();
    })
    .catch((err) => alert(`Erro ao criar vistoria: ${err.message}`));
}

/* ══════════════════════════════════════════
   8. PROCESSOS RELACIONADOS
   ══════════════════════════════════════════ */

// Configurado UMA VEZ no DOMContentLoaded
function inicializarBuscaRelacionado() {
  const input = document.getElementById("buscaRelacionadoInput");
  const dropdown = document.getElementById("buscaRelacionadoDropdown");

  // debounce de 350ms: só busca quando o usuário para de digitar
  const buscarComDebounce = debounce(buscarProcessos, 350);
  input.addEventListener("input", () => buscarComDebounce(input.value.trim()));

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#buscaRelacionadoInput") &&
      !e.target.closest("#buscaRelacionadoDropdown")
    ) {
      dropdown.style.display = "none";
    }
  });
}

function buscarProcessos(termo) {
  const dropdown = document.getElementById("buscaRelacionadoDropdown");

  if (termo.length < 2) {
    dropdown.style.display = "none";
    return;
  }

  // excluir_id garante que o processo atual não aparece nos resultados
  const params = new URLSearchParams({
    q: termo,
    excluir_id: estado.processoId,
  });

  fetchJSON(`/api/processos/buscar/?${params}`)
    .then((data) => renderizarDropdownRelacionados(data.processos))
    .catch((err) => console.error("Erro na busca:", err));
}

function renderizarDropdownRelacionados(processos) {
  const dropdown = document.getElementById("buscaRelacionadoDropdown");
  dropdown.innerHTML = "";

  if (processos.length === 0) {
    dropdown.innerHTML =
      '<div class="busca-dropdown-item" style="pointer-events:none;color:var(--icons)">Nenhum processo encontrado</div>';
    dropdown.style.display = "block";
    return;
  }

  processos.forEach((p) => {
    const item = document.createElement("div");
    item.className = "busca-dropdown-item";
    item.innerHTML = `
            <div class="busca-dropdown-item-info">
                <span>${p.nome}</span>
                <span class="busca-dropdown-item-empresa">${p.empresa} · ${p.protocolo}</span>
            </div>
        `;
    item.addEventListener("click", () => {
      adicionarRelacionado(p);
      document.getElementById("buscaRelacionadoInput").value = "";
      dropdown.style.display = "none";
    });
    dropdown.appendChild(item);
  });

  dropdown.style.display = "block";
}

function adicionarRelacionado(processoData) {
  fetchJSON(`/api/processos/${estado.processoId}/relacionados/adicionar/`, {
    method: "POST",
    body: JSON.stringify({ relacionado_id: processoData.id }),
  })
    .then((data) => {
      const container = document.getElementById("relacionadosContainer");
      container.querySelector(".modal-empty-state")?.remove();
      container.appendChild(criarMiniCardRelacionado(data));
    })
    .catch((err) => alert(`Erro ao vincular processo: ${err.message}`));
}

function criarMiniCardRelacionado(p) {
  const card = clonarTemplate("tplProcessoRelacionado");
  card.dataset.relacionadoId = p.id;
  card.dataset.status = p.status; // CSS cuida da cor do badge de protocolo

  card.querySelector(".relacionado-nome").textContent = p.nome;
  card.querySelector(".relacionado-protocolo-badge").textContent =
    `Protocolo: ${p.protocolo}`;

  // Editar → fecha o modal atual e abre o do processo relacionado
  card
    .querySelector(".btn-editar-relacionado")
    .addEventListener("click", () => {
      fecharModalProcesso();
      // Delay mínimo para o modal fechar visualmente antes de reabrir
      setTimeout(() => editarProcesso(p.id), 150);
    });

  card
    .querySelector(".btn-desvincular-relacionado")
    .addEventListener("click", () => {
      if (
        confirm(
          `Deseja realmente desvincular o processo "${p.nome}"?\n\nEsta ação não pode ser desfeita.`,
        )
      ) {
        desvincularRelacionado(p.id, card);
      }
    });

  return card;
}

function desvincularRelacionado(relacionadoId, cardEl) {
  fetchJSON(
    `/api/processos/${estado.processoId}/relacionados/${relacionadoId}/remover/`,
    {
      method: "DELETE",
    },
  )
    .then(() => {
      cardEl.remove();
      const container = document.getElementById("relacionadosContainer");
      if (container.children.length === 0) {
        container.innerHTML =
          '<p class="modal-empty-state">Nenhum processo relacionado.</p>';
      }
    })
    .catch((err) => alert(`Erro ao desvincular: ${err.message}`));
}

function popularRelacionados(relacionados) {
  const container = document.getElementById("relacionadosContainer");
  container.innerHTML = "";

  if (!relacionados || relacionados.length === 0) {
    container.innerHTML =
      '<p class="modal-empty-state">Nenhum processo relacionado.</p>';
    return;
  }

  relacionados.forEach((p) =>
    container.appendChild(criarMiniCardRelacionado(p)),
  );
}

/* ══════════════════════════════════════════
   9. SUB-MODAIS
   ══════════════════════════════════════════ */

// ─── Endereço ───────────────────────────

function abrirSubModalEndereco() {
  document.getElementById("enderecoCompletoTexto").textContent =
    estado.enderecoCompleto;
  document.getElementById("subModalEndereco").style.display = "flex";
}

function fecharSubModalEndereco() {
  document.getElementById("subModalEndereco").style.display = "none";
}

// ─── Anexos ─────────────────────────────

function abrirSubModalAnexos(itemId, itemNome) {
  estado.itemAnexosId = itemId;

  document.getElementById("subModalAnexosTitulo").innerHTML =
    `<i class="fa-solid fa-paperclip"></i> Anexos — ${itemNome}`;

  document.getElementById("listaAnexos").innerHTML =
    '<p class="modal-empty-state">Carregando...</p>';

  document.getElementById("subModalAnexos").style.display = "flex";

  carregarAnexos(itemId);
  inicializarUploadAnexo(itemId);
}

function fecharSubModalAnexos() {
  document.getElementById("subModalAnexos").style.display = "none";
  estado.itemAnexosId = null;
  document.getElementById("inputAnexoUpload").value = "";
}

function carregarAnexos(itemId) {
  fetchJSON(`/api/fases/${itemId}/listar-anexos/`)
    .then((data) => renderizarListaAnexos(data.anexos))
    .catch(() => {
      document.getElementById("listaAnexos").innerHTML =
        '<p class="modal-empty-state">Erro ao carregar anexos.</p>';
    });
}

function renderizarListaAnexos(anexos) {
  const lista = document.getElementById("listaAnexos");
  lista.innerHTML = "";

  if (anexos.length === 0) {
    lista.innerHTML =
      '<p class="modal-empty-state">Nenhum arquivo anexado ainda.</p>';
    return;
  }

  const icones = {
    pdf: "fa-file-pdf",
    png: "fa-file-image",
    jpg: "fa-file-image",
    jpeg: "fa-file-image",
  };

  anexos.forEach((a) => {
    const item = document.createElement("div");
    item.className = "anexo-item";
    item.innerHTML = `
            <i class="fa-solid ${icones[a.tipo_arquivo] || "fa-file"} anexo-item-icone"></i>
            <span class="anexo-item-nome" title="${a.nome_original}">${a.nome_original}</span>
            <a class="anexo-item-link" href="${a.url}" target="_blank" rel="noopener">Visualizar</a>
        `;
    lista.appendChild(item);
  });
}

function inicializarUploadAnexo(itemId) {
  const input = document.getElementById("inputAnexoUpload");

  // Substitui o elemento para remover listeners acumulados de aberturas anteriores.
  // Clonar o nó é mais seguro do que gerenciar referências manualmente.
  const novoInput = input.cloneNode(true);
  input.parentNode.replaceChild(novoInput, input);

  novoInput.addEventListener("change", () => {
    const arquivo = novoInput.files[0];
    if (!arquivo) return;

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    // fetchJSON detecta FormData e NÃO define Content-Type,
    // deixando o browser definir corretamente com o boundary do multipart
    fetchJSON(`/api/fases/${itemId}/anexos/`, {
      method: "POST",
      body: formData,
    })
      .then(() => carregarAnexos(itemId)) // Recarrega a lista após upload bem-sucedido
      .catch((err) => alert(`Erro no upload: ${err.message}`));
  });
}

/* ══════════════════════════════════════════
   10. MENUS, DELEÇÃO E FILTROS
   ══════════════════════════════════════════ */

function toggleMenuOpcoes(event, processoId) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll(".dropdown-conteudo").forEach((menu) => {
    if (menu.id !== `dropdown-${processoId}`) menu.classList.remove("mostrar");
  });
  document
    .getElementById(`dropdown-${processoId}`)
    ?.classList.toggle("mostrar");
}

window.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-opcoes-card")) {
    document
      .querySelectorAll(".dropdown-conteudo")
      .forEach((m) => m.classList.remove("mostrar"));
  }
});

function softDeleteProcesso(event, processoId) {
  event.preventDefault();
  if (
    !confirm(
      "Deseja realmente EXCLUIR este processo? Ele será movido para a coluna de Excluídos.",
    )
  )
    return;

  fetchJSON(`/processos/${processoId}/deletar/`, { method: "DELETE" })
    .then(() => {
      const card = document.querySelector(
        `.processo-card[data-processo-id="${processoId}"]`,
      );
      const colunaExcluidos = document.querySelector(
        '.kanban-column[data-status="EXCLUIDO"] .cards-container',
      );
      if (card && colunaExcluidos) {
        colunaExcluidos.appendChild(card);
        card.dataset.status = "EXCLUIDO";
        document
          .getElementById(`dropdown-${processoId}`)
          ?.classList.remove("mostrar");
      }
    })
    .catch((err) => alert(`Erro ao excluir: ${err.message}`));
}

function hardDeleteProcesso(event, processoId) {
  event.preventDefault();
  if (
    !confirm(
      "ATENÇÃO: Você está prestes a APAGAR DEFINITIVAMENTE este processo do banco de dados. Esta ação é irreversível. Continuar?",
    )
  )
    return;

  fetchJSON(`/processos/${processoId}/apagar/`, { method: "DELETE" })
    .then(() => {
      document
        .querySelector(`.processo-card[data-processo-id="${processoId}"]`)
        ?.remove();
    })
    .catch((err) => alert(`Erro: ${err.message}`));
}

// ─── Filtros ─────────────────────────────

const btns_filtro = document.querySelectorAll(".btn-filtro");

function aplicarFiltro() {
  const botaoAtivo = document.querySelector(".btn-filtro.btn-filtro__actived");
  if (!botaoAtivo) return;

  const orgaoSelecionado = botaoAtivo.dataset.filtro.toUpperCase();
  document.querySelectorAll(".processo-card").forEach((card) => {
    card.classList.toggle(
      "oculto",
      (card.dataset.orgao || "").toUpperCase() !== orgaoSelecionado,
    );
  });
}

btns_filtro.forEach((btn) => {
  btn.addEventListener("click", () => {
    btns_filtro.forEach((b) => b.classList.remove("btn-filtro__actived"));
    btn.classList.add("btn-filtro__actived");
    aplicarFiltro();
  });
});

/* ══════════════════════════════════════════
   11. CRM (CLIENTES E EMPRESAS)
   ══════════════════════════════════════════ */

// ─── LISTAGENS (Tabelas) ───
function abrirModalListClientes() {
  fetchJSON("/api/clientes/").then((data) => {
    const tbody = document.getElementById("tbodyClientesList");
    tbody.innerHTML = "";
    data.clientes.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; font-weight: 700; color: var(--light-font2);">${c.nome_responsavel}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--light-font2); font-size: 0.85rem;">${c.email}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--light-font2); font-size: 0.85rem;">${c.cpf}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--icons); font-size: 0.8rem;">${c.data_criacao}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;"></td>
            `;
      const btn = document.createElement("button");
      btn.className = "btn-submit-modal";
      btn.style.cssText =
        "padding: 6px 18px; font-size: 0.8rem; border-radius: 20px;";
      btn.textContent = "Editar";
      btn.onclick = () => abrirModalFormCliente(c);
      tr.lastElementChild.appendChild(btn);
      tbody.appendChild(tr);
    });
    document.getElementById("modalListClientes").style.display = "flex";
  });
}

function abrirModalListEmpresas() {
  fetchJSON("/api/empresas/").then((data) => {
    const tbody = document.getElementById("tbodyEmpresasList");
    tbody.innerHTML = "";
    data.empresas.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; font-weight: 700; color: var(--light-font2);">${e.nome_empresa}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--light-font2); font-size: 0.85rem;">${e.cnpj}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--light-font2); font-size: 0.85rem;">${e.cliente_nome}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: var(--icons); font-size: 0.8rem;">${e.data_criacao}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;"></td>
            `;
      const btn = document.createElement("button");
      btn.className = "btn-submit-modal";
      btn.style.cssText =
        "padding: 6px 18px; font-size: 0.8rem; border-radius: 20px;";
      btn.textContent = "Editar";
      btn.onclick = () => abrirModalFormEmpresa(e);
      tr.lastElementChild.appendChild(btn);
      tbody.appendChild(tr);
    });
    document.getElementById("modalListEmpresas").style.display = "flex";
  });
}

// ─── LÓGICA DOS CHIPS (Vínculo Empresa -> Cliente) ───
const chipsEmpresasClient = new Map();

function inicializarChipsEmpresas() {
  const searchInput = document.getElementById("empresasClientSearch");
  const dropdown = document.getElementById("empresasClientDropdown");

  const render = () => {
    fetchJSON("/api/empresas/").then((data) => {
      const termo = searchInput.value.trim().toLowerCase();
      const filtradas = data.empresas.filter((e) =>
        e.nome_empresa.toLowerCase().includes(termo),
      );

      dropdown.innerHTML = "";
      if (filtradas.length === 0) {
        dropdown.innerHTML =
          '<div class="chips-dropdown-item" style="pointer-events:none;color:var(--icons)">Nenhuma empresa encontrada</div>';
      } else {
        filtradas.forEach((emp) => {
          const item = document.createElement("div");
          item.className = "chips-dropdown-item";
          item.textContent = emp.nome_empresa;
          if (chipsEmpresasClient.has(String(emp.id)))
            item.classList.add("selecionado");

          item.addEventListener("click", () => {
            adicionarChipEmpresa(emp.id, emp.nome_empresa);
            searchInput.value = "";
            dropdown.style.display = "none";
          });
          dropdown.appendChild(item);
        });
      }
      dropdown.style.display = "block";
    });
  };

  searchInput.addEventListener("input", debounce(render, 300));
  searchInput.addEventListener("focus", render);

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#empresasClientField") &&
      !e.target.closest("#empresasClientDropdown")
    ) {
      dropdown.style.display = "none";
    }
  });
}
document.addEventListener("DOMContentLoaded", inicializarChipsEmpresas);

function adicionarChipEmpresa(id, nome) {
  const sid = String(id);
  if (chipsEmpresasClient.has(sid)) return;

  chipsEmpresasClient.set(sid, nome);
  const chip = document.createElement("div");
  chip.className = "chip-responsavel";
  chip.dataset.empresaId = sid;
  chip.innerHTML = `<span class="chip-nome">${nome}</span><button type="button" class="chip-remover"><i class="fa-solid fa-xmark"></i></button>`;

  chip.querySelector(".chip-remover").addEventListener("click", () => {
    chipsEmpresasClient.delete(sid);
    chip.remove();
  });

  document.getElementById("empresasClientChips").appendChild(chip);
}

// ─── FORMULÁRIOS ───
function abrirModalFormCliente(cliente = null) {
  document.getElementById("formCliente").reset();
  document.getElementById("empresasClientChips").innerHTML = "";
  chipsEmpresasClient.clear();

  if (cliente) {
    document.getElementById("formClienteId").value = cliente.id;
    document.getElementById("clienteNome").value = cliente.nome_responsavel;
    document.getElementById("clienteTelefone").value = cliente.telefone;
    document.getElementById("clienteEmail").value = cliente.email;
    document.getElementById("clienteCpf").value = cliente.cpf;
    cliente.empresas.forEach((emp) =>
      adicionarChipEmpresa(emp.id, emp.nome_empresa),
    );
  } else {
    document.getElementById("formClienteId").value = "";
  }
  document.getElementById("modalFormCliente").style.display = "flex";
}

function salvarCliente(e) {
  e.preventDefault();
  const id = document.getElementById("formClienteId").value;
  const body = {
    nome_responsavel: document.getElementById("clienteNome").value,
    telefone: document.getElementById("clienteTelefone").value,
    email: document.getElementById("clienteEmail").value,
    cpf: document.getElementById("clienteCpf").value,
    empresas: Array.from(chipsEmpresasClient.keys()),
  };

  fetchJSON(id ? `/api/clientes/${id}/salvar/` : `/api/clientes/salvar/`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  })
    .then(() => {
      fecharModalFormCliente();
      abrirModalListClientes(); // Atualiza a tabela com o recém-salvo
    })
    .catch((err) => alert(err.message));
}

function abrirModalFormEmpresa(empresa = null) {
    document.getElementById("formEmpresa").reset();

    // Garante a limpeza dos campos opcionais de endereço ao abrir
    document.getElementById("empresaCep").value = "";
    document.getElementById("empresaLogradouro").value = "";
    document.getElementById("empresaNumero").value = "";
    document.getElementById("empresaComplemento").value = "";
    document.getElementById("empresaBairro").value = "";
    document.getElementById("empresaCidade").value = "";
    document.getElementById("empresaEstado").value = "";

    // Popula o select de Clientes antes de abrir
    fetchJSON("/api/clientes/").then((data) => {
        const sel = document.getElementById("empresaClienteSelect");

        sel.innerHTML = '<option value="">Selecione o Cliente</option>';

        data.clientes.forEach((c) => {
            sel.innerHTML += `<option value="${c.id}">${c.nome_responsavel}</option>`;
        });

        if (empresa) {
            document.getElementById("formEmpresaId").value = empresa.id;
            document.getElementById("empresaNome").value = empresa.nome_empresa;
            document.getElementById("empresaCnpj").value = empresa.cnpj;
            document.getElementById("empresaCnae").value = empresa.cnae;

            sel.value = empresa.cliente_id;

            // Se a empresa vinda do banco já possuir endereço, popula o formulário
            if (empresa.endereco) {
                document.getElementById("empresaCep").value =
                    empresa.endereco.cep || "";
                document.getElementById("empresaLogradouro").value =
                    empresa.endereco.logradouro || "";
                document.getElementById("empresaNumero").value =
                    empresa.endereco.numero || "";
                document.getElementById("empresaComplemento").value =
                    empresa.endereco.complemento || "";
                document.getElementById("empresaBairro").value =
                    empresa.endereco.bairro || "";
                document.getElementById("empresaCidade").value =
                    empresa.endereco.cidade || "";
                document.getElementById("empresaEstado").value =
                    empresa.endereco.estado || "";
            }
        } else {
            document.getElementById("formEmpresaId").value = "";
        }

        document.getElementById("modalFormEmpresa").style.display = "flex";
    });
}

function salvarEmpresa(e) {
  e.preventDefault();

  // Validação Front-end Básica dos campos obrigatórios
  const cnpjRaw = document.getElementById("empresaCnpj").value.replace(/\D/g, '');
  const cnaeRaw = document.getElementById("empresaCnae").value.replace(/\D/g, '');
  
  if (cnpjRaw.length !== 14) return alert("Por favor, preencha o CNPJ corretamente (14 dígitos).");
  if (cnaeRaw.length !== 7) return alert("Por favor, preencha o CNAE corretamente (7 dígitos).");

  // Captura e verificação dos campos de endereço
  const cepRaw = document.getElementById("empresaCep").value.replace(/\D/g, '');
  const logradouro = document.getElementById("empresaLogradouro").value.trim();
  
  // Se o usuário preencher o CEP ou o Logradouro, o bloco de endereço torna-se obrigatório
  const preencheuEndereco = cepRaw.length > 0 || logradouro.length > 0;
  
  if (preencheuEndereco) {
      if (cepRaw.length !== 8) return alert("Para salvar o endereço, preencha o CEP corretamente (8 números).");
      if (!logradouro) return alert("O campo Logradouro é obrigatório caso queira salvar o endereço.");
      if (!document.getElementById("empresaNumero").value.trim()) return alert("O campo Número é obrigatório.");
      if (!document.getElementById("empresaBairro").value.trim()) return alert("O campo Bairro é obrigatório.");
      if (!document.getElementById("empresaCidade").value.trim()) return alert("O campo Cidade é obrigatório.");
      if (document.getElementById("empresaEstado").value.trim().length !== 2) return alert("Preencha o Estado (UF) com duas letras.");
  }

  const id = document.getElementById("formEmpresaId").value;
  
  // Montagem do payload estruturado com o nó de endereço
  const body = {
    cliente_id: document.getElementById("empresaClienteSelect").value,
    nome_empresa: document.getElementById("empresaNome").value,
    cnpj: document.getElementById("empresaCnpj").value,
    cnae: document.getElementById("empresaCnae").value,
    endereco: preencheuEndereco ? {
        cep: document.getElementById("empresaCep").value,
        logradouro: logradouro,
        numero: document.getElementById("empresaNumero").value.trim(),
        complemento: document.getElementById("empresaComplemento").value.trim(),
        bairro: document.getElementById("empresaBairro").value.trim(),
        cidade: document.getElementById("empresaCidade").value.trim(),
        estado: document.getElementById("empresaEstado").value.trim().toUpperCase()
    } : null
  };

  fetchJSON(id ? `/api/empresas/${id}/salvar/` : `/api/empresas/salvar/`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  })
    .then(() => {
      window.location.reload();
    })
    .catch((err) => alert(err.message));
}

function fecharModalListClientes() {
  document.getElementById("modalListClientes").style.display = "none";
}
function fecharModalFormCliente() {
  document.getElementById("modalFormCliente").style.display = "none";
}
function fecharModalListEmpresas() {
  document.getElementById("modalListEmpresas").style.display = "none";
}
function fecharModalFormEmpresa() {
  document.getElementById("modalFormEmpresa").style.display = "none";
}

// ─── MÁSCARAS DE INPUT E VALIDAÇÃO FRONT-END ───

// Funções de formatação Regex
const mascaras = {
    cpf(valor) {
        return valor
            .replace(/\D/g, '') // Remove tudo o que não é dígito
            .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto
            .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto
            .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca traço
            .replace(/(-\d{2})\d+?$/, '$1'); // Impede digitação extra
    },
    cnpj(valor) {
        return valor
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    },
    telefone(valor) {
        return valor
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4,5})(\d{4})$/, '$1-$2'); // Lida com 8 ou 9 dígitos
    },
    cnae(valor) {
        return valor
            .replace(/\D/g, '')                   // Remove tudo o que não é dígito
            .replace(/^(\d{4})(\d)/, '$1-$2')     // Coloca o traço após os 4 primeiros dígitos
            .replace(/^(\d{4}-\d)(\d)/, '$1/$2')  // Coloca a barra após o 5º dígito
            .substring(0, 9);                     // Garante o tamanho máximo de 0000-0/00
    },
    cep(valor) {
        return valor
            .replace(/\D/g, '')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .substring(0, 9);
    },
    estado(valor) {
        return valor
            .replace(/[^a-zA-Z]/g, '') // Remove o que não for letra
            .toUpperCase()
            .substring(0, 2);
    }
};

// Aplicação dos eventos aos inputs quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    // Só adiciona se o elemento existir na tela
    const inCpf = document.getElementById('clienteCpf');
    const inTel = document.getElementById('clienteTelefone');
    const inCnpj = document.getElementById('empresaCnpj');
    const inCnae = document.getElementById('empresaCnae');
    const inCep = document.getElementById('empresaCep');
    const inEstado = document.getElementById('empresaEstado');
    
    if(inCep) inCep.addEventListener('input', (e) => { e.target.value = mascaras.cep(e.target.value); });
    if(inEstado) inEstado.addEventListener('input', (e) => { e.target.value = mascaras.estado(e.target.value); });
    if(inCpf) inCpf.addEventListener('input', (e) => { e.target.value = mascaras.cpf(e.target.value); });
    if(inTel) inTel.addEventListener('input', (e) => { e.target.value = mascaras.telefone(e.target.value); });
    if(inCnpj) inCnpj.addEventListener('input', (e) => { e.target.value = mascaras.cnpj(e.target.value); });
    if(inCnae) inCnae.addEventListener('input', (e) => { e.target.value = mascaras.cnae(e.target.value); });
});

// ─── SUBSTITUA AS FUNÇÕES DE SALVAR ORIGINAIS POR ESTAS ───

function salvarCliente(e) {
  e.preventDefault();
  
  // Validação Front-end Básica
  const cpfRaw = document.getElementById("clienteCpf").value.replace(/\D/g, '');
  const telRaw = document.getElementById("clienteTelefone").value.replace(/\D/g, '');
  
  if (cpfRaw.length !== 11) return alert("Por favor, preencha o CPF corretamente (11 dígitos).");
  if (telRaw.length < 10) return alert("Por favor, preencha o telefone com DDD válido.");

  const id = document.getElementById("formClienteId").value;
  const body = {
    nome_responsavel: document.getElementById("clienteNome").value,
    telefone: document.getElementById("clienteTelefone").value, // Envia formatado com a máscara
    email: document.getElementById("clienteEmail").value,
    cpf: document.getElementById("clienteCpf").value, // Envia formatado
    empresas: Array.from(chipsEmpresasClient.keys()),
  };

  fetchJSON(id ? `/api/clientes/${id}/salvar/` : `/api/clientes/salvar/`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body),
  })
    .then(() => {
      fecharModalFormCliente();
      abrirModalListClientes();
    })
    .catch((err) => alert(err.message));
}
/* ══════════════════════════════════════════
   12. BUSCA GLOBAL DE PROCESSOS (barra de filtros)
   Mesmo endpoint e visual da busca do modal,
   mas ao clicar abre o modal de edição
   em vez de relacionar ao processo atual.
   ══════════════════════════════════════════ */

function inicializarBuscaGlobal() {
    const input    = document.getElementById('buscaGlobalInput');
    const dropdown = document.getElementById('buscaGlobalDropdown');

    // Defesa: se os elementos não existirem na página, encerra silenciosamente
    if (!input || !dropdown) return;

    const buscarComDebounce = debounce(buscarProcessosGlobal, 350);

    input.addEventListener('input', () => {
        buscarComDebounce(input.value.trim());
    });

    // Reexibe o dropdown ao focar se já houver texto suficiente
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) {
            buscarProcessosGlobal(input.value.trim());
        }
    });

    // Fecha o dropdown ao clicar fora do campo
    document.addEventListener('click', e => {
        if (!e.target.closest('#buscaGlobalInput') &&
            !e.target.closest('#buscaGlobalDropdown')) {
            dropdown.style.display = 'none';
        }
    });
}

function buscarProcessosGlobal(termo) {
    const dropdown = document.getElementById('buscaGlobalDropdown');

    if (termo.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    // Sem excluir_id: na busca global queremos ver todos os processos
    const params = new URLSearchParams({ q: termo });

    fetchJSON(`/api/processos/buscar/?${params}`)
        .then(data => renderizarDropdownGlobal(data.processos))
        .catch(err => console.error('Erro na busca global:', err));
}

function renderizarDropdownGlobal(processos) {
    const dropdown = document.getElementById('buscaGlobalDropdown');
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

        // Mesmo template visual da busca do modal
        item.innerHTML = `
            <div class="busca-dropdown-item-info">
                <span>${p.nome}</span>
                <span class="busca-dropdown-item-empresa">${p.empresa} · ${p.protocolo}</span>
            </div>
        `;

        item.addEventListener('click', () => {
            // Comportamento diferente: abre o modal de edição
            editarProcesso(p.id);

            // Limpa e fecha o campo de busca após a seleção
            document.getElementById('buscaGlobalInput').value = '';
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}