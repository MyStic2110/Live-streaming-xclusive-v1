import json
import math
from collections import Counter
import os
import logging

logger = logging.getLogger("semantic_router")
logger.setLevel(logging.INFO)

class SemanticRouter:
    def __init__(self, map_file="product_map.json"):
        self.raw_data = {}
        self.routes = []
        
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
        
        # Precompute term frequencies for all routes
        self.stop_words = {"the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "with"}
        self.documents = []
        for r in self.routes:
            # Combine route, description, and keywords for a rich search space
            text = f"{r.get('route', '')} {r.get('description', '')} {' '.join(r.get('keywords', []))}".lower()
            tokens = [w for w in text.split() if w not in self.stop_words]
            self.documents.append(Counter(tokens))

    def _cosine_similarity(self, vec1, vec2):
        intersection = set(vec1.keys()) & set(vec2.keys())
        numerator = sum([vec1[x] * vec2[x] for x in intersection])
        
        sum1 = sum([val**2 for val in vec1.values()])
        sum2 = sum([val**2 for val in vec2.values()])
        denominator = math.sqrt(sum1) * math.sqrt(sum2)
        
        if not denominator:
            return 0.0
        else:
            return float(numerator) / denominator

    def search(self, query: str, threshold=0.2):
        """Returns the best matching route for the user's query."""
        if not query or not self.routes:
            return None
            
        # Basic text normalization
        clean_query = ''.join(e for e in query.lower() if e.isalnum() or e.isspace())
        query_tokens = [w for w in clean_query.split() if w not in self.stop_words]
        query_vec = Counter(query_tokens)
        
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
