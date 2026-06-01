from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario
# Register your models here.
@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')

    # Adiciona o campo 'role' no formuláiro de edição do Admin
    fieldsets = UserAdmin.fieldsets + (
        ('Informações de Cargo', {'fields': ('role',)}),
    )

    # Adiciona o campo 'role' na tela de criação de um novo usuário
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informações de Cargo', {'fields': ('role',)}),
    )