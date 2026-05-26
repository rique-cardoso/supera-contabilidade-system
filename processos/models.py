from django.db import models
from core.models import Usuario
from clientes.models import Empresa
# Create your models here.

class Processo(models.Model):
    ORGAOS_CHOICES = (
        ('PREFEITURA', 'Prefeitura'),
        ('BOMBEIROS', 'Bombeiros'),
    )

    STATUS_CHOICES = (
        ('EXCLUIDOS', 'Excluidos'),
        ('ATIVOS', 'Ativos'),
        ('VENCENDO', 'Vencendo'),
        ('VENCIDOS', 'Vencidos'),
        ('CONCLUIDOS', 'Concluidos'),
    )

    protocolo = models.CharField(max_length=100, unique=True)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='processos'
    )
    orgao = models.CharField(max_length=20, choices=ORGAOS_CHOICES)
    categoria = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices = STATUS_CHOICES,
        default='ATIVO'
    )
    licenciamento_ambiental = models.BooleanField(default=False)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_vencimeto = models.DateField()
    responsaveis = models.ManyToManyField(
        Usuario,
        related_name='processos',
        blank=True
    )

    class Meta:
        verbose_name = "Processo"
        verbose_name_plural = "Processos"
        ordering = ['-data_criacao']

    def __str__(self):
        return f"{self.protocolo} - {self.empresa.nome_empresa}"
    
class FaseProcesso(models.Model):
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='fases'
    )

    nome = models.CharField(max_length=255)
    is_geral = models.BooleanField(default=False)
    ordem = models.IntegerField(default=0)

    class Meta:
        verbose_name = "Fase do Processo"
        verbose_name_plural = "Fases dos Processos"
        ordering = ['ordem']
    
    def __str__(self):
        return f"{self.processo.protocolo} - {self.nome}"
    
class ItemChecklist(models.Model):
    fase = models.ForeignKey(
        FaseProcesso,
        on_delete=models.CASCADE,
        related_name='itens'
    )
    
    nome = models.CharField(max_length=255)
    is_concluido = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Item do Checklist"
        verbose_name_plural = "Itens do Checklist"
    
    def __str__(self):
        return self.nome

class Anexo(models.Model):
    item_checklist = models.ForeignKey(
        ItemChecklist,
        on_delete=models.CASCADE,
        related_name='anexos'
    )

    arquivo = models.FileField(upload_to='anexos/')
    data_upload = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Anexo"
        verbose_name_plural = "Anexos"
    
    def __str__(self):
        return f"Anexo - {self.item_checklist.nome}"
    
class Vistoria(models.Model):
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='vistorias'
    )

    data_hora = models.DateTimeField()
    local = models.CharField(max_length=255)
    status = models.CharField(max_length=50)

    class Meta:
        verbose_name = "Vistoria"
        verbose_name_plural = "Vistorias"
        ordering = ['-data_hora']
    
    def __str__(self):
        return f"Vistoria - {self.processo.protocolo}"
    
class Taxa(models.Model):
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='taxas'
    )

    nome = models.CharField(max_length=255)
    is_paga = models.BooleanField(default=False)
    is_isento = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Taxa"
        verbose_name_plural = "Taxas"
    
    def __str__(self):
        return f"{self.nome} - {self.processo.protocolo}"