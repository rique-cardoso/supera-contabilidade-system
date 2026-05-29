from django.contrib import admin
from .models import Cliente, Empresa, EnderecoEmpresa
# Register your models here.

class EnderecoEmpresaInline(admin.StackedInline):
    model = EnderecoEmpresa
    extra = 0

class EmpresaInline(admin.TabularInline):
    model = Empresa
    extra = 1

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ['nome_responsavel', 'email', 'cpf', 'data_criacao']
    search_fields = ['nome_responsavel', 'email', 'cpf']
    inlines = [EmpresaInline]

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ['nome_empresa', 'cnpj', 'cliente', 'data_criacao']
    search_fields = ['nome_empresa', 'cnpj']
    inlines = [EnderecoEmpresaInline]

@admin.register(EnderecoEmpresa)
class EnderecoEmpresaAdmin(admin.ModelAdmin):
    list_display = ['empresa', 'cidade', 'estado']