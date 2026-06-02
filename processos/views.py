from django.shortcuts import render
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Processo
# Create your views here.
@csrf_exempt
def atualizar_status_processo(request, processo_id):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            novo_status = data.get('status')

            processo = Processo.objects.get(id=processo_id)

            # Atualiza o status
            processo.status = novo_status
            processo.save()

            return JsonResponse({'success': True})
        except Processo.DoesNotExist:
            return JsonResponse({'error': 'Processo não encontrado'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Método não permitido'}, status=405)