from django.db import models
from processos.models import Processo
from core.models import Usuario
# Create your models here.

class Notificacao(models.Model):
    """
    Model de Notificação - alertas e avisos do sistema (RF24-RF28)
    """
    CATEGORIA_CHOICES = (
        ('ALERTA_CRITICO', 'Alerta Crítico'),
        ('ALERTA', 'Alerta'),
        ('ATENÇÃO', 'Atenção'),
        ('AGENDAMENTO', 'Agendamento'),
    )

    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='notificacoes'
    )
    #RF24: Notificações dirigidas aos responsáveis
    usuarios_destinatarios = models.ManyToManyField(
        Usuario,
        related_name='notificacoes_recebidas'
    )

    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()
    categoria = models.CharField(
        max_length=20,
        choices=CATEGORIA_CHOICES
    )

    # Rastreamento
    data_geracao = models.DateTimeField(auto_now_add=True)
    is_enviada_email = models.BooleanField(default=False)
    data_envio_email = models.DateTimeField(null=True, blank=True)
    is_lida = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Notificação"
        verbose_name_plural = "Notificações"
        ordering = ['-data_geracao']
        indexes = [
            models.Index(fields=['categoria', '-data_geracao']),
            models.Index(fields=['is_lida', '-data_geracao']),
        ]
    
    def __str__(self):
        return f"[{self.categoria}] {self.titulo}"
    
    def marcar_como_lida(self):
        """Marca notificação como lida"""
        self.is_lida = True
        self.save(update_fields=['is_lida'])
