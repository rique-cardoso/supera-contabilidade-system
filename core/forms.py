# core/forms.py
from django import forms
from django.contrib.auth.forms import AuthenticationForm

class CustomLoginForm(AuthenticationForm):
    username = forms.EmailField(
        label='E-mail',
        widget=forms.EmailInput(attrs={
            'autofocus': True,
            'placeholder': 'E-mail',
            'class': 'input-login input-email' # Você pode adicionar classes do seu global.css
        })
    )

    password = forms.CharField(
        label='Senha',
        strip=False,
        widget=forms.PasswordInput(attrs={
            'autocomplete': 'current-password',
            'placeholder': 'Senha',
            'class': 'input-login input-senha'
        })
    )