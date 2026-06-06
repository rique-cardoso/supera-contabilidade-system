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
        """ Cria fases de documentação geral padrão (RF17) """
        itens_padrao = [
            'Contrato Social',
            'Comprovante de Endereço Atualizado',
            'CNPJ',
            'Contrato de Locação',
            'Certidão de Matrícula',
            'Documento do Responsável',
        ]

        # Criamos cada documento como uma fase direto
        for i, nome in enumerate(itens_padrao):
            FaseProcesso.objects.get_or_create(
                processo=self,
                nome=nome,
                defaults={
                    'is_geral': True, 
                    'ordem': 100 + i, # Garante que fiquem no final
                    'is_concluido': False
                }
            )

    def dias_para_vencer(self):
        """Retorna dias até vencimento (útil para template)"""
        return abs((self.data_vencimento - date.today()).days)

    @property
    def data_vencimento_formatada(self):
        """Formata a data de vencimento para o card Kanban"""
        if not self.data_vencimento:
            return ""
        hoje = date.today()
        vencimento = self.data_vencimento

        # 1. Checar se é hoje ou ontem
        if vencimento == hoje:
            return "hoje"
        elif vencimento == hoje - timedelta(days=1):
            return "ontem"
        elif vencimento == hoje + timedelta(days=1):
            return "amanhã"
        
        # 2. Checar se é muito distante (ano difernete)
        if vencimento.year != hoje.year:
            # Retorna no formato dd/mm/yy (ex: 02/06/27)
            return vencimento.strftime("%d/%m/%y")
        
        # 3. Data no mesmo ano (ex: ter - 02 jun)
        dias_semana = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
        meses = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

        dia_semana_str = dias_semana[vencimento.weekday()]
        dia_str = f"{vencimento.day:02d}" # Garante dois dígitos
        mes_str = meses[vencimento.month]

        return f"{dia_semana_str} - {dia_str} {mes_str}"
    
    def pode_editar(self):
        """Verifica se processo pode ser editado (RF23)"""
        return self.status != 'EXCLUIDO'
        
class FaseProcesso(models.Model):
    """
    Model de Fase - Cada fase atua como um item de checklist direto (RF16, RF19, RF20)
    """
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='fases'
    )

    nome = models.CharField(max_length=255)
    is_geral = models.BooleanField(default=False) # True = documentação geral
    ordem = models.IntegerField(default=0)
    
    # Campos trazidos da antiga ItemChecklist
    is_concluido = models.BooleanField(default=False)
    data_conclusao = models.DateTimeField(null=True, blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fase do Processo"
        verbose_name_plural = "Fases dos Processos"
        ordering = ['processo', 'ordem', 'data_criacao']
        unique_together = [['processo', 'nome']]
    
    def __str__(self):
        return f"{self.processo.protocolo} - {self.nome}"
    
    def save(self, *args, **kwargs):
        """ Rastrear quando a fase foi concluída """
        if self.is_concluido and not self.data_conclusao:
            self.data_conclusao = timezone.now()
        elif not self.is_concluido:
            self.data_conclusao = None
        super().save(*args, **kwargs)

class Anexo(models.Model):
    """
    Model de Anexo - arquivos anexados direto na Fase (RF22)
    """
    EXTENSOES_PERMITIDAS = ['png', 'jpg', 'jpeg', 'pdf']

    # Mudou de item_checklist para fase
    fase = models.ForeignKey(
        FaseProcesso,
        on_delete=models.CASCADE,
        related_name='anexos'
    )

    arquivo = models.FileField(upload_to='anexos/%Y/%m/')
    nome_original = models.CharField(max_length=255, blank=True)
    data_upload = models.DateTimeField(auto_now_add=True)
    tipo_arquivo = models.CharField(max_length=10, blank=True)

    class Meta:
        verbose_name = "Anexo"
        verbose_name_plural = "Anexos"
        ordering = ['-data_upload']
    
    def __str__(self):
        return f"Anexo - {self.fase.nome}"
    
    def save(self, *args, **kwargs):
        if self.arquivo:
            extensao = self.arquivo.name.split('.')[-1].lower()
            if extensao not in self.EXTENSOES_PERMITIDAS:
                raise ValueError(
                    f"Formato '{extensao}' não permitido. Use: {', '.join(self.EXTENSOES_PERMITIDAS)}"
                )
            self.tipo_arquivo = extensao
            self.nome_original = self.arquivo.name
        super().save(*args, **kwargs)
    
class Vistoria(models.Model):
    """
    Model de Vistoria - agendamentos de vistorias (RF13, RF27)
    """
    STATUS_CHOICES = (
        ('AGENDADA', 'Agendada'),
        ('REALIZADA', 'Realizada'),
        ('CANCELADA', 'Cancelada'),
        ('ADIADA', 'Adiada'),
    )

    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='vistorias'
    )

    data_hora = models.DateTimeField()
    local = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='AGENDADA'
    )
    observacoes = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Vistoria"
        verbose_name_plural = "Vistorias"
        ordering = ['-data_hora']
    
    def __str__(self):
        return f"Vistoria - {self.processo.protocolo} ({self.data_hora.strftime('%d/%m/%Y %H:%M')})"
    
class Taxa(models.Model):
    """
    Model de Taxa - taxas associadas ao processo (RF13)
    """
    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='taxas'
    )

    nome = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_paga = models.BooleanField(default=False)
    is_isento = models.BooleanField(default=False)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_pagamento = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Taxa"
        verbose_name_plural = "Taxas"
        ordering = ['-data_criacao']

        # continuar da tabela Taxas
    
    def __str__(self):
        return f"{self.nome} - {self.processo.protocolo}"