from datetime import date, timedelta
from django.utils import timezone
from processos.models import Processo, Vistoria, FaseProcesso
from notificacoes.models import Notificacao
from django.core.mail import send_mass_mail
from django.conf import settings

class MotorNotificacoesService:
    
    @staticmethod
    def processar_prazos_diarios():
        """
        Função principal a ser rodada diariamente.
        Avalia RF25 (Alertas de Prazo) e RF26 (Alertas Críticos).
        """
        hoje = date.today()
        # Filtramos apenas processos que ainda importam
        processos_ativos = Processo.objects.exclude(status__in=['EXCLUIDO', 'CONCLUIDO'])

        for processo in processos_ativos:
            dias_restantes = (processo.data_vencimento - hoje).days

            # RF26 - Alerta Crítico (Vencido) - Notificação Diária
            if dias_restantes < 0:
                MotorNotificacoesService._gerar_notificacao(
                    processo=processo,
                    categoria='ALERTA_CRITICO',
                    titulo=f"URGENTE: Processo {processo.protocolo} VENCIDO",
                    mensagem=f"O processo da empresa {processo.empresa.nome_empresa} venceu há {abs(dias_restantes)} dias. Ação imediata necessária."
                )

            # RF25 - Alerta (Prazos Padrão: 30, 20 dias, e diariamente nos últimos 10)
            elif dias_restantes <= 30:
                if dias_restantes <= 10 or dias_restantes % 10 == 0:
                    MotorNotificacoesService._gerar_notificacao(
                        processo=processo,
                        categoria='ALERTA',
                        titulo=f"Aviso de Vencimento: {dias_restantes} dias",
                        mensagem=f"O processo {processo.protocolo} vencerá em {dias_restantes} dias ({processo.data_vencimento.strftime('%d/%m/%Y')})."
                    )
            
            # Sub-regra RF25 - Documentos Pendentes no Checklist
            MotorNotificacoesService._verificar_pendencias_checklist(processo, dias_restantes)

    @staticmethod
    def processar_vistorias():
        """
        Avalia RF27 (Agendamentos de Vistoria).
        Pode rodar várias vezes ao dia.
        """
        agora = timezone.now()
        vistorias = Vistoria.objects.filter(status='AGENDADA')

        for vistoria in vistorias:
            diferenca = vistoria.data_hora - agora
            dias = diferenca.days
            horas = diferenca.total_seconds() // 3600

            # 1 semana antes
            if dias == 7:
                MotorNotificacoesService._gerar_notificacao(vistoria.processo, 'AGENDAMENTO', "Vistoria em 1 Semana", f"Vistoria agendada para {vistoria.data_hora.strftime('%d/%m às %H:%M')}.")
            # 3 dias antes
            elif dias == 3:
                MotorNotificacoesService._gerar_notificacao(vistoria.processo, 'AGENDAMENTO', "Vistoria em 3 Dias", f"Atenção: Vistoria se aproximando no local {vistoria.local}.")
            # No momento (janela de 1 hora antes)
            elif 0 <= horas <= 1:
                MotorNotificacoesService._gerar_notificacao(vistoria.processo, 'AGENDAMENTO', "Vistoria Iniciando", f"A vistoria do processo {vistoria.processo.protocolo} iniciará em instantes.")

    @staticmethod
    def gerar_alerta_atencao(processo, acao_pendente):
        """
        RF28 - Disparado pontualmente por ações de usuários na Interface.
        """
        MotorNotificacoesService._gerar_notificacao(
            processo=processo,
            categoria='ATENÇÃO',
            titulo="Ação Manual Necessária",
            mensagem=f"O processo {processo.protocolo} está pendente da seguinte ação: {acao_pendente}."
        )

    # --- MÉTODOS INTERNOS ---

    @staticmethod
    def _verificar_pendencias_checklist(processo, dias_restantes_processo):
        """ Verifica se há fases/documentos faltando quando o prazo aperta """
        fases_pendentes = FaseProcesso.objects.filter(processo=processo, is_concluido=False)
        if fases_pendentes.exists() and dias_restantes_processo <= 30:
            if dias_restantes_processo <= 10 or dias_restantes_processo % 10 == 0:
                nomes_fases = ", ".join([f.nome for f in fases_pendentes])
                MotorNotificacoesService._gerar_notificacao(
                    processo=processo,
                    categoria='ALERTA',
                    titulo=f"Documentação Pendente ({dias_restantes_processo} dias)",
                    mensagem=f"Faltam os seguintes itens no checklist: {nomes_fases}."
                )

    @staticmethod
    def _gerar_notificacao(processo, categoria, titulo, mensagem):
        """ 
        Garante a idempotência (não cria duas notificações iguais no mesmo dia) 
        e vincula os destinatários corretamente (RF24).
        """
        hoje = timezone.now().date()
        
        # Evita duplicação diária
        existe = Notificacao.objects.filter(
            processo=processo,
            titulo=titulo,
            data_geracao__date=hoje
        ).exists()

        if not existe:
            notificacao = Notificacao.objects.create(
                processo=processo,
                categoria=categoria,
                titulo=titulo,
                mensagem=mensagem
            )
            
            # RF24: Destinatários são APENAS os responsáveis pelo processo
            responsaveis = processo.responsaveis.all()
            if responsaveis.exists():
                notificacao.usuarios_destinatarios.set(responsaveis)
                MotorNotificacoesService._disparar_emails([notificacao])

    @staticmethod
    def _disparar_emails(notificacoes):
        """ Despacha os e-mails e marca is_enviada_email = True """
        mensagens_email = []
        notificacoes_enviadas = []

        for notif in notificacoes:
            emails_destinos = list(notif.usuarios_destinatarios.values_list('email', flat=True))
            if emails_destinos:
                email_tuple = (
                    f"[Supera] {notif.titulo}",
                    notif.mensagem,
                    settings.DEFAULT_FROM_EMAIL,
                    emails_destinos
                )
                mensagens_email.append(email_tuple)
                notificacoes_enviadas.append(notif)

        if mensagens_email:
            try:
                send_mass_mail(tuple(mensagens_email), fail_silently=False)
                # Atualiza o banco após envio bem sucedido
                agora = timezone.now()
                for notif in notificacoes_enviadas:
                    notif.is_enviada_email = True
                    notif.data_envio_email = agora
                Notificacao.objects.bulk_update(notificacoes_enviadas, ['is_enviada_email', 'data_envio_email'])
            except Exception as e:
                print(f"Erro ao disparar emails: {str(e)}")