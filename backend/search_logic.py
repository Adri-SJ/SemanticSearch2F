import redis
import json
import numpy as np
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer
from dorks_client import execute_google_dork # Importamos el cliente Dorks
from typing import List, Dict, Any

# --- CONFIGURACIÓN ---
QDRANT_HOST = "127.0.0.1" # Usamos 127.0.0.1 para estabilidad en Docker
QDRANT_PORT = 6333
REDIS_HOST = "127.0.0.1" 
REDIS_PORT = 6379
COLLECTION_NAME = "documentos_tecnicos"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

class SemanticSearchEngine:
    """Clase para manejar la búsqueda semántica, Dorks y cacheo."""
    def __init__(self):
        # 1. Conexión a Redis para Cache
        self.redis_client = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        self.CACHE_TTL = 3600 
        
        try:
            self.redis_client.ping()
            print("Redis:  Conexión exitosa.")
        except Exception as e:
            print(f"Redis:  Error de conexión: {e}. El cache no funcionará.")
            
        # 2. Conexión a Qdrant (NO CARGA EL MODELO AQUI PARA EVITAR FALLOS AL INICIO)
        self.qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        print("Qdrant: Cliente inicializado (La colección se verifica en la búsqueda).")

        # El modelo BERT se carga LENTAMENTE solo una vez en la función search (o aquí si es estable)
        self.model: SentenceTransformer = None

    def _load_model_if_needed(self):
        """Carga el modelo BERT solo la primera vez que se necesita."""
        if self.model is None:
            print("Cargando modelo Sentence Transformer...")
            self.model = SentenceTransformer(EMBEDDING_MODEL)
            print("Modelo Sentence Transformer cargado.")

    def _perform_qdrant_search(self, query_vector: List[float], top_k: int) -> List[Dict[str, Any]]:
        """Busca en Qdrant y formatea resultados semánticos."""
        try:
            # Intentamos buscar, si la colección no existe, esto lanzará un error.
            search_result = self.qdrant_client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=top_k,
                with_payload=True
            )
            
            qdrant_results = []
            for hit in search_result:
                qdrant_results.append({
                    "type": "SEMÁNTICO", # <-- CLAVE: Identificador de fuente
                    "score": hit.score,
                    "title": hit.payload.get("titulo", "Documento sin título"),
                    "url": hit.payload.get("url", "#"),
                    "snippet": hit.payload.get("texto_snippet", "No hay snippet disponible."),
                })
            return qdrant_results
            
        except Exception as e:
            print(f"Advertencia: Fallo en Qdrant (Colección o Conexión): {e}")
            return [] # Devolvemos una lista vacía si Qdrant falla

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Realiza búsqueda híbrida (Semántica + Dorks)."""
        
        normalized_query = query.strip().lower()
        
        # 1. VERIFICACIÓN DE CACHE (Redis)
        cached_result = self.redis_client.get(normalized_query)
        if cached_result:
            print("Redis:  Hit de cache. Devolviendo resultados al instante.")
            return json.loads(cached_result)

        # 2. Lógica Híbrida
        self._load_model_if_needed() # Cargar el modelo si es necesario
        
        # A. Búsqueda Semántica (Qdrant)
        query_vector = self.model.encode(query, convert_to_tensor=False).tolist()
        qdrant_results = self._perform_qdrant_search(query_vector, top_k)
        
        # B. Búsqueda Lexical (Google Dorks)
        #dork_results = execute_google_dork(query, dork_filetype='pdf', num_results=3)
        dork_results = execute_google_dork(query, dork_filetype=None, num_results=10)


        # C. Unificación de Resultados
        final_results = qdrant_results + dork_results
        
        # 3. ALMACENAR EN CACHE (Redis)
        self.redis_client.setex(
            normalized_query, 
            self.CACHE_TTL, 
            json.dumps(final_results)
        )
        return final_results
