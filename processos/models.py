from django.db import models
from django.utils import timezone
from datetime import timedelta, date
from core.models import Usuario
from clientes.models import Empresa
# Create your models here.

class Processo(models.Model):
    """
    Model do Processo - entidade central do sistema.
    Mapeia requisitos: RF06-RF15
    """
    ORGAOS_CHOICES = (
        ('PREFEITURA', 'Prefeitura'),
        ('BOMBEIROS', 'Bombeiros'),
    )

    CATEGORIA_CHOICES = (
        ('FUNCIONAMENTO', 'Funcionamento'),
        ('CONSTRUCAO', 'Construção'),
        ('SANITARIO', 'Sanitário'),
    )

    STATUS_CHOICES = (
        ('EXCLUIDO', 'Excluído'),
        ('ATIVO', 'Ativo'),
        ('VENCENDO', 'Vencendo'),
        ('VENCIDO', 'Vencido'),
        ('CONCLUIDO', 'Concluído'),
    )

    # Identificação (RF06)
    protocolo = models.CharField(max_length=100, unique=True)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    
    # Relacionamentos (RF09, RF10)
    empresa = models.ForeignKey(
        Empresa,
        on_delete=models.CASCADE,
        related_name='processos'
    )

    responsaveis = models.ManyToManyField(
        Usuario,
        related_name='processos',
        blank=True
    )

    # Classificação (RF07, RF08)
    orgao = models.CharField(max_length=20, choices=ORGAOS_CHOICES)
    categoria = models.CharField(
        max_length=20,
        choices=CATEGORIA_CHOICES,
        default='FUNCIONAMENTO'
    )

    # Status (RF14)
    status = models.CharField(
        max_length=20,
        choices = STATUS_CHOICES,
        default='ATIVO'
    )

    # Datas (RF06, RF11)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_vencimento = models.DateField()

    # Campos adicionais
    licenciamento_ambiental = models.BooleanField(default=False)
    
    # Relacionamento entre processos (RF12)
    processos_relacionados = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='processos_vinculados',
        blank=True
    )

    # Rastreamento de auditoria
    criado_por = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        related_name='processos_criados'
    )
    data_ultima_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Processo"
        verbose_name_plural = "Processos"
        ordering = ['-data_criacao']
        indexes = [
            models.Index(fields=['status', '-data_vencimento']),
            models.Index(fields=['orgao', 'status']),
        ]

    def __str__(self):
        return f"{self.protocolo} - {self.empresa.nome_empresa}"
    
    def save(self, *args, **kwargs):
        """
        Override save para:
        1. Calcular automaticamente data_vencimento (RF11)
        2. Atualizar status baseado em data de vencimento (RF15)
        3. Criar fases automáticas na primeira criação (RF19, RF20)
        4. Criar checklist geral padrão (RF17)
        """
        # Se é novo processo, calcular data de vencimento
        if not self.pk:
            if self.orgao == 'BOMBEIROS':
                # +1 ano da data de criação (RF11)
                self.data_vencimento = date.today() + timedelta(days=365)
            elif self.orgao == 'PREFEITURA':
                # 31 de dezembro do ano vigente (RF11)
                self.data_vencimento = date(date.today().year, 12, 31)
        
        # Atualizar status automaticamente baseado em data (RF15)
        self._atualizar_status_automatico()

        super().save(*args, **kwargs)

        # Criar fases e checklist geral apenas na primeira criação
        if not self.pk:
            self._criar_fases_automaticas()
            self._criar_checklist_geral()
    def _atualizar_status_automatico(self):
        """
        Atualiza status para VENCENDO (30 dias antes) ou VENCIDO (após data). (RF15)
        """
        if self.status in ['EXCLUIDO', 'CONCLUIDO']:
            return # Não alterar status finais
        
        hoje = date.today()
        dias_para_vencer = (self.data_vencimento - hoje).days

        if dias_para_vencer < 0:
            self.status = 'VENCIDO'
        elif dias_para_vencer <= 30:
            self.status = 'VENCENDO'
        elif self.status == 'VENCIDO' or self.status == 'VENCENDO':
            self.status = 'ATIVO' # Reativa processo em caso de renovação ou regularização.
    
    def _criar_fases_automaticas(self):
        """
        Cria fases pré-cadastradas conforme órgão (RF19, RF20)
        """
        if self.orgao == 'PREFEITURA':
            nomes_fases = [
                ('Taxa de Licenciamento', 1),
                ('Juntada de Documentos', 2),
                ('Meio Ambiente', 3),
                ('Vigilância Sanitária', 4),
                ('Projeto Arquitetônico', 5),
                ('Emissão Efetiva do Alvará de Funcionamento', 6),
            ]
        elif self.orgao == 'BOMBEIROS':
            nomes_fases = [
                ('Projeto Segurança Contra Incêndios', 1),
                ('Processo de Licenciamento', 2),
                ('Boleto da Taxa', 3),
                ('Emissão de Certificado', 4),
            ]
        else:
            return
        
        for nome, ordem in nomes_fases:
            FaseProcesso.objects.create(
                processo=self,
                nome=nome,
                ordem=ordem,
                is_geral=False
            )
    
    def _criar_checklist_geral(self):
        """
        Cria checklist geral padrão com itens obrigatórios (RF17)
        """
        # Criar ou obter a fase geral
        fase_geral, created = FaseProcesso.objects.get_or_create(
            processo=self,
            is_geral=True,
            defaults={'nome': 'Documentação Geral', 'ordem': 0}
        )

        # Itens padrão (RF17)
        itens_padrao = [
            'Contrato Social',
            'Comprovante de Endereço Atualizado',
            'CNPJ',
            'Contrato de Locação',
            'Certidão de Matrícula',
            'Documento do Responsável',
        ]

        for nome in itens_padrao:
            ItemChecklist.objects.get_or_create(
                fase=fase_geral,
                nome=nome,
                defaults={'is_concluido': False}
            )

    def dias_para_vencer(self):
        """Retorna dias até vencimento (útil para template)"""
        return (self.data_vencimento - date.today()).days
    
    def pode_editar(self):
        """Verifica se processo pode ser editado (RF23)"""
        return self.status != 'EXCLUIDO'
    
# Continuar com a FaseProcesso e revisar Processo e suas funções
    
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