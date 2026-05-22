from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.forms import CustomLoginForm
from core.views import home, base

urlpatterns = [
    # Rota admin
    path('admin/', admin.site.urls),
    # Rota raiz (home)
    path('', home, name='home'),
    # Rotas de autenticação
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html',
        authentication_form=CustomLoginForm # Adicione esta linha
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('base/', base, name='base'),
]