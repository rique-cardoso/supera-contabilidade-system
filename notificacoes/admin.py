from django.contrib import admin
from .models import Notificacao
# Register your models here.
@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'categoria', 'processo', 'is_lida', 'data_geracao')
    list_filter = ('categoria', 'is_lida', 'is_enviada_email')
    search_fields = ('titulo', 'mensagem', 'processo__protocolo')
    filter_horizontal = ('usuarios_destinatarios',) # Facilita a seleção de múltiplos usuários