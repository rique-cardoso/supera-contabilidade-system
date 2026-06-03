from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.forms import CustomLoginForm
from core.views import (
    gerenciamento_processos,
    criar_processo,
    editar_processo,
    deletar_processo,
    atualizar_status_processo,
    obter_processo,
    apagar_processo,
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

    # API (Consultas e drag-and-drop)
    path('api/processos/<int:processo_id>/status/', atualizar_status_processo, name='atualizar_status_processo'),
    path('api/processos/<int:processo_id>/obter/', obter_processo, name='obter_processo'),

    # Rotas de autenticação
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html',
        authentication_form=CustomLoginForm # Adicione esta linha
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # Rota para testes
    path('base/', base, name='base'),
]