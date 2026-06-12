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
@require_http_methods(["GET"])
def listar_empresas(request):
    """Retorna todas as empresas, o nome do cliente e os dados de endereço associados."""
    # O uso do select_related('endereco') evita múltiplas consultas pesadas ao banco (N+1)
    empresas = Empresa.objects.select_related('cliente', 'endereco').all().order_by('-data_criacao')
    data = []
    for e in empresas:
        # Verifica se a empresa possui um endereço cadastrado na relação OneToOne
        has_endereco = hasattr(e, 'endereco') and e.endereco is not None
        
        data.append({
            'id': e.id,
            'nome_empresa': e.nome_empresa,
            'cnpj': e.cnpj,
            'cnae': e.cnae,
            'cliente_id': e.cliente.id if e.cliente else None,
            'cliente_nome': e.cliente.nome_responsavel if e.cliente else '',
            'data_criacao': e.data_criacao.strftime('%b %d, %Y, %I:%M %p'),
            'endereco': {
                'logradouro': e.endereco.logradouro,
                'numero': e.endereco.numero,
                'complemento': e.endereco.complemento,
                'bairro': e.endereco.bairro,
                'cidade': e.endereco.cidade,
                'estado': e.endereco.estado,
                'cep': e.endereco.cep,
            } if has_endereco else None
        })
    return JsonResponse({'empresas': data})

@login_required
@require_http_methods(["POST", "PUT"])
def salvar_empresa(request, empresa_id=None):
    """Cria ou edita uma Empresa tratando o relacionamento opcional de Endereço."""
    try:
        data = json.loads(request.body)
        
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
        empresa.cnpj = cnpj_str
        empresa.cnae = cnae_str
        empresa.cliente = cliente
        empresa.save()

        # --- PROCESSAMENTO DO ENDEREÇO (OPCIONAL) ---
        endereco_data = data.get('endereco')
        
        if endereco_data:
            # Validação Backend de Segurança para o CEP do endereço
            cep_str = endereco_data.get('cep', '')
            if len(re.sub(r'\D', '', cep_str)) != 8:
                return JsonResponse({'erro': 'O CEP do endereço deve conter exatamente 8 números.'}, status=400)
            
            # Utiliza o método update_or_create para gerenciar o vínculo OneToOne de forma nativa
            from .models import EnderecoEmpresa
            EnderecoEmpresa.objects.update_or_create(
                empresa=empresa,
                defaults={
                    'logradouro': endereco_data.get('logradouro'),
                    'numero': endereco_data.get('numero'),
                    'complemento': endereco_data.get('complemento'),
                    'bairro': endereco_data.get('bairro'),
                    'cidade': endereco_data.get('cidade'),
                    'estado': endereco_data.get('estado'),
                    'cep': cep_str
                }
            )
        else:
            # Se a requisição veio sem endereço e a empresa já existia, removemos qualquer registro antigo
            # Isso possibilita que o usuário apague o endereço de uma empresa na edição se assim desejar
            from .models import EnderecoEmpresa
            EnderecoEmpresa.objects.filter(empresa=empresa).delete()

        return JsonResponse({'id': empresa.id, 'mensagem': 'Empresa salva com sucesso'})
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)