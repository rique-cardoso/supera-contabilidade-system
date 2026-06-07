import re
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
import json
from .models import Cliente, Empresa

@login_required
@require_http_methods(["GET"])
def listar_clientes(request):
    """Retorna todos os clientes e suas respectivas empresas vinculadas."""
    clientes = Cliente.objects.all().prefetch_related('empresas').order_by('-data_criacao')
    data = []
    for c in clientes:
        data.append({
            'id': c.id,
            'nome_responsavel': c.nome_responsavel,
            'email': c.email,
            'cpf': c.cpf,
            'telefone': c.telefone,
            'data_criacao': c.data_criacao.strftime('%b %d, %Y, %I:%M %p'), # Formato igual ao seu Figma
            'empresas': [{'id': e.id, 'nome_empresa': e.nome_empresa} for e in c.empresas.all()]
        })
    return JsonResponse({'clientes': data})

@login_required
@require_http_methods(["GET"])
def listar_empresas(request):
    """Retorna todas as empresas e o nome do cliente associado."""
    empresas = Empresa.objects.select_related('cliente').all().order_by('-data_criacao')
    data = []
    for e in empresas:
        data.append({
            'id': e.id,
            'nome_empresa': e.nome_empresa,
            'cnpj': e.cnpj,
            'cnae': e.cnae,
            'cliente_id': e.cliente.id if e.cliente else None,
            'cliente_nome': e.cliente.nome_responsavel if e.cliente else '',
            'data_criacao': e.data_criacao.strftime('%b %d, %Y, %I:%M %p')
        })
    return JsonResponse({'empresas': data})

@login_required
@require_http_methods(["POST", "PUT"])
def salvar_cliente(request, cliente_id=None):
    try:
        data = json.loads(request.body)
        
        # Validação Backend do CPF
        cpf_str = data.get('cpf', '')
        cpf_numeros = re.sub(r'\D', '', cpf_str) # Extrai apenas os números
        if len(cpf_numeros) != 11:
            return JsonResponse({'erro': 'O CPF deve conter exatamente 11 números.'}, status=400)

        if cliente_id:
            cliente = get_object_or_404(Cliente, id=cliente_id)
        else:
            cliente = Cliente()

        cliente.nome_responsavel = data.get('nome_responsavel')
        cliente.telefone = data.get('telefone')
        cliente.email = data.get('email')
        cliente.cpf = cpf_str # Salva com a máscara perfeitamente formatada
        cliente.save()

        empresas_ids = data.get('empresas', [])
        if empresas_ids:
            Empresa.objects.filter(id__in=empresas_ids).update(cliente=cliente)

        return JsonResponse({'id': cliente.id, 'mensagem': 'Cliente salvo com sucesso'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

@login_required
@require_http_methods(["POST", "PUT"])
def salvar_empresa(request, empresa_id=None):
    try:
        data = json.loads(request.body)
        
        # Validação Backend de CNPJ e CNAE
        cnpj_str = data.get('cnpj', '')
        cnae_str = data.get('cnae', '')
        
        if len(re.sub(r'\D', '', cnpj_str)) != 14:
            return JsonResponse({'erro': 'O CNPJ deve conter exatamente 14 números.'}, status=400)
            
        if len(re.sub(r'\D', '', cnae_str)) != 7:
            return JsonResponse({'erro': 'O CNAE deve conter exatamente 7 números.'}, status=400)

        cliente_id = data.get('cliente_id')
        if not cliente_id:
            return JsonResponse({'erro': 'Vincular a um Cliente é obrigatório'}, status=400)

        cliente = get_object_or_404(Cliente, id=cliente_id)

        if empresa_id:
            empresa = get_object_or_404(Empresa, id=empresa_id)
        else:
            empresa = Empresa()

        empresa.nome_empresa = data.get('nome_empresa')
        empresa.cnpj = cnpj_str # Salva com a máscara
        empresa.cnae = cnae_str # Salva com a máscara
        empresa.cliente = cliente
        empresa.save()

        return JsonResponse({'id': empresa.id, 'mensagem': 'Empresa salva com sucesso'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)