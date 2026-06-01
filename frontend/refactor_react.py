import os
import re

components_dir = r"d:\Antigravity Workspace\livekit-video-app\frontend\src\components"

for f in os.listdir(components_dir):
    if f.endswith("Room.jsx"):
        path = os.path.join(components_dir, f)
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            
        if "<LiveKitRoom" in content and "CostGuardAlert" not in content:
            # 1. Add import statement at the top (after other imports)
            import_statement = "import CostGuardAlert from \"./CostGuardAlert\";\n"
            
            # Find the last import statement to append it after
            last_import_idx = content.rfind("import ")
            if last_import_idx != -1:
                end_of_line = content.find("\n", last_import_idx)
                content = content[:end_of_line+1] + import_statement + content[end_of_line+1:]
            else:
                content = import_statement + content
                
            # 2. Inject <CostGuardAlert /> inside <LiveKitRoom>
            # Replace </LiveKitRoom> with <CostGuardAlert />\n      </LiveKitRoom>
            content = content.replace("</LiveKitRoom>", "  <CostGuardAlert />\n      </LiveKitRoom>")
            
            with open(path, "w", encoding="utf-8") as file:
                file.write(content)
            print(f"Patched: {f}")
