import os
import io
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from decouple import config

SCOPES = ['https://www.googleapis.com/auth/drive']

def get_drive_service():
    creds = None
    # Verifica se o arquivo token.json existe
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # Se o token estiver expirado (ele expira a cada 1 hora), ele usa o "refresh_token" para gerar um novo sozinho!
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            
    return build('drive', 'v3', credentials=creds)

def get_or_create_folder(service, folder_name, parent_id):
    """Busca uma pasta pelo nome dentro de um parent_id. Se não achar, cria."""
    query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    items = results.get('files', [])

    if items:
        return items[0].get('id')
    else:
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        return folder.get('id')

def upload_arquivo_estruturado(arquivo_obj, cliente_nome, empresa_nome, protocolo):
    """Cria a árvore de pastas e faz o upload"""
    service = get_drive_service()
    root_id = config('GDRIVE_ROOT_FOLDER_ID')

    # 1. Pasta do Cliente
    cliente_folder_id = get_or_create_folder(service, cliente_nome, root_id)
    
    # 2. Pasta da Empresa
    empresa_folder_id = get_or_create_folder(service, empresa_nome, cliente_folder_id)
    
    # 3. Pasta do Protocolo
    protocolo_folder_id = get_or_create_folder(service, protocolo, empresa_folder_id)

    # 4. Upload do Arquivo
    file_metadata = {
        'name': arquivo_obj.name,
        'parents': [protocolo_folder_id]
    }
    
    media = MediaIoBaseUpload(io.BytesIO(arquivo_obj.read()), mimetype=arquivo_obj.content_type, resumable=True)
    
    uploaded_file = service.files().create(
        body=file_metadata, 
        media_body=media, 
        fields='id, webViewLink'
    ).execute()

    # Como agora você é o dono do arquivo, podemos garantir que qualquer um com o link possa visualizá-lo (útil para abrir o PDF no sistema depois)
    service.permissions().create(
        fileId=uploaded_file.get('id'),
        body={'type': 'anyone', 'role': 'reader'}
    ).execute()

    return uploaded_file.get('webViewLink')