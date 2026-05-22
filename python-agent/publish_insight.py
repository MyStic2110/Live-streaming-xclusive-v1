import json, os, datetime, time
from pathlib import Path

# Payload data (cleaned from user input)
payload = {
    "slug": "rethinking-ai-architectures-agent-execution",
    "title": "Rethinking AI Architectures for Enhanced Agent Execution",
    "subtitle": "Exploring Deep Architectural Innovations in AI Systems",
    "category": "AI & Architecture",
    "excerpt": "This blog delves into the critical architectural transformations needed for AI agents to thrive in complex environments, addressing scalability, flexibility, and execution workflows.",
    "content": "### The Paradigm Shift: Rethinking AI Architectures for Enhanced Agent Execution\n\nTraditional AI systems often struggle with the growing complexity and dynamism of the environments they operate in. **Key Point:** The inflexibility of monolithic architectures and rigid execution flows creates substantial bottlenecks, limiting performance and adaptability. As AI continues its evolution, we must pivot toward architectures that embrace modularity and orchestration, enabling agents to learn and adapt in real time.\n\n### Core Primitives: Key Capabilities for Modern AI Agents\n\nTo adequately support evolving demands, modern AI architectures must incorporate several core primitives:\n- **Microservices:** Each functionality of an AI system should be encapsulated in discrete, independently deployable services that communicate via APIs.\n- **Semantic Routing:** Instead of traditional, hardcoded pathways, AI agents can employ semantic routing to navigate tasks and decision-making processes more efficiently.\n- **Vector Embedding Utilization:** Leveraging vector embeddings for contextual understanding allows agents to perform more nuanced operations based on the semantic similarity of input data.\n\n### Architecture Stack: Layer-by-Layer Technical Breakdown\n\n1. **Data Ingestion Layer:** \n   - Captures relevant data from multiple sources, enabling real-time processing through streaming architectures like Apache Kafka.\n\n2. **Processing Layer:** \n   - Houses the microservices responsible for data analysis, prediction, and decision-making, ensuring scalability and rapid iteration.\n\n3. **Orchestration Layer:** \n   - Coordinates the interaction between microservices, applying state management to maintain context across tasks and sessions.\n\n4. **Execution Layer:** \n   - Contains the execution agents capable of performing tasks in real environments, equipped with adaptive learning mechanisms to refine operations based on feedback.\n\n### Execution Flow: Step-by-Step Lifecycle of the System\n\n1. **Data Collection:** \n   - Real-time data captured through IoT or other data streams.\n\n2. **Initial Processing:** \n   - Data is cleaned, filtered, and transformed as it enters the processing layer.\n\n3. **Task Orchestration:** \n   - Tasks are assigned to appropriate microservices based on requirements and routing logic.\n\n4. **Execution:** \n   - Agents execute tasks, utilizing learned experiences to optimize processes dynamically.\n\n5. **Feedback Loop:** \n   - Continuous learning is reinforced through feedback gathered post-execution, allowing agents to adjust their models and execution strategies effectively.\n\nBy adopting these modern architectural principles, enterprises can overcome significant roadblocks and achieve substantial ROI from their AI initiatives. As AI moves toward a truly agentic paradigm, empowering systems that learn and adapt in real-time will be crucial for future success.",
    "infographicData": "{\"architecture\": {\"layers\": [{\"name\": \"Data Ingestion Layer\", \"components\": [\"Real-time data capture\", \"IoT integration\", \"Streaming architectures\"]}, {\"name\": \"Processing Layer\", \"components\": [\"Microservices\", \"Data analysis\", \"Prediction and decision-making\"]}, {\"name\": \"Orchestration Layer\", \"components\": [\"Task coordination\", \"State management\", \"Context preservation\"]}, {\"name\": \"Execution Layer\", \"components\": [\"Execution agents\", \"Adaptive learning\", \"Real-world task performance\"]}]}}",
    "featuredImage": "",
    "tags": ["AI", "Architecture", "Execution Workflows", "Microservices"],
    "keywords": ["AI agents", "architectural transformations", "execution workflows", "AI systems"],
    "seoTitle": "Rethinking AI Architectures for Enhanced Agent Execution",
    "seoDesc": "Explore the necessity of innovative AI architecture in enhancing agent execution, overcoming traditional limitations with modern design principles."
}

# Paths
def get_root():
    return Path(__file__).parent

tracker_path = get_root() / "agents" / "astra" / "tracker.json"
blogs_dir = get_root() / "agents" / "astra" / "blogs"

# Load tracker
if tracker_path.exists():
    with open(tracker_path, "r") as f:
        tracker = json.load(f)
else:
    tracker = {"current_day": 1, "total_days": 7, "published_slugs": [], "last_published_date": None, "cumulative_usage": {"input_tokens": 0, "output_tokens": 0, "total_cost": 0.0}}

# Check if already published today
today = datetime.datetime.now().strftime("%Y-%m-%d")
if tracker.get("last_published_date") == today:
    print(f"Already published today ({today}), aborting.")
    raise SystemExit(0)

slug = payload["slug"]
# Build post data similar to Astra's publish function
post_id = f"astra-{int(time.time())}"
infographic = json.loads(payload["infographicData"])
post_data = {
    "type": "publish_blog",
    "data": {
        "id": post_id,
        "slug": slug,
        "title": payload["title"],
        "subtitle": payload["subtitle"],
        "category": payload["category"],
        "excerpt": payload["excerpt"],
        "content": payload["content"],
        "infographicData": infographic,
        "featured": True,
        "featuredImage": payload["featuredImage"] or f"/insights/{slug}.png",
        "imageAlt": f"Enterprise visualization for {payload['title']}",
        "date": datetime.datetime.now().isoformat(),
        "readTime": f"{len(payload['content'].split()) // 200 + 1} min read",
        "author": {
            "name": "Astra AI",
            "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=astra",
            "role": "Autonomous Growth Agent"
        },
        "metadata": {
            "seoTitle": payload["seoTitle"],
            "seoDesc": payload["seoDesc"],
            "keywords": payload["keywords"],
            "canonicalUrl": f"/blog/{slug}",
            "tags": payload["tags"]
        },
        "tableOfContents": [line[4:].replace("**", "").replace("*", "").strip() for line in payload["content"].split("\n") if line.startswith("### ")],
        "cta": {
            "title": "Deploy Your Fleet",
            "description": "Transform your enterprise with autonomous intelligence.",
            "buttonText": "Get Started",
            "buttonUrl": "/fleet"
        },
        "analytics": {"views": 0, "shares": 0},
        "status": "published"
    }
}

# Ensure blogs directory exists
blogs_dir.mkdir(parents=True, exist_ok=True)
blog_path = blogs_dir / f"{slug}.json"
with open(blog_path, "w") as f:
    json.dump(post_data["data"], f, indent=4)
print(f"Blog written to {blog_path}")

# Update tracker
tracker.setdefault("published_slugs", []).append(slug)
tracker["last_published_date"] = today
with open(tracker_path, "w") as f:
    json.dump(tracker, f, indent=4)
print("Tracker updated.")
