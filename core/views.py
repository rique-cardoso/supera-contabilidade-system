from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from datetime import date
from processos.models import Processo, FaseProcesso, Vistoria, Anexo
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
@require_http_methods(["GET"])
def obter_processo_completo(request, processo_id):
    """
    Retorna todos os dados para popular o modal completo.
    Usa select_related/prefetch_related para evitar N+1 queries.
    """

    processo = get_object_or_404(
        Processo.objects.select_related(
            'empresa__cliente', # Empresa e seu Cliente num único JOIN
            'empresa__endereco', # E o Endereço da Empresa
        ).prefetch_related(
            'responsaveis', # M2M: usuários responsáveis
            'fases', # AQUI: Removido o 'fases__itens', pois a Fase agora é o próprio item
            'vistorias', # Vistorias do processo
            'processos_relacionados', # M2M: processos relacionados
        ),
        id=processo_id
    )

    # AQUI: Serializar fases diretamente (achatadas, sem itens filhos)
    fases_data = [
        {
            'id': fase.id,
            'nome': fase.nome,
            'is_geral': fase.is_geral,
            'ordem': fase.ordem,
            'is_concluido': fase.is_concluido,
            'data_conclusao': (
                fase.data_conclusao.strftime('%d/%m/%Y') if fase.data_conclusao else None
            ),
        }
        for fase in processo.fases.order_by('ordem', 'data_criacao')
    ]
    
    # Serializar vistorias
    vistorias_data = [
        {
            'id': v.id,
            'data_hora': v.data_hora.strftime('%d/%m/%Y %H:%M'),
            # Formato para input type="datetime-local" no HTML
            'data_hora_input': v.data_hora.strftime('%Y-%m-%dT%H:%M'),
            'local': v.local,
            'status': v.status,
            'status_display': v.get_status_display(),
            'observacoes': v.observacoes or '',
        }
        for v in processo.vistorias.all()
    ]

    # Serializar responsáveis
    responsaveis_data = [
        {
            'id': u.id,
            'nome': u.get_full_name() or u.username,
        }
        for u in processo.responsaveis.all()
    ]

    # Serializar empresa e cliente
    empresa_data = None
    cliente_data = None
    if processo.empresa:
        empresa = processo.empresa
        empresa_data = {
            'id': empresa.id,
            'nome_empresa': empresa.nome_empresa,
            'cnpj': empresa.cnpj,
            'cnae': empresa.cnae,
            'endereco': None,
        }

        # Endereço é opcional (OneToOne pode não existir)
        try:
            e = empresa.endereco
            empresa_data['endereco'] = {
                'logradouro': e.logradouro,
                'numero': e.numero,
                'complemento': e.complemento or '',
                'bairro': e.bairro,
                'cidade': e.cidade,
                'estado': e.estado,
                'cep': e.cep,
                # Versão resumida para o card (truncar no css)
                'resumo': f"{e.logradouro}, {e.numero} - {e.bairro}",
                # Versão completa para o sub-modal
                'completo': (
                    f"{e.logradouro}, {e.numero}"
                    + (f", {e.complemento}" if e.complemento else '')
                    + f" — {e.bairro}, {e.cidade}/{e.estado} — CEP {e.cep}"
                ),
            }
        except Exception:
            pass # Sem endereço cadastrado

        cliente = empresa.cliente
        cliente_data = {
            'nome_responsavel': cliente.nome_responsavel,
            'cpf': cliente.cpf,
            'telefone': cliente.telefone,
            'email': cliente.email,
        }

    # Serializar processos relacionados
    relacionados_data = [
        {
            'id': p.id,
            'nome': p.nome,
            'protocolo': p.protocolo,
            'status': p.status,
            'status_display': p.get_status_display(),
        }
        for p in processo.processos_relacionados.all()
    ]

    return JsonResponse({
        'id': processo.id, 
        'nome': processo.nome, 
        'protocolo': processo.protocolo, 
        'descricao': processo.descricao or '', 
        'orgao': processo.orgao, 
        'orgao_display': processo.get_orgao_display(), 
        'categoria': processo.categoria, 
        'categoria_display': processo.get_categoria_display(), 
        'status': processo.status, 
        'status_display': processo.get_status_display(), 
        'empresa_id': processo.empresa.id if processo.empresa else '', 
        'data_vencimento': ( 
            processo.data_vencimento.strftime('%Y-%m-%d') if processo.data_vencimento else '' 
        ), 
        'data_vencimento_formatada': processo.data_vencimento_formatada, 
        'fases': fases_data, 
        'vistorias': vistorias_data, 
        'responsaveis': responsaveis_data, 
        'empresa': empresa_data, 
        'cliente': cliente_data, 
        'processos_relacionados': relacionados_data,
    })

# ────────────────────────────────────────────────────────────── 

# FASES PROCESSO 

# ────────────────────────────────────────────────────────────── 
@login_required
@require_http_methods(["POST"])
def toggle_fase_processo(request, fase_id): # Renomeado
    fase = get_object_or_404(FaseProcesso, id=fase_id)
    fase.is_concluido = not fase.is_concluido
    fase.save()

    return JsonResponse({
        'id': fase.id,
        'is_concluido': fase.is_concluido,
        'data_conclusao': fase.data_conclusao.strftime('%d/%m/%Y') if fase.data_conclusao else None
    })

@login_required
@require_http_methods(["POST"])
def criar_fase_personalizada(request, processo_id): # Renomeado, agora recebe o ID do processo
    import json
    processo = get_object_or_404(Processo, id=processo_id)

    try:
        data = json.loads(request.body)
        nome = data.get('nome', '').strip()

        if not nome:
            return JsonResponse({'erro': 'Nome é obrigatório'}, status=400)
        
        # Cria a nova fase direto no processo
        fase = FaseProcesso.objects.create(
            processo=processo, 
            nome=nome, 
            is_geral=False, 
            ordem=99 # Ordem alta para ir pro final da lista
        )

        return JsonResponse({
            'id': fase.id,
            'nome': fase.nome,
            'is_concluido': False,
            'is_geral': fase.is_geral
        }, status=201)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)
    
@login_required
@require_http_methods(["POST"])
def upload_anexo(request, fase_id): # Mudou para fase_id
    fase = get_object_or_404(FaseProcesso, id=fase_id)
    arquivo = request.FILES.get('arquivo')

    if not arquivo:
        return JsonResponse({'erro': 'Nenhum arquivo enviado'}, status=400)
    try:
        anexo = Anexo(fase=fase, arquivo=arquivo) # Atualizado aqui
        anexo.save()

        return JsonResponse({
            'id': anexo.id,
            'nome_original': anexo.nome_original,
            'tipo_arquivo': anexo.tipo_arquivo,
            'url': request.build_absolute_uri(anexo.arquivo.url),
        }, status=201)
    except Exception as e:
         return JsonResponse({'erro': str(e)}, status=400)

# ────────────────────────────────────────────────────────────── 

# VISTORIAS 

# ────────────────────────────────────────────────────────────── 
@login_required
@require_http_methods(["POST"])
def criar_vistoria(request, processo_id):
    """
    Cria uma nova vistoria para o processo.
    Recebe data_hora no formato ISO: '2025-06-05T14:30'
    """
    import json
    from django.utils.dateparse import parse_datetime
    from django.utils.timezone import make_aware

    processo = get_object_or_404(Processo, id=processo_id)

    try:
        data = json.loads(request.body)
        data_hora_str = data.get('data_hora', '').strip()
        local = data.get('local', '').strip()

        if not data_hora_str or not local:
            return JsonResponse(
                {'erro': 'Os campos data/hora e local são obrigatórios'},
                status=400
            )
        
        # parse_datetime converte a string ISO para objeto datetime
        data_hora = parse_datetime(data_hora_str)
        if data_hora is None:
            return JsonResponse({'erro': 'Formato de data/hora inválido'}, status=400)
        
        # make_aware adiciona timezone (necessário pois USE_TZ=True no settings)
        if data_hora.tzinfo is None:
            data_hora = make_aware(data_hora)

        vistoria = Vistoria.objects.create(
            processo=processo,
            data_hora=data_hora,
            local=local,
            observacoes=data.get('observacoes', ''),
        )
        return JsonResponse({
            'id': vistoria.id,
            'data_hora': vistoria.data_hora.strftime('%d/%m/%Y %H:%M'),
            'data_hora_input': vistoria.data_hora.strftime('%Y-%m-%dT%H:%M'),
            'local': vistoria.local,
            'status': vistoria.status,
            'status_display': vistoria.get_status_display(),
        }, status=201)
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)
    
@login_required
@require_http_methods(["PATCH"])
def atualizar_status_vistoria(request, vistoria_id):
    """
    Atualiza apenas o status de uma vistoria (REALIZADA, CANCELADA, ADIADA).
    Usa update_fields=['status'] para não recalcular outros campos.
    """
    import json
    vistoria = get_object_or_404(Vistoria, id=vistoria_id)

    try:
        data = json.loads(request.body)
        novo_status = data.get('status')
        # Validação dinãmica: lê as opções diretamente do model
        status_validos = [s[0] for s in Vistoria.STATUS_CHOICES]
        if novo_status not in status_validos:
            return JsonResponse(
                {'erro': f'Status inválido. Valores aceitos: {status_validos}'},
                status=400
            )
        
        vistoria.status = novo_status
        vistoria.save(update_fields=['status']) # Atualiza só este campo no BD

        return JsonResponse({
            'id': vistoria.id,
            'status': vistoria.status,
            'status_display': vistoria.get_status_display(),
        })
    except json.JSONDecodeError:
        return JsonResponse({'erro': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)

# ────────────────────────────────────────────────────────────── 

# PROCESSOS RELACIONADOS 

# ────────────────────────────────────────────────────────────── 
@login_required
@require_http_methods(["POST"])
def adicionar_processo_relacionado(request, processo_id):
    """
    Vincula outro processo a este via M2M.
    Arelação é assimétrica: vincular A->B não vincula B->A automaticamente.
    """
    import json
    processo = get_object_or_404(Processo, id=processo_id)

    try:
        data = json.loads(request.body)
        relacionado_id = data.get('relacionado_id')
        
        if not relacionado_id:
            return JsonResponse({'erro': 'ID do processo é obrigatório'}, status=400)
        
        if int(relacionado_id) == processo_id:
            return JsonResponse(
                {'erro': 'Um processo não pode ser relacionado a si mesmo'},
                status=400
            )
        
        # Verifica se já está vinculado para evitar duplicata
        if processo.processos_relacionados.filter(id=relacionado_id).exists():
            return JsonResponse({'erro': 'Processo já está vinculado'}, status=400)
        
        relacionado = get_object_or_404(Processo, id=relacionado_id)
        processo.processos_relacionados.add(relacionado)

        return JsonResponse({
            'id': relacionado.id,
            'nome': relacionado.nome,
            'protocolo': relacionado.protocolo,
            'status': relacionado.status,
            'status_display': relacionado.get_status_display(),
        })
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos'}, status=400)
    except Exception as e:
        return JsonResponse({'erro': str(e)}, status=400)
    
@login_required
@require_http_methods(["DELETE"])
def remover_processo_relacionado(request, processo_id, relacionado_id):
    """
    Desvincula um processo relacionado.
    O M2M .remove() é seguro: não lança erro se a relação não existe.
    """

    processo = get_object_or_404(Processo, id=processo_id)
    relacionado = get_object_or_404(Processo, id=relacionado_id)

    processo.processos_relacionados.remove(relacionado)
    
    return JsonResponse({'mensagem': 'Processos desvinculado com sucesso'})

# ────────────────────────────────────────────────────────────── 

# EMPRESA E BUSCA 

# ────────────────────────────────────────────────────────────── 
@login_required
@require_http_methods(["GET"])
def obter_empresa_detalhes(request, empresa_id):
    """
    Retorna empresa + cliente quando o usuário muda a empresa no formulário.
    Chamado dinamicamente para atualizar os cards de Empresa e Cliente.
    """
    from clientes.models import Empresa as EmpresaModel

    empresa = get_object_or_404(
        EmpresaModel.objects.select_related('cliente', 'endereco'),
        id=empresa_id
    )

    data = {
        'id': empresa.id,
        'nome_empresa': empresa.nome_empresa,
        'cnpj': empresa.cnpj,
        'cnae': empresa.cnae,
        'endereco': None,
        'cliente': {
            'nome_responsavel': empresa.cliente.nome_responsavel,
            'cpf': empresa.cliente.cpf,
            'telefone': empresa.cliente.telefone,
            'email': empresa.cliente.email,
        },
    }
    
    try:
        e = empresa.endereco
        data['endereco'] = {
            'resumo': f"{e.logradouro}, {e.numero} - {e.bairro}",
            'completo': (
                f"{e.logradouro}, {e.numero}"
                + (f", {e.complemento}" if e.complemento else '')
                + f"— {e.bairro}, {e.cidade}/{e.estado} — CEP {e.cep}"
            ),
        }
    except Exception:
        pass

    return JsonResponse(data)

@login_required
@require_http_methods(["GET"])
def buscar_processos(request):
    """
    Busca processos por nome ou protocolo para o campo de processos relacionados.
    Parametros GET:
        - q: termo de busca
        - excluir_id: ID do processo atual (para não aparecer na lista)
    Retorna no máximo 15 resultados para performance.
    """
    from django.db.models import Q

    q = request.GET.get('q', '').strip()
    excluir_id = request.GET.get('excluir_id')

    processos = Processo.objects.exclude(status='EXCLUIDO').select_related('empresa')

    if q:
        processos = processos.filter(
            Q(nome__icontains=q) | Q(protocolo__icontains=q)
        )
    processos = processos[:15]
    
    return JsonResponse({
        'processos': [
            {
                'id': p.id,
                'nome': p.nome,
                'protocolo': p.protocolo,
                'status': p.status,
                'empresa': p.empresa.nome_empresa if p.empresa else '',
            }
            for p in processos
        ]
    })


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
            try:
                processo.data_vencimento = date.fromisoformat(data_vencimento_str)
            except ValueError:
                return JsonResponse({'erro': 'Formato de data inválido. Utilize o formato AAAA-MM-DD.'}, status=400)
                
        
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

@login_required
@require_http_methods(["GET"])
def listar_anexos(request, fase_id): # Mudou para fase_id
    fase = get_object_or_404(FaseProcesso, id=fase_id)
    return JsonResponse({
        'item_nome': fase.nome,
        'anexos': [
            {
                'id': a.id,
                'nome_original': a.nome_original,
                'tipo_arquivo': a.tipo_arquivo,
                'url': request.build_absolute_uri(a.arquivo.url),
            }
            for a in fase.anexos.all() # Atualizado
        ]
    })

# Rota teste -> apenas para visualizar o arquivo base.html para desenvolvimento
def base(request):
    return render(request, 'base.html')