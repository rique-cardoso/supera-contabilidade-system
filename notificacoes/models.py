from django.db import models
from processos.models import Processo
# Create your models here.

class Notificacao(models.Model):
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='notificacoes'
    )
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()
    categoria = models.CharField(max_length=100)
    data_geracao = models.DateTimeField(auto_now_add=True)
    is_enviada_email = models.BooleanField(default=False)
    is_lida = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"
        ordering = ['-data_geracao']
    
    def __str__(self):
        return self.titulo
