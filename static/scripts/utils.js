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

