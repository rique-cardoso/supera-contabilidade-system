from django.core.management.base import BaseCommand
from notificacoes.services import MotorNotificacoesService

class Command(BaseCommand):
    help = 'Processa as regras de negócio e gera notificações e e-mails (RF25, RF26, RF27)'

    def handle(self, *args, **kwargs):
        self.stdout.write('Iniciando varredura do motor de notificações...')
        
        try:
            MotorNotificacoesService.processar_prazos_diarios()
            MotorNotificacoesService.processar_vistorias()
            
            self.stdout.write(self.style.SUCCESS('Varredura concluída com sucesso. Alertas gerados e e-mails disparados.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro durante a execução: {str(e)}'))