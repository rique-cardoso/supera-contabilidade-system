from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.forms import CustomLoginForm
from django.conf import settings
from django.conf.urls.static import static
from clientes.views import listar_clientes, listar_empresas, salvar_cliente, salvar_empresa
from django.views.generic import TemplateView
from core.views import (
    gerenciamento_processos,
    criar_processo,
    editar_processo,
    deletar_processo,
    atualizar_status_processo,
    obter_processo,
    apagar_processo,
    obter_processo_completo,
    toggle_fase_processo,
    criar_fase_personalizada,
    upload_anexo,
    criar_vistoria,
    atualizar_status_vistoria,
    adicionar_processo_relacionado,
    remover_processo_relacionado,
    obter_empresa_detalhes,
    buscar_processos,
    listar_anexos,
    configuracoes,
    atualizar_perfil,
    convidar_usuario,
    aceitar_convite,
    dashboard,
    marcar_notificacao_lida,
    base
)

urlpatterns = [
    # Rota admin
    path('admin/', admin.site.urls),

    # Rota raiz (home)
    path('gerenciamento_processos', gerenciamento_processos, name='gerenciamento_processos'),

    # Configurações e Perfil
    path('configuracoes/', configuracoes, name='configuracoes'),
    path('api/perfil/atualizar/', atualizar_perfil, name='atualizar_perfil'),
    path('api/usuarios/convidar/', convidar_usuario, name='convidar_usuario'),

    # Rota dinâmica para aceite do convite via E-mail
    path('convite/<uidb64>/<token>/', aceitar_convite, name='aceitar_convite'),

    # Rotas de processos
    path('processos/criar/', criar_processo, name='criar_processo'),
    path('processos/<int:processo_id>/editar/', editar_processo, name='editar_processo'),
    path('processos/<int:processo_id>/deletar/', deletar_processo, name='deletar_processo'),
    path('processos/<int:processo_id>/apagar/', apagar_processo, name='apagar_processo'),

    # API: Processo completo (para o modal)
    path('api/processos/buscar/', buscar_processos, name='buscar_processos'),
    path('api/processos/<int:processo_id>/status/', atualizar_status_processo, name='atualizar_status_processo'),
    path('api/processos/<int:processo_id>/obter/', obter_processo, name='obter_processo'),
    path('api/processos/<int:processo_id>/completo/', obter_processo_completo, name='obter_processo_completo'),

    # API: Processos relacionados
    path('api/processos/<int:processo_id>/relacionados/adicionar/', adicionar_processo_relacionado, name='adicionar_processo_relacionado'),
    path('api/processos/<int:processo_id>/relacionados/<int:relacionado_id>/rmeover/', remover_processo_relacionado, name='remover_processo_relacionado'),
    
    # API: Vistorias
    path('api/processos/<int:processo_id>/vistorias/criar/', criar_vistoria, name='criar_vistoria'),
    path('api/vistorias/<int:vistoria_id>/status/', atualizar_status_vistoria, name='atualizar_status_vistoria'),

    # API: Fases (Substituindo os antigos itens)
    path('api/processos/<int:processo_id>/fases/criar/', criar_fase_personalizada, name='criar_fase_personalizada'),
    path('api/fases/<int:fase_id>/toggle/', toggle_fase_processo, name='toggle_fase_processo'),
    path('api/fases/<int:fase_id>/anexos/', upload_anexo, name='upload_anexo'),
    path('api/fases/<int:fase_id>/listar-anexos/', listar_anexos, name='listar_anexos'),

    # API: Empresa
    path('api/empresas/<int:empresa_id>/detalhes/', obter_empresa_detalhes, name='obter_empresa_detalhes'),

    # API: Clientes e Empresas
    path('api/clientes/', listar_clientes, name='listar_clientes'),
    path('api/clientes/salvar/', salvar_cliente, name='criar_cliente'),
    path('api/clientes/<int:cliente_id>/salvar/', salvar_cliente, name='editar_cliente'),
    path('api/empresas/', listar_empresas, name='listar_empresas'),
    path('api/empresas/salvar/', salvar_empresa, name='criar_empresa'),
    path('api/empresas/<int:empresa_id>/salvar/', salvar_empresa, name='editar_empresa'),

    # Dashboard
    path('dashboard/', dashboard, name='dashboard'),
    path('api/notificacoes/<int:notificacao_id>/lida/', marcar_notificacao_lida, name='marcar_notificacao_lida'),

    # Rotas de autenticação
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html',
        authentication_form=CustomLoginForm # Adicione esta linha
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # Rotas para testes
    path('base/', base, name='base'),
    path('teste-convite/', TemplateView.as_view(template_name='aceitar_convite.html')),
]

# Server arquivos de mídia em desenvolvimento

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)