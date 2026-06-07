from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import Usuario

# 1. Formulário customizado para a tela de CRIAÇÃO de usuário no Admin
class UsuarioCreationForm(UserCreationForm):
    class Meta:
        model = Usuario
        # Especificamos os campos essenciais pedidos ao cadastrar alguém novo
        fields = ('email', 'username', 'role')

# 2. Formulário customizado para a tela de EDIÇÃO de usuário no Admin
class UsuarioChangeForm(UserChangeForm):
    class Meta:
        model = Usuario
        fields = '__all__'


# 3. O nosso Admin em si
@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    # Avisamos ao Django para usar os formulários que criamos acima
    add_form = UsuarioCreationForm
    form = UsuarioChangeForm
    model = Usuario

    # Como o email é o identificador, priorizamos a busca e exibição por ele
    ordering = ('email',)
    list_display = ('email', 'username', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('email', 'username', 'first_name', 'last_name')

    # --- TELA DE EDIÇÃO DO ADMIN (Quando você clica em um usuário existente) ---
    # Colocamos o e-mail na área principal (Credenciais) 
    # e movemos o username (que agora é só o nome) para Informações Pessoais.
    fieldsets = (
        ('Credenciais', {'fields': ('email', 'password')}),
        ('Informações Pessoais', {'fields': ('username', 'first_name', 'last_name')}),
        ('Informações de Cargo', {'fields': ('role',)}),
        ('Permissões', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Datas Importantes', {'fields': ('last_login', 'date_joined')}),
    )

    # --- TELA DE CRIAÇÃO DO ADMIN (Quando você clica em "Adicionar Usuário") ---
    # Informamos ao Django para exibir os campos da criação e as senhas.
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'role', 'password1', 'password2'),
        }),
    )