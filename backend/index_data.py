import os
import uuid
import PyPDF2
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient, models

#--- CONFIGURACIÓN ---
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
COLLECTION_NAME = "documentos tecnicos"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384

#--- INICIALIZACIÓN ---
client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
model = SentenceTransformer(EMBEDDING_MODEL)

# --- FUNCIÓN DE EXTRACCIÓN Y PROCESAMIENTO ---

def extract_and_process_document(file_path):
    """Simula la extracción de contenido y metadatos de un PDF."""
    
    # 1. Extracción con PyPDF2 (para PDFs sin imágenes)
    text = ""
    metatags = {}
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            
            # 1a. Extraer metadatos (simulando "metatags")
            if reader.metadata:
                metatags = {k: str(v) for k, v in reader.metadata.items()}
            
            # 1b. Extraer texto
            for page in reader.pages:
                text += page.extract_text() or "" # Manejo de páginas vacías
                
    except Exception as e:
        print(f"Error al leer el PDF {file_path}: {e}")
        return None

    # Reducir el texto a un snippet para el embedding si es muy largo
    # En un entorno real, segmentarías el texto. Aquí tomamos un prefijo.
    text_snippet = text[:5000] 

    # 2. Generar Embedding
    # Usamos el snippet/texto principal para la vectorización
    vector = model.encode(text_snippet, convert_to_tensor=False).tolist()

    # 3. Crear Payload (Metadatos)
    payload = {
        "url": f"http://docs.ejemplo.com/{os.path.basename(file_path)}", # URL ficticia
        "titulo": metatags.get('/Title', f"Documento: {os.path.basename(file_path)}"),
        "texto_snippet": text_snippet[:300] + "...",
        "metatags": metatags # Metatags extraídos
    }

    return models.PointStruct(
        id=str(uuid.uuid4()), # Genera un ID único para Qdrant
        vector=vector,
        payload=payload
    )

# --- FUNCIÓN DE INDEXACIÓN PRINCIPAL ---

def index_data(pdf_folder="data/pdfs"):
    """Crea la colección e indexa todos los PDFs."""
    
    # Crea la colección si no existe
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
    )
    print(f"Colección '{COLLECTION_NAME}' lista en Qdrant.")

    points = []
    
    # Asegúrate de que tu carpeta de PDFs exista (ej: data/pdfs/doc1.pdf)
    if not os.path.exists(pdf_folder):
        print(f"ERROR: No se encontró la carpeta de PDFs: {pdf_folder}. ¡Crea algunos PDFs de prueba!")
        return

    for filename in os.listdir(pdf_folder):
        if filename.endswith(".pdf"):
            file_path = os.path.join(pdf_folder, filename)
            point = extract_and_process_document(file_path)
            if point:
                points.append(point)

    # Subida de puntos a Qdrant
    if points:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
            wait=True
        )
        print(f"✅ Indexación completada: {len(points)} documentos subidos a Qdrant.")

if __name__ == '__main__':
    # Asegúrate de crear una carpeta 'data/pdfs' y poner documentos dentro
    # Por ejemplo, puedes crear un archivo vacío para la prueba:
    # touch data/pdfs/manual_tecnico_A.pdf
    index_data()