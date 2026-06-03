import sys
import urllib.request
import urllib.parse
import json

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

def test_search():
    query = "latest artificial intelligence breakthroughs today"
    searxng_url = "http://localhost:8080"
    
    print(f"Testing Astra's SearXNG Brain...")
    print(f"Endpoint: {searxng_url}")
    print(f"Query: '{query}'\n")
    
    try:
        encoded_query = urllib.parse.quote(query)
        req = urllib.request.Request(
            f"{searxng_url}/search?q={encoded_query}&format=json",
            headers={'User-Agent': 'Astra/1.0 (Autonomous Agent)'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            
            results = data.get("results", [])[:3]  # Top 3 results
            if not results:
                print("No results found.")
                return
            
            for idx, r in enumerate(results):
                title = r.get("title", "No title").replace('\u200b', '')
                content = r.get("content", "No content").replace('\u200b', '')
                url = r.get("url", "No URL")
                print(f"Result {idx+1}: {title}")
                print(f"Snippet: {content}")
                print(f"URL: {url}\n")
                
    except Exception as e:
        print(f"Error querying SearXNG: {e}")

if __name__ == "__main__":
    test_search()
