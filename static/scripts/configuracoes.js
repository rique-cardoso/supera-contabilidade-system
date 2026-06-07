/* ══════════════════════════════════════════
   CONFIGURAÇÕES (Perfil e Convites)
   Requer: utils.js para uso do fetchJSON
   ══════════════════════════════════════════ */

async function atualizarPerfil(e) {
    e.preventDefault();
    
    const body = {
        email: document.getElementById('meuEmail').value,
        senha: document.getElementById('minhaSenha').value
    };

    try {
        // Usa o seu fetchJSON do utils.js (ele já injeta o CSRF e os headers!)
        const data = await fetchJSON('/api/perfil/atualizar/', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        alert(data.mensagem);
        
        // Se o usuário trocou a senha, força o redirecionamento para o login
        if (body.senha) {
            window.location.href = '/login/';
        }
        
    } catch (error) {
        // O fetchJSON dispara um 'throw new Error', o catch captura aqui
        alert(error.message);
    }
}


async function enviarConvite(e) {
    e.preventDefault();
    
    const body = {
        nome: document.getElementById('conviteNome').value,
        email: document.getElementById('conviteEmail').value,
        role: document.getElementById('conviteRole').value
    };

    try {
        const data = await fetchJSON('/api/usuarios/convidar/', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        alert(data.mensagem);
        document.getElementById('formConvite').reset(); // Limpa o form após sucesso
        
    } catch (error) {
        alert(error.message);
    }
}