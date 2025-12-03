import os
import requests
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Usamos GOOGLE_API_KEY y SEARCH_ENGINE_ID (CX) como en tu código original
API_KEY = os.environ.get("GOOGLE_API_KEY") 
CX_ID = os.environ.get("GOOGLE_CX") or os.environ.get("SEARCH_ENGINE_ID")

if not API_KEY or not CX_ID:
    # Este error se lanzará si falta la clave, previniendo el inicio del servidor
    # si las claves no existen, pero lo manejamos de forma segura en search_logic.py
    raise ValueError(
        "ERROR: Las claves GOOGLE_API_KEY y/o GOOGLE_CX no están configuradas en el archivo .env. "
        "La búsqueda Dorks no podrá ejecutarse."
    )

def execute_google_dork(query: str, dork_filetype: str | None = None, num_results: int = 5) -> list[dict]:
    """
    Ejecuta una consulta Dork usando la API de Google Custom Search.
    Permite especificar opcionalmente un tipo de archivo y el número de resultados.
    """
    url = "https://www.googleapis.com/customsearch/v1"
    
    # 1. Construir la consulta Dork: se agrega filetype solo si se especifica.
    full_query = f"{query} filetype:{dork_filetype}" if dork_filetype else query

    params = {
        "key": API_KEY,
        "cx": CX_ID,
        "q": full_query,
        "num": num_results,
        "hl": "es" # Hardcodeamos a español como en tu route.js
    }
    
    print(f"Buscando Dork: {full_query}")
    
    try:
        response = requests.get(url, params=params).json()

        dork_results = []
        if "items" in response:
            for item in response["items"]:
                dork_results.append({
                    "type": "LEXICAL/DORK", # <-- CLAVE: Identificamos la fuente
                    "score": 0.0,            # El score es 0.0 o un valor bajo para Dorks
                    "title": item["title"],
                    "url": item["link"],
                    "snippet": item.get("snippet", "Sin descripción.")
                })

        return dork_results

    except Exception as e:
        print(f"Error al ejecutar la búsqueda Dork: {e}")
        return []

if __name__ == '__main__':
    # Esta prueba solo funcionará si tienes el archivo .env configurado correctamente
    test_query = "protocolo BGP avanzado"
    dork_results = execute_google_dork(test_query)
    
    if dork_results:
        print(f"\n--- Resultados Dorks para '{test_query}' ---")
        for i, res in enumerate(dork_results):
            print(f"{i+1}. Título: {res['title']}")
