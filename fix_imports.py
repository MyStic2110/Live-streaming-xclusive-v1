import os
import re

agents_dir = 'python-agent/agents'
files_to_update = [
    'aivyuh/aivyuh.py',
    'astra/astra.py',
    'bi2/bi2_agent.py',
    'lina/lina.py',
    'martech/martech_agent.py',
    'nova/nova.py',
    'octane/octane.py',
    'seva/seva.py',
    'vision/vision_agent.py'
]

import_stmt = 'from integrations.observyze import get_observyze_llm'

for rel_path in files_to_update:
    filepath = os.path.join(agents_dir, rel_path)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Remove all instances of the import statement
    lines = [l for l in lines if import_stmt not in l]
    
    # Find the last sys.path.append line
    insert_idx = -1
    for i, l in enumerate(lines):
        if 'sys.path.append' in l:
            insert_idx = i
            
    if insert_idx != -1:
        lines.insert(insert_idx + 1, import_stmt + '\n')
    else:
        # If no sys.path.append, just put it at the top (shouldn't happen)
        lines.insert(0, import_stmt + '\n')
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f'Fixed import position in: {rel_path}')
