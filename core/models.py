from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

class Usuario(AbstractUser):
    ROLES = (
        ('admin', 'Administrador'),
        ('padrao', 'Usuário Padrão'),
    )

    role = models.CharField(max_length=10, choices=ROLES, default='padrao')