import json
import math
import os
import logging
import numpy as np
from openai import OpenAI

logger = logging.getLogger("semantic_router")
logger.setLevel(logging.INFO)

class SemanticRouter:
    def __init__(self, map_file="product_map.json"):
        self.raw_data = {}
        self.routes = []
        self.client = OpenAI() # Assumes OPENAI_API_KEY is in environment
        
        file_path = os.path.join(os.path.dirname(__file__), map_file)
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                self.raw_data = json.load(f)
            
            # Extract UI routes from the new structured format
            ui_nav = self.raw_data.get("ui_navigation", {})
            for route_id, info in ui_nav.items():
                self.routes.append({
                    "route": route_id,
                    "description": info.get("description", ""),
                    "keywords": info.get("keywords", [])
                })
            
            logger.info(f"[ROUTER] Loaded {len(self.routes)} navigation hubs from Battle Map.")
        else:
            logger.warning(f"[ROUTER] Product Map not found at {file_path}")
        
        # Precompute vector embeddings for all routes
        self.documents = []
        for r in self.routes:
            # Combine route, description, and keywords for a rich search space
            text = f"{r.get('route', '')}. {r.get('description', '')}. Keywords: {', '.join(r.get('keywords', []))}"
            try:
                response = self.client.embeddings.create(
                    input=text,
                    model="text-embedding-3-small"
                )
                embedding = response.data[0].embedding
                self.documents.append(np.array(embedding))
            except Exception as e:
                logger.error(f"[ROUTER] Error generating embedding for route {r.get('route')}: {e}")
                self.documents.append(np.zeros(1536))

    def _cosine_similarity(self, vec1, vec2):
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return np.dot(vec1, vec2) / (norm1 * norm2)

    def search(self, query: str, threshold=0.45):
        """Returns the best matching route for the user's query."""
        if not query or not self.routes:
            return None
            
        try:
            response = self.client.embeddings.create(
                input=query,
                model="text-embedding-3-small"
            )
            query_vec = np.array(response.data[0].embedding)
        except Exception as e:
            logger.error(f"[ROUTER] Error embedding query '{query}': {e}")
            return None
            
        best_match = None
        highest_score = 0.0
        
        for i, doc_vec in enumerate(self.documents):
            score = self._cosine_similarity(query_vec, doc_vec)
            if score > highest_score:
                highest_score = score
                best_match = self.routes[i]
                
        if highest_score >= threshold:
            logger.info(f"[ROUTER MATCH] Query: '{query}' -> Route: '{best_match['route']}' (Score: {highest_score:.2f})")
            return best_match
            
        logger.info(f"[ROUTER MISS] No relevant route found for query: '{query}'")
        return None
