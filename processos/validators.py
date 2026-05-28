from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

def validar_extensao_arquivo(value):
    """
    Valida se o arquivo tem extensão permitida (RF22)
    """
    EXTENSOES_PERMITIDAS = ['png', 'jpg', 'jpeg', 'pdf']

    extensao = value.name.split('.')[-1].lower()

    if extensao not in EXTENSOES_PERMITIDAS:
        raise ValidationError(
            _('Formato de arquivo não permitido. Use: PNG, JPG, JPEG ou PDF.'),
            code='extensao_invalida'
        )