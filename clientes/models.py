from django.db import models

# Create your models here.
class Cliente(models.Model):
    nome_responsavel = models.CharField(max_length=100)
    telefone = models.CharField(max_length=20)
    email = models.EmailField()
    cpf = models.CharField(max_length=14, unique=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ['-data_criacao']
    
    def __str__(self):
        return self.nome_responsavel
    
class Empresa(models.Model):
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='empresas'
    )

    nome_empresa = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, unique=True)
    cnae = models.CharField(max_length=10)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ['-data_criacao']
    
    def __str__(self):
        return self.nome_empresa

class EnderecoEmpresa(models.Model):
    empresa = models.OneToOneField(
        Empresa,
        on_delete=models.CASCADE,
        related_name='endereco'
    )

    logradouro = models.CharField(max_length=255)
    numero = models.CharField(max_length=10)
    complemento = models.CharField(max_length=100, blank=True, null=True)
    bairro = models.CharField(max_length=100)
    cidade = models.CharField(max_length=100)
    estado = models.CharField(max_length=2)
    cep = models.CharField(max_length=9)

    class Meta:
        verbose_name = "Endereço da Empresa"
        verbose_name_plural = "Endreços das Empresas"
    
    def __str__(self):
        return f"{self.logradouro}, {self.numero}, {self.cidade}"