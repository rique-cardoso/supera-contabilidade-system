from django.contrib import admin
from .models import Processo, FaseProcesso, ItemChecklist, Anexo, Vistoria, Taxa

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
    list_display = ('nome', 'processo', 'is_geral', 'ordem')
    list_filter = ('is_geral',)
    search_fields = ('nome', 'processo__protocolo')
    ordering = ('processo', 'ordem')

@admin.register(ItemChecklist)
class ItemChecklistAdmin(admin.ModelAdmin):
    list_display = ('nome', 'fase', 'is_concluido', 'data_conclusao')
    list_filter = ('is_concluido',)
    search_fields = ('nome', 'fase__nome', 'fase__processo__protocolo')

@admin.register(Anexo)
class AnexoAdmin(admin.ModelAdmin):
    list_display = ('nome_original', 'item_checklist', 'tipo_arquivo', 'data_upload')
    list_filter = ('tipo_arquivo',)
    search_fields = ('nome_original', 'item_checklist__nome')

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