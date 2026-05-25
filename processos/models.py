from django.db import models
from core.models import Usuario
# Create your models here.

class Cliente(models.Model):
    nome_responsavel = models.CharField(max_length=255)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    nome_empresa = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, unique=True)

# ADAPTAR O MODEL DE ACORDO COM A RESPOSTA DA REQUERENTE EM RELAÇÃO À DECISÃO ARQUITETURAL DO SOFTWARE (cpL)