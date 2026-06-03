from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from datetime import date
from processos.models import Processo
from clientes.models import Empresa
from core.models import Usuario
# Create your views here.

@login_required
def gerenciamento_processos(request):
    """
    View principal para o Kanban de processos
    Organiza processos por status para exibição
    """

    # Buscar todas as empresas para o formulário
    empresas = Empresa.objects.select_related('cliente').all()
    usuarios = Usuario.objects.filter(is_active=True)

    # Buscar processos agrupados por status
    processos_excluidos = Processo.objects.filter(status='EXCLUIDO').select_related('empresa__cliente')
    processos_ativos = Processo.objects.filter(status='ATIVO').select_related('empresa__cliente')
    processos_vencendo = Processo.objects.filter(status='VENCENDO').select_related('empresa__cliente')
    processos_vencidos = Processo.objects.filter(status='VENCIDO').select_related('empresa__cliente')
    processos_concluidos = Processo.objects.filter(status='CONCLUIDO').select_related('empresa__cliente')

    # Aplicar filtros (opcional)
    orgao = request.GET.get('orgao')
    if orgao:
        processos_excluidos = processos_excluidos.filter(orgao=orgao)
        processos_ativos = processos_ativos.filter(orgao=orgao)
        processos_vencendo = processos_vencendo.filter(orgao=orgao)
        processos_vencidos = processos_vencidos.filter(orgao=orgao)
        processos_concluidos = processos_concluidos.filter(orgao=orgao)
    
    context = {
        'processos_excluidos': processos_excluidos,
        'processos_ativos': processos_ativos,
        'processos_vencendo': processos_vencendo,
        'processos_vencidos': processos_vencidos,
        'processos_concluidos': processos_concluidos,
        'empresas': empresas,
        'usuarios': usuarios,
    }

    return render(request, 'gerenciamento_processos.html', context)

@login_required
@require_http_methods(["POST"])
def criar_processo(request):
    """
    Cria um novo processo
    """
    try:
        protocolo = request.POST.get('protocolo')
        nome = request.POST.get('nome')
        orgao = request.POST.get('orgao')
        categoria = request.POST.get('categoria')
        empresa_id = request.POST.get('empresa')
        descricao = request.POST.get('descricao', '')

        empresa = Empresa.objects.get(id=empresa_id)

        # Criar processo (save() irá calcular data_vencimento automaticamente)
        processo = Processo.objects.create(
            protocolo=protocolo,
            nome=nome,
            orgao=orgao,
            categoria=categoria,
            empresa=empresa,
            descricao=descricao,
            criado_por=request.user
        )

        # Adicionar responsáveis
        responsaveis_ids = request.POST.getlist('responsaveis')
        if responsaveis_ids:
            processo.responsaveis.set(responsaveis_ids)
        
        return redirect('gerenciamento_processos')
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

@login_required
@require_http_methods(["POST"])
def editar_processo(request, processo_id):
    """
    Edita um processo existente
    """
    processo = get_object_or_404(Processo, id=processo_id)

    if not processo.pode_editar():
        return JsonResponse({'erro': 'Processo excluído não pode ser editado'}, status=403)
    
    try:
        processo.nome = request.POST.get('nome', processo.nome)
        processo.protocolo = request.POST.get('protocolo', processo.protocolo)
        processo.orgao = request.POST.get('orgao', processo.orgao)
        processo.categoria = request.POST.get('categoria', processo.categoria)
        processo.descricao = request.POST.get('descricao', processo.descricao)

        # Permitir edição de data de vencimento (RF11)
        data_vencimento_str = request.POST.get('data_vencimento')
        if data_vencimento_str:
            processo.data_vencimento = data_vencimento_str
        
        empresa_id = request.POST.get('empresa')
        if empresa_id:
            processo.empresa = get_object_or_404(Empresa, id=empresa_id)
        
        processo.save()

        # Atualizar responsáveis
        responsaveis_ids = request.POST.getlist('responsaveis')
        if responsaveis_ids:
            processo.responsaveis.set(responsaveis_ids)
        
        return redirect('gerenciamento_processos')
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

# 1. SOFT DELETE (apenas altera o status)
@login_required
@require_http_methods(["DELETE"])
def deletar_processo(request, processo_id):
    """
    Deleta um processo (marca como EXCLUIDO, não remove do BD)
    """

    processo = get_object_or_404(Processo, id=processo_id)

    # Marcar como excluído em vez de deletar
    processo.status = 'EXCLUIDO'
    processo.save()

    return JsonResponse({'mensagem': 'Processo excluído com sucesso'})

# 2. HARD DELETE (exclui o processo do BD)
@login_required
@require_http_methods(["DELETE"])
def apagar_processo(request, processo_id):
    """Apaga definitivamente do BD. Exclusivo para admins"""
    # Proteção extra no backend
    if request.user.role != 'admin':
        return JsonResponse({'erro': 'Sem permissão para apagar processos.'}, status=403)
    
    processo = get_object_or_404(Processo, id=processo_id)
    processo.delete() # Remove de fato a linha da tabela
    return JsonResponse({'mensagem': 'Processo apagado permanentemente do banco de dados.'})

@login_required
@require_http_methods(["GET"])
def obter_processo(request, processo_id):
    """Retorna os dados do processo em JSON para popular o Modal de edição"""
    processo = get_object_or_404(Processo, id=processo_id)

    data = {
        'id': processo.id,
        'nome': processo.nome,
        'protocolo': processo.protocolo,
        'descricao': processo.descricao,
        'orgao': processo.orgao,
        'categoria': processo.categoria,
        'status': processo.status,
        'empresa_id': processo.empresa.id if processo.empresa else '',
        'data_vencimento': processo.data_vencimento.strftime('%Y-%m-%d') if processo.data_vencimento else '',
    }

    return JsonResponse(data)

@login_required
@require_http_methods(["PATCH"])
def atualizar_status_processo(request, processo_id):
    """
    API para atualizar status via drag-and-drop
    """
    import json

    processo = get_object_or_404(Processo, id=processo_id)

    try:
        data = json.loads(request.body)
        novo_status = data.get('status')

        if novo_status not in dict(Processo.STATUS_CHOICES):
            return JsonResponse({'erro': 'Status inválido'}, status=400)
        
        processo.status = novo_status
        processo.save()

        return JsonResponse({
            'id': processo.id,
            'status': processo.status,
            'mensagem': 'Status atualizado com sucesso'
        })
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

# Rota teste -> apenas para visualizar o arquivo base.html para desenvolvimento
def base(request):
    return render(request, 'base.html')