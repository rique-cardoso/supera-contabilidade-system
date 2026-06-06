from django.contrib import admin
from .models import Processo, FaseProcesso, Anexo, Vistoria, Taxa

@admin.register(Processo)
class ProcessoAdmin(admin.ModelAdmin):
    list_display = ('protocolo', 'nome', 'empresa', 'orgao', 'status', 'data_vencimento')
    list_filter = ('orgao', 'categoria', 'status', 'licenciamento_ambiental')
    search_fields = ('protocolo', 'nome', 'empresa__nome_empresa')
    filter_horizontal = ('responsaveis', 'processos_relacionados')

    # Nota: O status é sobrescrito no seu método save(),
    # mas mantê-lo editável aqui é bom para forçar cenários de teste (ex: VENCIDO).

@admin.register(FaseProcesso)
class FaseProcessoAdmin(admin.ModelAdmin):
    # Adicionamos 'is_concluido' para visualizar rapidamente pelo painel
    list_display = ('nome', 'processo', 'is_geral', 'is_concluido', 'ordem')
    
    # Agora podemos filtrar também por fases concluídas ou não concluídas
    list_filter = ('is_geral', 'is_concluido')
    search_fields = ('nome', 'processo__protocolo')
    ordering = ('processo', 'ordem', 'data_criacao')
    
    # Impede que as datas de rastreamento automáticas sejam editadas manualmente
    readonly_fields = ('data_conclusao', 'data_criacao')

@admin.register(Anexo)
class AnexoAdmin(admin.ModelAdmin):
    # Atualizado de 'item_checklist' para 'fase'
    list_display = ('nome_original', 'fase', 'tipo_arquivo', 'data_upload')
    list_filter = ('tipo_arquivo',)
    
    # Atualizado para buscar pelo nome da fase e também pelo protocolo do processo
    search_fields = ('nome_original', 'fase__nome', 'fase__processo__protocolo')

@admin.register(Vistoria)
class VistoriaAdmin(admin.ModelAdmin):
    list_display = ('processo', 'data_hora', 'local', 'status')
    list_filter = ('status',)
    search_fields = ('processo__protocolo', 'local')

@admin.register(Taxa)
class TaxaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'processo', 'valor', 'is_paga', 'is_isento')
    list_filter = ('is_paga', 'is_isento')
    search_fields = ('nome', 'processo__protocolo')