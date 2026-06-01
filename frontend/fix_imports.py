import os

components_dir = r"d:\Antigravity Workspace\livekit-video-app\frontend\src\components"

for f in os.listdir(components_dir):
    if f.endswith("Room.jsx"):
        path = os.path.join(components_dir, f)
        with open(path, "r", encoding="utf-8") as file:
            lines = file.readlines()
            
        fixed = False
        new_lines = []
        has_costguard = False
        
        # Check if we have the misplaced import inside another import block
        for i, line in enumerate(lines):
            if line.strip() == 'import CostGuardAlert from "./CostGuardAlert";':
                has_costguard = True
                # If the previous line is `import {` or something similar, it's definitely misplaced
                if i > 0 and "import {" in lines[i-1] or lines[i-1].strip() == "import {":
                    fixed = True
                    continue # Skip adding it here
                # actually, any file might have it placed weirdly.
                # Let's just remove ALL occurrences of it, and then prepend it at the very top.
                continue 
            new_lines.append(line)
            
        if has_costguard:
            # Re-insert at the top
            new_lines.insert(1, 'import CostGuardAlert from "./CostGuardAlert";\n')
            with open(path, "w", encoding="utf-8") as file:
                file.writelines(new_lines)
            print(f"Fixed imports for {f}")
