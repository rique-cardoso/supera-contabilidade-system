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
    """Cria ou edita um Cliente e atualiza os vínculos com as Empresas (chips)."""
    try:
        data = json.loads(request.body)
        if cliente_id:
            cliente = get_object_or_404(Cliente, id=cliente_id)
        else:
            cliente = Cliente()

        cliente.nome_responsavel = data.get('nome_responsavel')
        cliente.telefone = data.get('telefone')
        cliente.email = data.get('email')
        cliente.cpf = data.get('cpf')
        cliente.save()

        # Atualiza a relação 1:N (transfere as empresas selecionadas para este cliente)
        empresas_ids = data.get('empresas', [])
        if empresas_ids:
            Empresa.objects.filter(id__in=empresas_ids).update(cliente=cliente)

        return JsonResponse({'id': cliente.id, 'mensagem': 'Cliente salvo com sucesso'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

@login_required
@require_http_methods(["POST", "PUT"])
def salvar_empresa(request, empresa_id=None):
    """Cria ou edita uma Empresa garantindo a obrigatoriedade do Cliente."""
    try:
        data = json.loads(request.body)
        if empresa_id:
            empresa = get_object_or_404(Empresa, id=empresa_id)
        else:
            empresa = Empresa()

        cliente_id = data.get('cliente_id')
        if not cliente_id:
            return JsonResponse({'erro': 'Vincular a um Cliente é obrigatório'}, status=400)

        cliente = get_object_or_404(Cliente, id=cliente_id)

        empresa.nome_empresa = data.get('nome_empresa')
        empresa.cnpj = data.get('cnpj')
        empresa.cnae = data.get('cnae')
        empresa.cliente = cliente
        empresa.save()

        return JsonResponse({'id': empresa.id, 'mensagem': 'Empresa salva com sucesso'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)