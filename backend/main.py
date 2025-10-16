from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
# AHORA USAMOS IMPORTACIÓN ABSOLUTA EN VEZ DE RELATIVA:
from search_logic import SemanticSearchEngine 
import uvicorn
import sys

# --- MODELOS DE PETICIÓN ---

class SearchRequest(BaseModel):
    """Modelo para la petición de búsqueda híbrida."""
    query: str = Field(..., description="La consulta del usuario.")
    top_k: int = Field(5, description="Número de resultados a devolver (máximo 10).", le=10)

# --- INICIALIZACIÓN ---

app = FastAPI(title="Buscador Semántico Híbrido")

# Configuración de CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000", 
    # Usar "*" si quieres que funcione universalmente en desarrollo, 
    # pero mejor especificar el puerto de Next.js.
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Lo dejamos en * para desarrollo, como en tu código original
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa el motor de búsqueda (ocurre solo una vez al iniciar el servidor)
try:
    search_engine = SemanticSearchEngine()
except Exception as e:
    # Si la inicialización falla (ej. claves Dorks o Qdrant), imprimimos y salimos.
    print(f"Error CRÍTICO al iniciar el motor de búsqueda: {e}", file=sys.stderr)
    print("El servidor NO INICIARÁ. Por favor, revisa tus configuraciones de .env, Qdrant y Redis.", file=sys.stderr)
    search_engine = None 

# --- ENDPOINTS ---

@app.post("/api/search")
async def search_documents(request: SearchRequest):
    """Endpoint principal para la búsqueda híbrida (Semántica + Dorks)."""
    
    if search_engine is None:
        raise HTTPException(status_code=503, detail="El motor de búsqueda no está disponible. Revisar logs del servidor.")
        
    try:
        # Aquí se ejecuta la lógica de Qdrant, BERT, Redis y Google Dorks.
        results = search_engine.search(
            query=request.query, 
            top_k=request.top_k
        )
        
        return {"status": "success", "results": results}
        
    except Exception as e:
        print(f"Error al procesar la búsqueda: {e}")
        raise HTTPException(status_code=500, detail="Error interno al ejecutar la búsqueda.")
