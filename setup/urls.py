from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.forms import CustomLoginForm
from django.conf import settings
from django.conf.urls.static import static
from core.views import (
    gerenciamento_processos,
    criar_processo,
    editar_processo,
    deletar_processo,
    atualizar_status_processo,
    obter_processo,
    apagar_processo,
    obter_processo_completo,
    toggle_item_checklist,
    criar_item_checklist,
    upload_anexo,
    criar_vistoria,
    atualizar_status_vistoria,
    adicionar_processo_relacionado,
    remover_processo_relacionado,
    obter_empresa_detalhes,
    buscar_processos,
    listar_anexos,
    base
)

urlpatterns = [
    # Rota admin
    path('admin/', admin.site.urls),

    # Rota raiz (home)
    path('', gerenciamento_processos, name='gerenciamento_processos'),

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

    # API: Checklist
    path('api/fases/<int:fase_id>/itens/criar/', criar_item_checklist, name='criar_item_checklist'),
    path('api/itens/<int:item_id>/toggle/', toggle_item_checklist, name='toggle_item_checklist'),
    path('api/itens/<int:item_id>/anexos/', upload_anexo, name='upload_anexo'),

    # API: Empresa
    path('api/empresas/<int:empresa_id>/detalhes/', obter_empresa_detalhes, name='obter_empresa_detalhes'),

    # API: Anexos
    path('api/itens/<int:item_id>/listar-anexos/', listar_anexos, name='listar_anexos'),

    # Rotas de autenticação
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html',
        authentication_form=CustomLoginForm # Adicione esta linha
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # Rota para testes
    path('base/', base, name='base'),
]

# Server arquivos de mídia em desenvolvimento

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)