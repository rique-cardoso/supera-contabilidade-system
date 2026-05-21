from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.forms import CustomLoginForm

urlpatterns = [
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html',
        authentication_form=CustomLoginForm # Adicione esta linha
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
]