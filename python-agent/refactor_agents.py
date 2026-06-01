import os
import re

agent_dir = r"d:\Antigravity Workspace\livekit-video-app\python-agent\agents"

# Regex to find:
# if not guard.allow_transcript(event.transcript):
#     return
# Or:
# if not cost_guard.allow_transcript(event.transcript):
#     return

pattern1 = re.compile(r'(if not (?:guard|cost_guard)\.allow_transcript\(.*?\):)\s*return')

for root, _, files in os.walk(agent_dir):
    for f in files:
        if f.endswith(".py") and f != "__init__.py":
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as file:
                content = file.read()
            
            if "allow_transcript" in content:
                # Need to determine what the guard instance is named (guard or cost_guard)
                guard_name = "guard" if "guard.allow_transcript" in content else "cost_guard"
                
                # We also need to determine if ctx is passed as ctx or ctx.room
                # Usually it's ctx.room because the entrypoint signature is async def entrypoint(ctx: JobContext):
                
                new_block = f"\\1\n                if {guard_name}.is_ceiling_exceeded:\n                    asyncio.create_task({guard_name}.disconnect_with_alert(ctx.room))\n                return"
                
                new_content = pattern1.sub(new_block, content)
                
                # We need to make sure asyncio is imported
                if "import asyncio" not in new_content:
                    new_content = "import asyncio\n" + new_content
                
                if new_content != content:
                    with open(path, "w", encoding="utf-8") as file:
                        file.write(new_content)
                    print(f"Patched: {path}")
