from google_auth_oauthlib.flow import InstalledAppFlow

# Escopo de permissão total para o Google Drive
SCOPES = ['https://www.googleapis.com/auth/drive']

def main():
    print("Abrindo o navegador para você fazer login no Google...")
    # Ele vai ler o seu credentials.json e pedir sua autorização
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    creds = flow.run_local_server(port=0)
    
    # Salva a sua autorização em um arquivo token.json
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
        
    print("Sucesso! O arquivo 'token.json' foi gerado na raiz do seu projeto.")

if __name__ == '__main__':
    main()