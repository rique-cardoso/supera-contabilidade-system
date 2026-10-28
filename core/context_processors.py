from django.conf import settings


def ambiente(request):
    return {
        'IS_STAGING': settings.ENVIRONMENT in ('STAGING', 'STATING'),
    }
