import requests
import json

url = "http://127.0.0.1:3002/talk-to-ai"
data = {"agentType": "lina"}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
