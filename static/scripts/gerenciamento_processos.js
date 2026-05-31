// ============ FUNÇÕES DO MODAL ============
const modal = document.getElementById("modalProcesso");

function abrirModal(status = null) {
  modal.classList.add("show");
  if (status) {
    document.getElementById("formProcesso").dataset.status = status;
  }
}

function fecharModal() {
  modal.classList.remove("show");
  document.getElementById("formProcesso").reset();
}

// Abrir modal ao clicar em "Novo Processo"
document.querySelectorAll(".btn-novo-processo").forEach((btn) => {
  btn.addEventListener("click", function () {
    const status =
      this.closest(".kanban-coluna").querySelector("[data-status]").dataset
        .status;
    abrirModal(status);
  });
});

// Fechar modal ao clicar fora dele
window.addEventListener("click", function (event) {
  if (event.target === modal) {
    fecharModal();
  }
});

// ============ FILTRO DE ÓRGÃO ============
document.querySelectorAll(".btn-orgao").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".btn-orgao")
      .forEach((b) => b.classList.remove("btn-orgao-ativo"));
    this.classList.add("btn-orgao-ativo");

    const orgao = this.dataset.orgao;
    console.log("Filtrar por:", orgao);
    // Aqui você implementará a filtragem
  });
});

// ============ BUSCA ============
document.getElementById("searchInput").addEventListener("input", function (e) {
  const termo = e.target.value.toLowerCase();
  document.querySelectorAll(".processo-card").forEach((card) => {
    const texto = card.textContent.toLowerCase();
    card.style.display = texto.includes(termo) ? "" : "none";
  });
});

// ============ DRAG AND DROP ============
let draggedElement = null;

document.addEventListener("dragstart", function (e) {
  if (e.target.classList.contains("processo-card")) {
    draggedElement = e.target;
    e.target.style.opacity = "0.5";
    e.dataTransfer.effectAllowed = "move";
  }
});

document.addEventListener("dragend", function (e) {
  if (e.target.classList.contains("processo-card")) {
    e.target.style.opacity = "1";
  }
});

document.querySelectorAll(".kanban-cards").forEach((container) => {
  container.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    this.style.backgroundColor = "rgba(185, 208, 55, 0.1)";
  });

  container.addEventListener("dragleave", function (e) {
    this.style.backgroundColor = "";
  });

  container.addEventListener("drop", function (e) {
    e.preventDefault();
    this.style.backgroundColor = "";

    if (draggedElement) {
      const novoStatus = this.dataset.status;
      console.log("Mover para status:", novoStatus);

      // Fazer requisição AJAX para atualizar status
      atualizarStatusProcesso(draggedElement.dataset.processoId, novoStatus);

      this.appendChild(draggedElement);
      draggedElement = null;
    }
  });
});

function atualizarStatusProcesso(processoId, novoStatus) {
  fetch(`/api/processos/${processoId}/status/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
    },
    body: JSON.stringify({ status: novoStatus }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Status atualizado:", data);
    })
    .catch((error) => console.error("Erro:", error));
}
