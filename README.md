# 🚀 Projeto Supera - Sistema de Gestão Contábil

O **Supera** é um Sistema de Informação Gerencial (SIG) web desenvolvido sob medida para Assessorias Contábeis. Seu objetivo principal é atuar como um orquestrador centralizado do ciclo de vida de trâmites burocráticos governamentais (Prefeituras, Corpo de Bombeiros, Vigilância Sanitária), automatizando o monitoramento de prazos, controle de vistorias e a gestão hierárquica de checklists documentais.

A plataforma substitui o controle manual em planilhas por um ecossistema inteligente, com foco em segurança, auditoria e facilidade de uso diário.

## 🛠️ Tecnologias Utilizadas

* **Backend:** Python, Django
* **Banco de Dados:** SQLite (Desenvolvimento) / PostgreSQL (Produção - futuro)
* **Frontend:** HTML5, CSS3 (Arquitetura de CSS Global)
* **Autenticação e Segurança:** Custom User Model do Django com controle de papéis (Admin e Padrão)
* **Gerenciamento de Configurações:** `python-decouple` para variáveis de ambiente

---

## 📁 Estrutura do Projeto

A arquitetura do projeto foi pensada para ser limpa e escalável, utilizando diretórios globais para templates e arquivos estáticos:

```text
supera/
│
├── manage.py             # Script de gerenciamento do Django
├── requirements.txt      # Lista de dependências do projeto
├── .env.example          # Exemplo de variáveis de ambiente
├── db.sqlite3            # Banco de dados local (gerado após as migrações)
│
├── setup/                # Configurações globais do projeto (settings, urls)
├── core/                 # App principal (models, views, lógica de negócio)
├── clientes/
├── notificacoes/
├── processos/            
│
├── templates/            # Templates HTML globais
│   └── partials/
│       └── card_processo.html
│       └── modais_crm.html
│       └── modal_processo.html
│   └── recuperar_senha/
│       └── password_reset_complete.html
│       └── password_reset_confirm.html
│       └── password_reset_done.html
│       └── password_reset_email.html
│       └── password_reset_form.html
│       └── password_reset_subject.txt
│   ├── base.html         # Template mestre com layout padrão
│   └── login.html        # Interface de autenticação
│   └── aceitar_convite.html
│   └── configuracoes.html
│   └── dashboard.html
│   └── gerenciamento_processos.html
│
└── static/               # Arquivos estáticos globais
    └── css/
        └── global.css    # Variáveis globais e estilização base
        └── configuracoes.css
        └── dashboard.css
        └── gerenciamento_processos.css
        └── login.css
        └── modais_crm.css
        └── modal_processo.css
        └── password_reset.css
        └── theme.css
    └── img/
    └── scripts/
        └── configuracoes.js
        └── dashboard.js
        └── gerenciamento_processo.js
        └── utils.js

```

---

## ⚙️ Como Configurar e Rodar o Projeto Localmente

Siga o passo a passo abaixo para configurar o ambiente e rodar a aplicação em sua máquina:

### 1. Pré-requisitos

Certifique-se de ter o [Python](https://www.python.org/downloads/) e o [Git](https://git-scm.com/) instalados no seu sistema.

### 2. Clonar o Repositório

Abra o terminal e clone o projeto para sua máquina local:

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd supera

```

### 3. Criar e Ativar o Ambiente Virtual

O ambiente virtual isola as dependências do projeto para não haver conflito com outras aplicações.

```bash
# Criar o ambiente virtual na pasta do projeto
python -m venv venv

# Ativar o ambiente virtual no Windows
.\venv\Scripts\activate

# Ativar o ambiente virtual no Linux/Mac
source venv/bin/activate

```

### 4. Instalar as Dependências

Com o ambiente ativado (você verá `(venv)` no terminal), instale todas as bibliotecas necessárias de uma só vez lendo o arquivo `requirements.txt`:

```bash
pip install -r requirements.txt

```

### 5. Configurar as Variáveis de Ambiente (.env)

Por segurança, senhas e chaves não ficam no código-fonte. O projeto utiliza o `python-decouple` para ler essas informações de um arquivo `.env` local.

1. Crie uma cópia do arquivo de exemplo:
* No Windows: `copy .env.example .env`
* No Linux/Mac: `cp .env.example .env`


2. Gere uma `SECRET_KEY` segura para o Django. Você pode gerar uma rapidamente rodando este comando no terminal:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"

```


3. Abra o arquivo `.env` recém-criado e cole a chave gerada. O arquivo deve ficar assim:
```env
SECRET_KEY=cole-a-chave-gerada-aqui
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

```



### 6. Configurar o Banco de Dados

Com as variáveis de ambiente prontas, gere as tabelas base do sistema no SQLite, incluindo o modelo de usuário customizado criado para a auditoria do sistema:

```bash
python manage.py makemigrations
python manage.py migrate

```

### 7. Criar o Usuário Administrador

Para acessar o sistema e gerenciar outros usuários, crie o superusuário inicial. Como a regra de negócio exige a imutabilidade do `username` para fins de auditoria, preencha os dados com atenção:

```bash
python manage.py createsuperuser

```

O sistema solicitará a criação de um *username*, *e-mail* e *senha*. Este usuário receberá automaticamente o papel de **Administrador**.

### 8. Executar o Servidor de Desenvolvimento

Inicie a aplicação localmente:

```bash
python manage.py runserver

```

### 9. Acessar o Sistema

Abra o seu navegador e acesse:

* **Tela de Login:** `http://127.0.0.1:8000/login/`
* **Painel Administrativo do Django:** `http://127.0.0.1:8000/admin/`

---

## 🔐 Regras de Autenticação e Perfis

O sistema Supera opera com um modelo de usuário customizado (`core.Usuario`), dividido em dois papéis (`roles`):

* **Administrador:** Acesso total. Capacidade de criar, gerenciar e atribuir papéis a novos usuários, além de visualizar os logs de auditoria do sistema.
* **Usuário Padrão:** Acesso operacional. Permissão para visualizar, editar e interagir com processos, checklists e alertas, sem acesso à gestão da equipe.