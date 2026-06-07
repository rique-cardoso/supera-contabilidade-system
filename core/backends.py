from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        try:
            # Buscamos o usuário filtrando diretamente pelo campo 'email'
            # (o Django passa o valor do formulário no argumento chamado 'username')
            user = UserModel.objects.get(email=username)
        except UserModel.DoesNotExist:
            return None
        
        # Verifica se a senha está correta e se o usuário está ativo
        if user.check_password(password) and self.user_can_authenticate(user):
            return user