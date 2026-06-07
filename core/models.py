from django.db import models
from django.contrib.auth.models import AbstractUser

class Usuario(AbstractUser):
    # O e-mail precisa ser único no banco
    email = models.EmailField(unique=True)
    
    # O username (que usaremos como nome) não precisa ser único
    username = models.CharField(max_length=150, unique=False, blank=True, null=True)

    # 1. Avisamos ao Django que o identificador único de login agora é o e-mail
    USERNAME_FIELD = 'email'
    
    # 2. Campos extras exigidos ao criar um usuário pelo terminal (createsuperuser)
    # Obs: O campo definido no USERNAME_FIELD e o password já são pedidos por padrão, 
    # então colocamos o 'username' aqui para garantir que o nome seja preenchido.
    REQUIRED_FIELDS = ['username']

    ROLES = (
        ('admin', 'Administrador'),
        ('padrao', 'Usuário Padrão'),
    )

    role = models.CharField(max_length=10, choices=ROLES, default='padrao')