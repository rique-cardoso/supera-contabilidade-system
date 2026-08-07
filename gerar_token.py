from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/drive']

def main():
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    
    print("\n=======================================================")
    print("1. Copie o link enorme abaixo e mande para a cliente no chat.")
    print("2. Fique aguardando o terminal processar...\n")
    
    # Ele vai imprimir o link e ficar "escutando" na porta 8080
    creds = flow.run_local_server(port=8080, open_browser=False)
    
    with open('token.json', 'w') as token:
        token.write(creds.to_json())
        
    print("\nSucesso! O arquivo 'token.json' foi gerado na sua máquina!")

if __name__ == '__main__':
    main()