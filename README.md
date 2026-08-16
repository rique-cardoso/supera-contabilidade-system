# 🚀 Supera Contabilidade System

![Status](https://img.shields.io/badge/Status-Em_homologação-blue)
![Licença](https://img.shields.io/badge/Licença-MIT-green)
![Versão](https://img.shields.io/badge/Versão-1.0.0-orange)

> Sistema automatizado de gestão de processos, controle de alvarás, disparo de notificações e organização documental em nuvem para escritórios de contabilidade.

---

## 📖 Sobre
O gerenciamento de prazos, renovações de alvarás (Prefeitura, Corpo de Bombeiros, etc.) e o controle rigoroso de checklists documentais são os maiores desafios operacionais de um escritório de contabilidade. A perda de um prazo pode resultar em multas severas ou na interdição das atividades de um cliente. O **Supera** foi idealizado para resolver este problema, atuando como um motor inteligente que retira o peso do acompanhamento manual das costas dos colaboradores, automatizando os alertas e estruturando a guarda de arquivos.

Direcionado para equipes contábeis e de legalização, o sistema não apenas gerencia as fases de cada processo, mas também conta com um Motor de Notificações autônomo (via *Cronjob*) que cobra e avisa os responsáveis sobre vistorias e vencimentos críticos por e-mail. Além disso, o software possui integração nativa com o Google Drive (OAuth2), que intercepta os uploads de arquivos e os organiza automaticamente na nuvem em uma hierarquia estrita de pastas (`Cliente > Empresa > Protocolo`), garantindo segurança e organização impecáveis.

---

## 🚧 Status do Projeto
- [x] Planejamento
- [x] Documentação
- [x] Desenvolvimento
- [x] Testes
- [x] Avaliação
- [x] Deploy
- [x] **Homologação** (Fase atual)

---

## 👁️ Demonstração
Você pode acessar a aplicação em produção aqui: [Link para o Deploy](http://179.197.74.224/login/)

<img width="1680" height="720" alt="Video-Project-4" src="https://github.com/user-attachments/assets/2becb95f-c185-4f42-b632-8ec1fdd68ff2" />

---

## ✨ Funcionalidades
- **Gestão Completa de Processos:** Criação, edição e acompanhamento de processos atrelados a empresas e órgãos específicos, com cálculo automático de datas de vencimento.
- **Organizador Inteligente (Google Drive):** Upload de anexos integrado à API do Google Drive via OAuth2. O sistema cria pastas dinamicamente seguindo o padrão de hierarquia da contabilidade e salva apenas a URL no banco de dados.
- **Motor de Notificações Autônomo:** Varredura automática em segundo plano que identifica prazos estourando (30, 20, 10 dias e vencidos) ou vistorias agendadas.
- **Disparo Automático de E-mails:** Alertas enviados proativamente para os e-mails dos usuários responsáveis por cada processo específico.
- **Controle de Checklist e Fases:** Fases geradas automaticamente baseadas no tipo de órgão (Prefeitura vs. Bombeiros) para controle exato da documentação pendente.
- **Dashboard e Rastreabilidade:** Visualização Kanban de status (Ativo, Vencendo, Vencido) e registro de logs de ações necessárias.

---

## 🛠 Tecnologias Utilizadas
As seguintes ferramentas foram usadas na construção do projeto:

**Back-end:**
- Python 3.12
- Django
- Google API Python Client (OAuth2)

**Banco de Dados:**
- PostgreSQL (Produção)
- SQLite (Desenvolvimento local)

**Infraestrutura e Deploy:**
- Docker e Docker Compose
- Nginx (Proxy reverso configurado para uploads até 50MB)
- Gunicorn
- Linux VPS (Ubuntu) com Cronjobs ativados

---

## ⚙️ Pré-requisitos
Para rodar este projeto localmente ou em produção, você precisará ter instalado:

- Python 3.12+
- Git
- Arquivo `credentials.json` gerado no Google Cloud Console (para acesso à API do Drive).

---

## 🚀 Como Rodar o Projeto

### Ambiente de Desenvolvimento (Local)

**1. Clone o repositório**
```
git clone https://github.com/rique-cardoso/supera-contabilidade-system.git 
cd supera-contabilidade-system
```
**2. Crie e ative o ambiente virtual:**
```
python -m venv venv 
source venv/bin/activate  # No Windows use: venv\Scripts\activate
```
**3. Instale as dependências:**
`pip install -r requirements.txt`

**4. Configuração das Variáveis de Ambiente:**
- Crie um arquivo `.env` na raiz do projeto.
- Adicione as variáveis necessárias (ex: `SECRET_KEY`, `DEBUG=True`, `GDRIVE_ROOT_FOLDER_ID`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`).

**5. Gere o Token do Google Drive:**
- Coloque o arquivo `credentials.json` na raiz do projeto.
- Rode o script de autorização e siga as instruções no navegador: `python gerar_token.py`

**6. Execute as migrações do banco de dados (SQLite):** `python manage.py migrate`

**7. Inicie o servidor:** `python manage.py runserver`

### Ambiente de Produção (Docker/VPS)
1. **Preparação:** Garanta que os arquivos `.env`, `credentials.json` e `token.json` estejam configurados na raiz do projeto no servidor.
2. **Construa e levante os containers:** `docker compose up -d --build web`
3. **Execute as migrações no banco PostgreSQL:** `docker exec -it supera_web python manage.py migrate`
4. **Configuração do Cronjob (Notificações automáticas):** Adicione o Cronjob no servidor local (crontab -e): `* * * * * docker exec supera_web python manage.py processar_alertas >> /caminho/absoluto/cron_alertas.log 2>&1`

---

## 🔌 Documentação da API
O sistema opera majoritariamente renderizando templates pelo backend, mas possui endpoints REST para lidar com interações assíncronas no frontend:

`PATCH /api/fases/<id>/marcar-lida/`

- **Descrição:** Marca uma notificação específica como lida no dashboard do usuário.
- **Regra de Segurança:** Apenas o destinatário vinculado à notificação ou um usuário "admin" tem permissão (HTTP 403 para acessos indevidos).

`POST /api/fases/<id>/anexos/`

- **Descrição:** Recebe o FormData com o documento, interage com o Google Drive para criar a árvore de pastas e salvar o arquivo, retornando a URL gerada no banco.

---

## 📫 Contato

**Henrique Prates Cardoso**

[LinkedIn](https://www.linkedin.com/in/henrique-cardoso-b365b1291/) | [GitHub](https://github.com/rique-cardoso) | [E-mail](mailto:henrique.prates.br@gmail.com)
