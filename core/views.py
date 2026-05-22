from django.shortcuts import render
from django.contrib.auth.decorators import login_required
# Create your views here.

@login_required
def home(request):
    return render(request, 'home.html')

# Rota teste -> apenas para visualizar o arquivo base.html para desenvolvimento
def base(request):
    return render(request, 'base.html')