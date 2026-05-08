import os
import asyncio
import json
import aiomysql
from dotenv import load_dotenv

# Load env from current dir (python-agent/.env)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

async def test_connection():
    host = os.getenv("MYSQL_HOST")
    user = os.getenv("MYSQL_USER")
    password = os.getenv("MYSQL_PASSWORD")
    db_name = os.getenv("MYSQL_DB")
    port = int(os.getenv("MYSQL_PORT", 3306))

    print(f"--- ATTEMPTING WARM BOOT: {host} / {db_name} ---")
    
    try:
        # Try general connection first to see DBs
        conn = await aiomysql.connect(
            host=host, user=user, password=password,
            port=port
        )
        print("CONNECTION TO SERVER SUCCESSFUL!")
        
        async with conn.cursor() as cur:
            await cur.execute("SHOW DATABASES")
            dbs = await cur.fetchall()
            print("AVAILABLE DATABASES ON SERVER:")
            for d in dbs:
                print(f"  - {d[0]}")
            
            # Now try specific DB
            print(f"\nTRYING TO USE DATABASE: {db_name}")
            await cur.execute(f"USE {db_name}")
            
            # Get Tables
            await cur.execute("SHOW TABLES")
            tables = await cur.fetchall()
            print(f"FOUND {len(tables)} TABLES IN {db_name}")
            
            schema_cache = {}
            for t_entry in tables:
                t_name = t_entry[0]
                await cur.execute(f"DESCRIBE {t_name}")
                cols = await cur.fetchall()
                schema_cache[t_name] = [c[0] for c in cols]
                print(f"   > Mapped: {t_name} ({len(cols)} columns)")
            
            print("\n--- SCHEMA CACHE PREVIEW ---")
            print(json.dumps(schema_cache, indent=2))
            print("\nWARM BOOT COMPLETE. BRAIN IS READY.")
            
        conn.close()
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_connection())
